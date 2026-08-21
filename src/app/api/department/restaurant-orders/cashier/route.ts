import { NextResponse } from "next/server";
import { authenticateDepartmentDevice, requireDepartmentDeviceCapability } from "@/lib/department/auth";
import { canUseDemoFallback } from "@/lib/supabase/env";

export async function GET(request: Request) {
  const auth = await authenticateDepartmentDevice(request, "pos");
  if (!auth.ok) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  if (!auth.device.branchId) return NextResponse.json({ success: false, error: "جهاز الكاشير غير مربوط بنطاق تشغيل." }, { status: 403 });
  const capability = requireDepartmentDeviceCapability(auth, "pos_read", auth.device.branchId);
  if (!capability.ok) return NextResponse.json({ success: false, error: capability.error }, { status: capability.status });
  if (canUseDemoFallback()) return NextResponse.json({ success: true, orders: [] });

  const { data: orders, error } = await auth.admin
    .from("restaurant_orders")
    .select("id,order_number,status,restaurant_table_id,waiter_name,customer_name,channel,notes,subtotal,discount_total,tax_total,service_fee,delivery_fee,total,submitted_at")
    .eq("organization_id", auth.device.organizationId)
    .eq("branch_id", auth.device.branchId)
    .is("customer_invoice_id", null)
    .in("status", ["ready", "served"])
    .order("submitted_at", { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ success: false, error: "تعذر تحميل طلبات المطعم الجاهزة للفوترة." }, { status: 500 });

  const orderIds = (orders ?? []).map((order) => order.id);
  const { data: items, error: itemsError } = orderIds.length
    ? await auth.admin.from("restaurant_order_items").select("id,order_id,catalog_item_id,item_name,quantity,unit_price,tax_rate,discount_amount,notes,status").eq("organization_id", auth.device.organizationId).eq("branch_id", auth.device.branchId).in("order_id", orderIds).neq("status", "cancelled").order("created_at")
    : { data: [], error: null };
  if (itemsError) return NextResponse.json({ success: false, error: "تعذر تحميل أصناف طلبات المطعم." }, { status: 500 });

  const byOrder = new Map<string, typeof items>();
  for (const item of items ?? []) byOrder.set(item.order_id, [...(byOrder.get(item.order_id) ?? []), item]);
  return NextResponse.json({ success: true, orders: (orders ?? []).map((order) => ({ ...order, items: byOrder.get(order.id) ?? [] })) });
}
