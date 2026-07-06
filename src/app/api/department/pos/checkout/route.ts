import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateDepartmentDevice, requireDepartmentDeviceCapability } from "@/lib/department/auth";
import { 
  demoBranchStock, 
  demoStockMovements, 
  demoCustomerInvoices, 
  demoRecipes,
  demoCatalogItems
} from "@/lib/demo-data";
import { demoEntries } from "@/server/queries/accounting";
import { canUseDemoFallback } from "@/lib/supabase/env";

const checkoutItemSchema = z.object({
  catalogItemId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
});

const checkoutSchema = z.object({
  paymentMethod: z.enum([
    "cash",
    "card",
    "bank_transfer",
    "delivery_app",
    "receivable",
    "wallet",
    "gift_card",
  ]).default("cash"),
  customerName: z.string().optional(),
  notes: z.string().max(300).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  items: z.array(checkoutItemSchema).min(1),
  discount: z.coerce.number().nonnegative().default(0),
  serviceFee: z.coerce.number().nonnegative().default(0),
  deliveryFee: z.coerce.number().nonnegative().default(0),
  payments: z.array(z.object({
    method: z.enum([
      "cash",
      "card",
      "bank_transfer",
      "delivery_app",
      "receivable",
      "wallet",
      "gift_card",
    ]),
    amount: z.coerce.number().positive(),
  })).optional(),
});

type PosCheckoutAtomicResult = {
  idempotent?: boolean;
  invoiceId: string;
  invoiceNumber: string;
  kitchenTicketId: string | null;
  shiftId: string;
  total: number | string;
  costTotal?: number | string;
};

type PosCheckoutRpcClient = {
  rpc(
    fn: "pos_checkout_atomic",
    args: {
      p_org_id: string;
      p_branch_id: string;
      p_device_key_id: string;
      p_device_name: string;
      p_customer_name: string;
      p_payment_method: string;
      p_idempotency_key: string;
      p_items: Array<{ catalog_item_id: string; quantity: number }>;
      p_discount?: number;
      p_service_fee?: number;
      p_delivery_fee?: number;
      p_payments?: Array<{ method: string; amount: number }> | null;
    },
  ): Promise<{ data: PosCheckoutAtomicResult | null; error: { message: string } | null }>;
};

