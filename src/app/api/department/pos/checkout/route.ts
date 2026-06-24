import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateDepartmentDevice } from "@/lib/department/auth";
import { postCustomerInvoiceJournal } from "@/lib/accounting/posting";
import { createKitchenTicketForInvoice } from "@/lib/kitchen/tickets";
import { ensureOpenSalesShift, registerShiftSale } from "@/lib/sales/shift-posting";

const checkoutItemSchema = z.object({
  catalogItemId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
});

const checkoutSchema = z.object({
  paymentMethod: z.enum(["cash", "card"]).default("cash"),
  customerName: z.string().optional(),
  items: z.array(checkoutItemSchema).min(1),
});

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

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => ({})));

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

  const shift = await ensureOpenSalesShift(auth.admin, {
    organizationId: auth.device.organizationId,
    branchId,
    deviceKeyId: auth.device.id,
    cashierName: auth.device.deviceName,
    openingCash: 0,
  });

  const catalogIds = parsed.data.items.map((item) => item.catalogItemId);
  const { data: catalogRows, error: catalogError } = await auth.admin
    .from("catalog_items")
    .select("id, name, menu_item_id, main_unit, retail_price, tax_rate, status")
    .eq("organization_id", auth.device.organizationId)
    .in("id", catalogIds);

  if (catalogError) {
    return NextResponse.json({ success: false, error: catalogError.message }, { status: 500 });
  }

  const catalogMap = new Map((catalogRows ?? []).map((item) => [item.id, item]));
  const lines = [];

  for (const item of parsed.data.items) {
    const catalog = catalogMap.get(item.catalogItemId);
    if (!catalog || catalog.status !== "active") {
      return NextResponse.json(
        { success: false, error: "يوجد صنف غير نشط أو غير معروف في السلة." },
        { status: 400 },
      );
    }

    const unitPrice = Number(catalog.retail_price ?? 0);
    const taxRate = Number(catalog.tax_rate ?? 0);
    const subtotal = unitPrice * item.quantity;

    lines.push({
      catalog,
      quantity: item.quantity,
      unitPrice,
      taxRate,
      subtotal,
      tax: subtotal * (taxRate / 100),
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const taxTotal = lines.reduce((sum, line) => sum + line.tax, 0);
  const total = subtotal + taxTotal;
  const invoiceNumber = `POS-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

  const { data: invoice, error: invoiceError } = await auth.admin
    .from("customer_invoices")
    .insert({
      organization_id: auth.device.organizationId,
      branch_id: branchId,
      invoice_number: invoiceNumber,
      customer_name: parsed.data.customerName?.trim() || "عميل سفري سريع",
      status: "paid",
      payment_method: parsed.data.paymentMethod,
      channel: "pickup",
      subtotal,
      discount: 0,
      tax_total: taxTotal,
      total,
      shift_id: shift.id,
      notes: `فاتورة من جهاز ${auth.device.deviceName}`,
    })
    .select("id, invoice_number")
    .single();

  if (invoiceError || !invoice) {
    return NextResponse.json({ success: false, error: invoiceError?.message ?? "تعذر حفظ الفاتورة." }, { status: 500 });
  }

  const { error: itemsError } = await auth.admin.from("customer_invoice_items").insert(
    lines.map((line) => ({
      organization_id: auth.device.organizationId,
      customer_invoice_id: invoice.id,
      catalog_item_id: line.catalog.id,
      menu_item_id: line.catalog.menu_item_id,
      name: line.catalog.name,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      unit_name: line.catalog.main_unit ?? "قطعة",
      unit_factor: 1,
      discount: 0,
      tax_rate: line.taxRate,
      cost_total: 0,
      gross_profit: line.subtotal,
    })),
  );

  if (itemsError) {
    return NextResponse.json({ success: false, error: itemsError.message }, { status: 500 });
  }

  const { error: paymentError } = await auth.admin.from("customer_invoice_payments").insert({
    organization_id: auth.device.organizationId,
    customer_invoice_id: invoice.id,
    payment_method: parsed.data.paymentMethod,
    amount: total,
  });

  if (paymentError) {
    return NextResponse.json({ success: false, error: paymentError.message }, { status: 500 });
  }

  await registerShiftSale(auth.admin, {
    organizationId: auth.device.organizationId,
    branchId,
    shiftId: shift.id,
    invoiceId: invoice.id,
    amount: total,
    paymentMethod: parsed.data.paymentMethod,
  });

  await postCustomerInvoiceJournal(auth.admin, {
    organizationId: auth.device.organizationId,
    branchId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    paymentMethod: parsed.data.paymentMethod,
    subtotal,
    taxTotal,
    total,
    costTotal: 0,
    createdBy: null,
  });

  const kitchenTicket = await createKitchenTicketForInvoice(auth.admin, {
    organizationId: auth.device.organizationId,
    branchId,
    invoiceId: invoice.id,
    shiftId: shift.id,
    invoiceNumber: invoice.invoice_number,
    customerName: parsed.data.customerName?.trim() || "عميل سفري سريع",
    channel: "pickup",
    notes: `تذكرة مطبخ من جهاز ${auth.device.deviceName}`,
    lines: lines.map((line) => ({
      catalogItemId: line.catalog.id,
      menuItemId: line.catalog.menu_item_id,
      name: line.catalog.name,
      quantity: line.quantity,
    })),
  });

  return NextResponse.json({
    success: true,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    kitchenTicketId: kitchenTicket?.id ?? null,
    shiftId: shift.id,
    total,
  });
}
