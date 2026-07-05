import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateDepartmentDevice, requireDepartmentDeviceCapability } from "@/lib/department/auth";
import { canUseDemoFallback } from "@/lib/supabase/env";
import { demoCustomerInvoices } from "@/lib/demo-data";
import { demoEntries } from "@/server/queries/accounting";

const refundSchema = z.object({
  invoiceId: z.string().min(1, "معرف الفاتورة مطلوب"),
  reason: z.string().min(2, "سبب الإرجاع مطلوب"),
  items: z.array(z.object({
    catalogItemId: z.string(),
    quantity: z.coerce.number().positive(),
  })).optional(),
});

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

    (invoice as any).status = "refunded";
    const refundTotal = Number((invoice as any).total ?? 0);

    demoEntries.unshift({
      id: `je-refund-${Date.now()}`,
      entryNumber: `JE-RFD-${Date.now().toString().slice(-6)}`,
      entryDate: new Date().toISOString().split("T")[0],
      sourceDocType: "refund",
      memo: `قيد إرجاع - ${refundNumber} - السبب: ${parsed.data.reason}`,
      debitTotal: refundTotal,
      creditTotal: refundTotal,
      lines: [
        { id: `l-${Date.now()}-1`, accountCode: "4100", accountName: "مبيعات المطعم", debit: refundTotal, credit: 0, memo: "عكس مبيعات" },
        { id: `l-${Date.now()}-2`, accountCode: "1010", accountName: "الصندوق", debit: 0, credit: refundTotal, memo: "إرجاع نقدي" },
      ],
    });

    return NextResponse.json({
      success: true,
      refundNumber,
      invoiceId: parsed.data.invoiceId,
      refundTotal,
      reason: parsed.data.reason,
    });
  }

  // Production: use admin client
  const { data: invoice, error: invErr } = await auth.admin
    .from("customer_invoices")
    .select("id, status, total, organization_id, branch_id")
    .eq("id", parsed.data.invoiceId)
    .eq("organization_id", auth.device.organizationId)
    .maybeSingle();

  if (invErr || !invoice) {
    return NextResponse.json({ success: false, error: "الفاتورة غير موجودة" }, { status: 404 });
  }
  if (invoice.status === "refunded") {
    return NextResponse.json({ success: false, error: "هذه الفاتورة مرجعة مسبقاً" }, { status: 400 });
  }

  const refundTotal = Number(invoice.total ?? 0);

  // Mark invoice as refunded
  await auth.admin
    .from("customer_invoices")
    .update({ status: "refunded" })
    .eq("id", invoice.id);

  // Create refund journal entry
  // ملاحظة: عكس المخزون الفعلي (إرجاع الكميات لـ branch_stock) مؤجّل لمرحلة لاحقة،
  // إذ يتطلب RPC عكسي لـ pos_checkout_atomic. حالياً نكتفي بالقيد المحاسبي العكسي.
  await auth.admin.from("journal_entries").insert({
    organization_id: auth.device.organizationId,
    entry_number: refundNumber,
    entry_date: new Date().toISOString().split("T")[0],
    source_doc_type: "refund",
    memo: `قيد إرجاع - ${refundNumber} - السبب: ${parsed.data.reason}`,
    debit_total: refundTotal,
    credit_total: refundTotal,
  });

  return NextResponse.json({
    success: true,
    refundNumber,
    invoiceId: parsed.data.invoiceId,
    refundTotal,
    reason: parsed.data.reason,
  });
}
