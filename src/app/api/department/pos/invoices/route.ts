import { NextResponse } from "next/server";
import { authenticateDepartmentDevice } from "@/lib/department/auth";
import { canUseDemoFallback } from "@/lib/supabase/env";
import { demoCustomerInvoices } from "@/lib/demo-data";

export async function GET(request: Request) {
  const auth = await authenticateDepartmentDevice(request, "pos");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const dateFilter = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const limitParam = parseInt(url.searchParams.get("limit") || "50", 10);
  const limit = Math.min(Math.max(limitParam, 1), 200);

  if (canUseDemoFallback()) {
    const todayInvoices = demoCustomerInvoices
      .filter((inv: any) => (inv.issuedAt ?? inv.issued_at ?? "").slice(0, 10) === dateFilter)
      .slice(0, limit)
      .map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber ?? inv.invoice_number,
        customerName: inv.customerName ?? inv.customer_name ?? "عميل",
        status: inv.status ?? "paid",
        paymentMethod: inv.paymentMethod ?? inv.payment_method ?? "cash",
        subtotal: Number(inv.subtotal ?? 0),
        discount: Number(inv.discount ?? 0),
        taxTotal: Number(inv.taxTotal ?? inv.tax_total ?? 0),
        total: Number(inv.total ?? 0),
        issuedAt: inv.issuedAt ?? inv.issued_at,
        itemCount: Array.isArray(inv.items) ? inv.items.length : 0,
      }));

    return NextResponse.json({
      success: true,
      date: dateFilter,
      count: todayInvoices.length,
      totalSales: todayInvoices.reduce((s: number, i: any) => s + i.total, 0),
      invoices: todayInvoices,
    });
  }

  const startOfDay = `${dateFilter}T00:00:00.000Z`;
  const endOfDay = `${dateFilter}T23:59:59.999Z`;

  const { data: invoiceRows, error: invError } = await auth.admin
    .from("customer_invoices")
    .select("id, invoice_number, customer_name, status, payment_method, subtotal, discount, tax_total, total, issued_at")
    .eq("organization_id", auth.device.organizationId)
    .eq("branch_id", auth.device.branchId)
    .gte("issued_at", startOfDay)
    .lte("issued_at", endOfDay)
    .order("issued_at", { ascending: false })
    .limit(limit);

  if (invError) {
    return NextResponse.json({ success: false, error: invError.message }, { status: 500 });
  }

  const invoices = (invoiceRows ?? []).map((row: any) => ({
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerName: row.customer_name ?? "عميل",
    status: row.status ?? "paid",
    paymentMethod: row.payment_method ?? "cash",
    subtotal: Number(row.subtotal ?? 0),
    discount: Number(row.discount ?? 0),
    taxTotal: Number(row.tax_total ?? 0),
    total: Number(row.total ?? 0),
    issuedAt: row.issued_at,
  }));

  return NextResponse.json({
    success: true,
    date: dateFilter,
    count: invoices.length,
    totalSales: invoices.reduce((s: number, i: any) => s + i.total, 0),
    invoices,
  });
}
