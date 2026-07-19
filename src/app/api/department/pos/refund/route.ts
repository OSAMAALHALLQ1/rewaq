import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateDepartmentDevice, requireDepartmentDeviceCapability } from "@/lib/department/auth";
import { canUseDemoFallback } from "@/lib/supabase/env";
import { demoCustomerInvoices } from "@/lib/demo-data";
import { demoEntries } from "@/server/queries/accounting";
import { todayLocal } from "@/lib/accounting/posting";

const refundSchema = z.object({
  invoiceId: z.string().min(1, "معرف الفاتورة مطلوب"),
  reason: z.string().min(2, "سبب الإرجاع مطلوب"),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  items: z.array(z.object({
    catalogItemId: z.string(),
    quantity: z.coerce.number().positive(),
  })).optional(),
});

type PosRefundRpcClient = {
  rpc(
    fn: "pos_refund_v2_atomic",
    args: {
      p_org_id: string;
      p_branch_id: string;
      p_invoice_id: string;
      p_reason: string;
      p_refund_date: string;
      p_idempotency_key: string;
      p_actor_user_id: string | null;
      p_actor_device_id: string | null;
      p_items: Array<{ catalog_item_id: string; quantity: number }> | null;
    },
  ): Promise<{
    data: {
      success: boolean;
      idempotent: boolean;
      refundNumber: string;
      invoiceId: string;
      refundTotal: number;
      reason: string;
      invoiceStatus: string;
    } | null;
    error: { message: string } | null;
  }>;
};