async function resolveBranchId(auth: Awaited<ReturnType<typeof authenticateDepartmentDevice>>) {
  if (!auth.ok) return null;
  if (auth.device.branchId) return auth.device.branchId;

  const { data } = await auth.admin
    .from("branches")
    .select("id")
    .eq("organization_id", auth.device.organizationId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

export async function POST(request: Request) {
  const auth = await authenticateDepartmentDevice(request, "pos");

  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "بيانات الفاتورة غير صحيحة." },
      { status: 400 },
    );
  }

  const branchId = await resolveBranchId(auth);
  if (!branchId) {
    return NextResponse.json({ success: false, error: "لا يوجد فرع مربوط بجهاز الكاشير." }, { status: 400 });
  }

  const capability = requireDepartmentDeviceCapability(auth, "pos_write", branchId);
  if (!capability.ok) {
    return NextResponse.json({ success: false, error: capability.error }, { status: capability.status });
  }

  // التحقق من إلزام الوردية المفتوحة قبل البيع (إن كان مفعّلاً في الإعدادات)
  if (!canUseDemoFallback()) {
    const { data: posSettings } = await auth.admin
      .from("pos_settings")
      .select("require_shift")
      .eq("organization_id", auth.device.organizationId)
      .maybeSingle();
    const requireShift = posSettings?.require_shift ?? true;
    if (requireShift) {
      const { data: openShift } = await auth.admin
        .from("sales_shifts")
        .select("id")
        .eq("organization_id", auth.device.organizationId)
        .eq("device_key_id", auth.device.id)
        .eq("status", "open")
        .maybeSingle();
      if (!openShift) {
        return NextResponse.json(
          { success: false, error: "يجب فتح وردية قبل بدء البيع." },
          { status: 400 },
        );
      }
    }
  }

  const idempotencyKey =
    parsed.data.idempotencyKey?.trim() || request.headers.get("x-idempotency-key")?.trim() || null;

  const invoiceNumber = `POS-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

  if (canUseDemoFallback()) {
    // ----------------------------------------------------
    // DEMO / SIMULATION MODE CHECKOUT
    // ----------------------------------------------------
    let subtotal = 0;
    const itemsList = [];
    const kitchenTicketLines = [];
    let demoCostTotal = 0;

    for (const item of parsed.data.items) {
      const catalogItem = demoCatalogItems.find(c => c.id === item.catalogItemId);
      if (!catalogItem) {
        return NextResponse.json({ success: false, error: "الصنف غير موجود في كتالوج المحاكاة." }, { status: 400 });
      }
      const itemSubtotal = catalogItem.retailPrice * item.quantity;
      subtotal += itemSubtotal;

      itemsList.push({
        id: `cinv-demo-item-${Date.now()}-${Math.random()}`,
        menuItemId: catalogItem.id,
        name: catalogItem.name,
        quantity: item.quantity,
        unitPrice: catalogItem.retailPrice,
        total: itemSubtotal,
      });

      kitchenTicketLines.push({
        catalogItemId: catalogItem.id,
        menuItemId: catalogItem.id,
        name: catalogItem.name,
        quantity: item.quantity,
      });

      // Recipe stock deduction simulation
      const recipe = demoRecipes.find(r => r.name === catalogItem.name);
      if (recipe) {
        for (const ingredient of recipe.ingredients) {
          const deductQty = ingredient.quantity * item.quantity;
          demoCostTotal += deductQty * ingredient.unitCost;
          
          // Deduct from demoBranchStock
          const stock = demoBranchStock.find(s => s.itemId === ingredient.itemId && s.branchId === branchId);
          if (stock) {
            stock.quantity = Math.max(0, stock.quantity - deductQty);
          }

          // Log stock movement in simulation
          demoStockMovements.unshift({
            id: `movement-demo-${Date.now()}-${Math.random()}`,
            organizationId: auth.device.organizationId,
            branchId,
            branchName: "فرع شارع عبد القادر الحسيني",
            itemId: ingredient.itemId,
            itemName: ingredient.itemName,
            movementType: "sale_usage",
            quantity: -deductQty,
            unitCost: ingredient.unitCost,
            totalCost: deductQty * ingredient.unitCost,
            reference: invoiceNumber,
            notes: `خصم تلقائي للمبيعات - فاتورة ${invoiceNumber}`,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    const discount = parsed.data.discount || 0;
    const serviceFee = parsed.data.serviceFee || 0;
    const deliveryFee = parsed.data.deliveryFee || 0;
    const payments = parsed.data.payments || [];
    
    // Formula: Subtotal - Discount + Tax + ServiceFee + DeliveryFee
    const total = Math.max(0, subtotal - discount + serviceFee + deliveryFee);
    demoCostTotal = Math.round(demoCostTotal * 100) / 100;

    // Save demo customer invoice
    demoCustomerInvoices.unshift({
      id: `cinv-demo-${Date.now()}`,
      organizationId: auth.device.organizationId,
      branchId,
      branchName: "فرع شارع عبد القادر الحسيني",
      invoiceNumber,
      customerName: parsed.data.customerName?.trim() || "عميل سفري سريع",
      status: "paid",
      paymentMethod: parsed.data.paymentMethod,
      issuedAt: new Date().toISOString(),
      subtotal,
      discount,
      serviceFee,
      deliveryFee,
      taxRate: 0,
      taxTotal: 0,
      total,
      items: itemsList,
    });

    const jeLines = [];
    let debitSum = 0;
    let creditSum = 0;

    // 1. Debits: Payments (Asset or Receivable)
    if (payments.length > 0) {
      for (const pay of payments) {
        const amt = Number(pay.amount);
        if (amt > 0) {
          const isCash = pay.method === "cash";
          const isReceivable = pay.method === "receivable";
          const code = isCash ? "1010" : isReceivable ? "1200" : "1020";
          const name = isCash ? "الصندوق" : isReceivable ? "ذمم عملاء" : "البنك / بطاقات";
          jeLines.push({
            id: `line-${Date.now()}-pay-${Math.random()}`,
            accountCode: code,
            accountName: name,
            debit: amt,
            credit: 0,
            memo: `تحصيل دفعة ${pay.method}`,
          });
          debitSum += amt;
        }
      }
    } else {
      const isCash = parsed.data.paymentMethod === "cash";
      const isReceivable = parsed.data.paymentMethod === "receivable";
      const code = isCash ? "1010" : isReceivable ? "1200" : "1020";
      const name = isCash ? "الصندوق" : isReceivable ? "ذمم عملاء" : "البنك / بطاقات";
      jeLines.push({
        id: `line-${Date.now()}-pay-${Math.random()}`,
        accountCode: code,
        accountName: name,
        debit: total,
        credit: 0,
        memo: "تحصيل نقدي/شبكة",
      });
      debitSum += total;
    }

    // 2. Debits: Discount
    if (discount > 0) {
      jeLines.push({
        id: `line-${Date.now()}-disc-${Math.random()}`,
        accountCode: "4200",
        accountName: "الخصومات المسموح بها",
        debit: discount,
        credit: 0,
        memo: "خصم مسموح به",
      });
      debitSum += discount;
    }

    // 3. Credits: Sales Revenue
    jeLines.push({
      id: `line-${Date.now()}-rev-${Math.random()}`,
      accountCode: "4100",
      accountName: "مبيعات المطعم",
      debit: 0,
      credit: subtotal,
      memo: "مبيعات",
    });
    creditSum += subtotal;

    // 4. Credits: Service Fee
    if (serviceFee > 0) {
      jeLines.push({
        id: `line-${Date.now()}-srv-${Math.random()}`,
        accountCode: "4300",
        accountName: "إيرادات رسوم الخدمة",
        debit: 0,
        credit: serviceFee,
        memo: "رسوم خدمة مبيعات",
      });
      creditSum += serviceFee;
    }

    // 5. Credits: Delivery Fee
    if (deliveryFee > 0) {
      jeLines.push({
        id: `line-${Date.now()}-del-${Math.random()}`,
        accountCode: "4400",
        accountName: "إيرادات رسوم التوصيل",
        debit: 0,
        credit: deliveryFee,
        memo: "رسوم توصيل مبيعات",
      });
      creditSum += deliveryFee;
    }

    // 6. COGS & Inventory (Asset adjustment)
    if (demoCostTotal > 0) {
      jeLines.push(
        {
          id: `line-${Date.now()}-cogs-${Math.random()}`,
          accountCode: "5100",
          accountName: "تكلفة البضاعة المباعة",
          debit: demoCostTotal,
          credit: 0,
          memo: "تكلفة مبيعات",
        },
        {
          id: `line-${Date.now()}-inv-${Math.random()}`,
          accountCode: "1300",
          accountName: "المخزون",
          debit: 0,
          credit: demoCostTotal,
          memo: "تخفيض المخزون للمبيعات",
        }
      );
      debitSum += demoCostTotal;
      creditSum += demoCostTotal;
    }

    // Save demo accounting journal entry
    demoEntries.unshift({
      id: `je-demo-${Date.now()}`,
      entryNumber: `JE-POS-${Date.now().toString().slice(-6)}`,
      entryDate: new Date().toISOString().split('T')[0],
      sourceDocType: "customer_invoice",
      memo: `قيد تلقائي لمبيعات الكاشير - فاتورة ${invoiceNumber}`,
      debitTotal: debitSum,
      creditTotal: creditSum,
      lines: jeLines,
    });

    return NextResponse.json({
      success: true,
      invoiceId: `cinv-demo-${Date.now()}`,
      invoiceNumber,
      kitchenTicketId: `kticket-demo-${Date.now()}`,
      shiftId: "shift-demo-01",
      total,
      costTotal: demoCostTotal,
    });
  }

  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 120) {
    return NextResponse.json(
      { success: false, error: "مفتاح منع التكرار مطلوب لفواتير الكاشير." },
      { status: 400 },
    );
  }

  const { data, error: rpcError } = await (auth.admin as unknown as PosCheckoutRpcClient).rpc("pos_checkout_atomic", {
    p_org_id: auth.device.organizationId,
    p_branch_id: branchId,
    p_device_key_id: auth.device.id,
    p_device_name: auth.device.deviceName,
    p_customer_name: parsed.data.customerName?.trim() || "عميل سفري سريع",
    p_payment_method: parsed.data.paymentMethod,
    p_idempotency_key: idempotencyKey,
    p_items: parsed.data.items.map((item) => ({
      catalog_item_id: item.catalogItemId,
      quantity: item.quantity,
    })),
    p_discount: parsed.data.discount,
    p_service_fee: parsed.data.serviceFee,
    p_delivery_fee: parsed.data.deliveryFee,
    p_payments: parsed.data.payments || null,
  });

  if (rpcError) {
    return NextResponse.json({ success: false, error: rpcError.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ success: false, error: "لم يرجع مسار الدفع نتيجة من قاعدة البيانات." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    idempotent: data.idempotent || false,
    invoiceId: data.invoiceId,
    invoiceNumber: data.invoiceNumber,
    kitchenTicketId: data.kitchenTicketId,
    shiftId: data.shiftId,
    total: Number(data.total),
    costTotal: Number(data.costTotal ?? 0),
  });
}
