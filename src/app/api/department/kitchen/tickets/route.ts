import { NextResponse } from "next/server";
import { authenticateDepartmentDevice } from "@/lib/department/auth";

async function resolveBranchId(auth: Awaited<ReturnType<typeof authenticateDepartmentDevice>>) {
  if (!auth.ok) return null;
  if (auth.device.branchId) return auth.device.branchId;

  const { data } = await (auth.admin as any)
    .from("branches")
    .select("id")
    .eq("organization_id", auth.device.organizationId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

export async function GET(request: Request) {
  const auth = await authenticateDepartmentDevice(request, "recipes");

  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const branchId = await resolveBranchId(auth);
  if (!branchId) {
    return NextResponse.json({ success: false, error: "لا يوجد فرع مربوط بجهاز المطبخ." }, { status: 400 });
  }

  const { data, error } = await (auth.admin as any)
    .from("kitchen_tickets")
    .select(
      `
      id,
      ticket_number,
      customer_name,
      table_number,
      channel,
      status,
      priority,
      notes,
      opened_at,
      started_at,
      ready_at,
      customer_invoice_id,
      kitchen_ticket_items (
        id,
        name,
        quantity,
        notes,
        status,
        modifier_summary,
        menu_item_id,
        catalog_item_id
      )
    `,
    )
    .eq("organization_id", auth.device.organizationId)
    .eq("branch_id", branchId)
    .in("status", ["pending", "preparing", "ready"])
    .order("opened_at", { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, tickets: data ?? [] });
}