export async function POST(request: Request) {
  const auth = await authenticateDepartmentDevice(request, "pos");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const capability = requireDepartmentDeviceCapability(auth, "pos_refund");
  if (!capability.ok) {
    return NextResponse.json({ success: false, error: capability.error }, { status: capability.status });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = refundSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "بيانات الإرجاع غير صحيحة" },
      { status: 400 },
    );
  }

  const refundNumber = `RFD-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

  if (canUseDemoFallback()) {
    const invoice = demoCustomerInvoices.find((inv: any) => inv.id === parsed.data.invoiceId);
    if (!invoice) {
      return NextResponse.json({ success: false, error: "الفاتورة غير موجودة" }, { status: 404 });
    }
    if ((invoice as any).status === "refunded") {
      return NextResponse.json({ success: false, error: "هذه الفاتورة مرجعة مسبقاً" }, { status: 400 });
    }

    // In demo mode:
    let returnedSubtotal = 0;
    let returnedTax = 0;
    let returnedDiscount = 0;
    let returnedServiceFee = 0;
    let returnedDeliveryFee = 0;
    let returnedTotal = 0;
    let returnedCost = 0;

    const items = parsed.data.items || [];
    const isPartial = items.length > 0;

    if (!isPartial) {
      returnedSubtotal = Number((invoice as any).subtotal ?? 0);
      returnedTax = Number((invoice as any).taxTotal ?? 0);
      returnedDiscount = Number((invoice as any).discount ?? 0);
      returnedServiceFee = Number((invoice as any).serviceFee ?? 0);
      returnedDeliveryFee = Number((invoice as any).deliveryFee ?? 0);
      returnedTotal = Number((invoice as any).total ?? 0);
      returnedCost = Number((invoice as any).costTotal ?? Math.round(returnedSubtotal * 0.3 * 100) / 100);
      (invoice as any).status = "refunded";
    } else {
      // Partial refund simulation
      for (const item of items) {
        const invItem = (invoice as any).items?.find(
          (i: any) => i.menuItemId === item.catalogItemId || i.catalogItemId === item.catalogItemId
        );
        if (!invItem) {
          return NextResponse.json({ success: false, error: `الصنف غير موجود في الفاتورة` }, { status: 400 });
        }
        if (item.quantity <= 0 || item.quantity > invItem.quantity) {
          return NextResponse.json(
            { success: false, error: `كمية المرتجع غير صالحة للصنف ${invItem.name}` },
            { status: 400 },
          );
        }
        returnedSubtotal += Number(invItem.unitPrice ?? 0) * item.quantity;
        returnedTax += (Number(invItem.unitPrice ?? 0) * item.quantity * Number(invItem.taxRate ?? 0)) / 100;
        invItem.quantity -= item.quantity;
        invItem.total = Number(invItem.unitPrice ?? 0) * invItem.quantity;
      }
      
      const invoiceSubtotal = Number((invoice as any).subtotal ?? 0);
      if (invoiceSubtotal > 0) {
        const factor = returnedSubtotal / invoiceSubtotal;
        returnedDiscount = Math.round((Number((invoice as any).discount ?? 0) * factor) * 100) / 100;
        returnedServiceFee = Math.round((Number((invoice as any).serviceFee ?? 0) * factor) * 100) / 100;
        returnedDeliveryFee = Math.round((Number((invoice as any).deliveryFee ?? 0) * factor) * 100) / 100;
      }
      
      returnedTotal = Math.round((returnedSubtotal - returnedDiscount + returnedTax + returnedServiceFee + returnedDeliveryFee) * 100) / 100;
      returnedCost = Math.round(returnedSubtotal * 0.3 * 100) / 100;
      
      // Update invoice remaining values
      (invoice as any).subtotal = Math.max(0, (invoice as any).subtotal - returnedSubtotal);
      (invoice as any).discount = Math.max(0, (invoice as any).discount - returnedDiscount);
      (invoice as any).serviceFee = Math.max(0, (invoice as any).serviceFee - returnedServiceFee);
      (invoice as any).deliveryFee = Math.max(0, (invoice as any).deliveryFee - returnedDeliveryFee);
      (invoice as any).taxTotal = Math.max(0, (invoice as any).taxTotal - returnedTax);
      (invoice as any).total = Math.max(0, (invoice as any).total - returnedTotal);
      
      const allZero = (invoice as any).items?.every((i: any) => i.quantity === 0);
      (invoice as any).status = allZero ? "refunded" : "partially_refunded";
    }

    const jeLines = [];
    let debitSum = 0;
    let creditSum = 0;

    // Debits (opposite of checkout credits)
    if (returnedSubtotal > 0) {
      jeLines.push({
        id: `l-${Date.now()}-1`,
        accountCode: "4100",
        accountName: "مبيعات المطعم",
        debit: returnedSubtotal,
        credit: 0,
        memo: `عكس مبيعات فاتورة ${(invoice as any).invoiceNumber}`,
      });
      debitSum += returnedSubtotal;
    }

    if (returnedTax > 0) {
      jeLines.push({
        id: `l-${Date.now()}-tax`,
        accountCode: "2100",
        accountName: "ضريبة مبيعات مستحقة",
        debit: returnedTax,
        credit: 0,
        memo: `عكس ضريبة فاتورة ${(invoice as any).invoiceNumber}`,
      });
      debitSum += returnedTax;
    }

    if (returnedServiceFee > 0) {
      jeLines.push({
        id: `l-${Date.now()}-srv`,
        accountCode: "4300",
        accountName: "إيرادات رسوم الخدمة",
        debit: returnedServiceFee,
        credit: 0,
        memo: `عكس رسوم خدمة فاتورة ${(invoice as any).invoiceNumber}`,
      });
      debitSum += returnedServiceFee;
    }

    if (returnedDeliveryFee > 0) {
      jeLines.push({
        id: `l-${Date.now()}-del`,
        accountCode: "4400",
        accountName: "إيرادات رسوم التوصيل",
        debit: returnedDeliveryFee,
        credit: 0,
        memo: `عكس رسوم توصيل فاتورة ${(invoice as any).invoiceNumber}`,
      });
      debitSum += returnedDeliveryFee;
    }

    // Credits (opposite of checkout debits)
    const method = (invoice as any).paymentMethod || "cash";
    const isCash = method === "cash";
    const isReceivable = method === "receivable";
    const code = isCash ? "1010" : isReceivable ? "1200" : "1020";
    const name = isCash ? "الصندوق" : isReceivable ? "ذمم عملاء" : "البنك / بطاقات";
    jeLines.push({
      id: `l-${Date.now()}-2`,
      accountCode: code,
      accountName: name,
      debit: 0,
      credit: returnedTotal,
      memo: `عكس تحصيل فاتورة ${(invoice as any).invoiceNumber}`,
    });
    creditSum += returnedTotal;

    if (returnedDiscount > 0) {
      jeLines.push({
        id: `l-${Date.now()}-disc`,
        accountCode: "4200",
        accountName: "الخصومات المسموح بها",
        debit: 0,
        credit: returnedDiscount,
        memo: `عكس خصم مسموح به فاتورة ${(invoice as any).invoiceNumber}`,
      });
      creditSum += returnedDiscount;
    }

    // COGS & Inventory reversal: Debit Inventory, Credit COGS
    if (returnedCost > 0) {
      jeLines.push(
        {
          id: `l-${Date.now()}-inv`,
          accountCode: "1300",
          accountName: "المخزون",
          debit: returnedCost,
          credit: 0,
          memo: `إرجاع مخزون مرتجع فاتورة ${(invoice as any).invoiceNumber}`,
        },
        {
          id: `l-${Date.now()}-cogs`,
          accountCode: "5100",
          accountName: "تكلفة البضاعة المباعة",
          debit: 0,
          credit: returnedCost,
          memo: `عكس تكلفة مبيعات مرتجع فاتورة ${(invoice as any).invoiceNumber}`,
        }
      );
      debitSum += returnedCost;
      creditSum += returnedCost;
    }

    demoEntries.unshift({
      id: `je-refund-${Date.now()}`,
      entryNumber: `JE-RFD-${Date.now().toString().slice(-6)}`,
      entryDate: todayLocal(),
      sourceDocType: "refund",
      memo: `قيد إرجاع - ${refundNumber} - السبب: ${parsed.data.reason}`,
      debitTotal: debitSum,
      creditTotal: creditSum,
      lines: jeLines,
    });

    return NextResponse.json({
      success: true,
      refundNumber,
      invoiceId: parsed.data.invoiceId,
      refundTotal: returnedTotal,
      reason: parsed.data.reason,
    });
  }

  // Production: use admin client to get branch_id
  const { data: invoice, error: invErr } = await auth.admin
    .from("customer_invoices")
    .select("branch_id")
    .eq("id", parsed.data.invoiceId)
    .eq("organization_id", auth.device.organizationId)
    .maybeSingle();

  if (invErr || !invoice) {
    return NextResponse.json({ success: false, error: "الفاتورة غير موجودة" }, { status: 404 });
  }

  const { data, error: rpcError } = await (auth.admin as unknown as PosRefundRpcClient).rpc("pos_refund_v2_atomic", {
    p_org_id: auth.device.organizationId,
    p_branch_id: invoice.branch_id,
    p_invoice_id: parsed.data.invoiceId,
    p_reason: parsed.data.reason,
    p_refund_date: todayLocal(),
    p_idempotency_key: parsed.data.idempotencyKey ?? crypto.randomUUID(),
    p_actor_user_id: null,
    p_actor_device_id: auth.device.id,
    p_items: parsed.data.items ? parsed.data.items.map(item => ({
      catalog_item_id: item.catalogItemId,
      quantity: item.quantity
    })) : null
  });

  if (rpcError) {
    return NextResponse.json({ success: false, error: rpcError.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ success: false, error: "لم يرجع مسار الإرجاع نتيجة من قاعدة البيانات." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    idempotent: data.idempotent === true,
    refundNumber: data.refundNumber,
    invoiceId: data.invoiceId,
    refundTotal: data.refundTotal,
    invoiceStatus: data.invoiceStatus,
    reason: data.reason,
  });
}
