import { NextResponse } from "next/server";
import { authenticateDepartmentDevice } from "@/lib/department/auth";
import { canUseDemoFallback } from "@/lib/supabase/env";

type BoardMode = "kitchen" | "expo";

function parseMode(request: Request): BoardMode {
  return new URL(request.url).searchParams.get("mode") === "expo" ? "expo" : "kitchen";
}

export async function GET(request: Request) {
  const mode = parseMode(request);
  const auth = await authenticateDepartmentDevice(request, mode);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  if (!auth.device.branchId) {
    return NextResponse.json(
      { success: false, error: "جهاز المطبخ أو Expo يجب أن يكون مربوطاً بفرع." },
      { status: 403 },
    );
  }
  if (canUseDemoFallback()) {
    return NextResponse.json({ success: true, mode, device: auth.device, stations: [], orders: [] });
  }

  const organizationId = auth.device.organizationId;
  const branchId = auth.device.branchId;
  const { data: assignments, error: assignmentError } = await auth.admin
    .from("kitchen_station_devices")
    .select("station_id")
    .eq("organization_id", organizationId)
    .eq("branch_id", branchId)
    .eq("device_id", auth.device.id)
    .eq("is_active", true);
  if (assignmentError) {
    console.error("Kitchen station assignment query failed:", assignmentError);
    return NextResponse.json({ success: false, error: "تعذر التحقق من محطات الجهاز." }, { status: 500 });
  }

  const stationIds = [...new Set((assignments ?? []).map((row: any) => row.station_id))];
  if (stationIds.length === 0) {
    return NextResponse.json(
      { success: false, error: "هذا الجهاز غير مربوط بأي محطة تحضير نشطة." },
      { status: 403 },
    );
  }

  const visibleStatuses = mode === "expo" ? ["ready"] : ["submitted", "accepted", "preparing"];
  const [stationsResult, itemsResult] = await Promise.all([
    auth.admin
      .from("kitchen_stations")
      .select("id, code, name, display_order")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .in("id", stationIds)
      .order("display_order"),
    auth.admin
      .from("restaurant_order_items")
      .select(
        "id, order_id, station_id, item_name, quantity, notes, allergens, modifiers, status, created_at, accepted_at, preparing_at, ready_at, order:restaurant_orders!restaurant_order_items_order_fk(id, order_number, status, restaurant_table_id, waiter_name, customer_name, channel, guest_count, priority, notes, allergens, total, version, submitted_at)",
      )
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .in("station_id", stationIds)
      .in("status", visibleStatuses)
      .order("created_at"),
  ]);
  const queryError = stationsResult.error ?? itemsResult.error;
  if (queryError) {
    console.error("Restaurant kitchen board query failed:", queryError);
    return NextResponse.json({ success: false, error: "تعذر تحميل لوحة الطلبات." }, { status: 500 });
  }

  const ordersById = new Map<string, any>();
  for (const item of itemsResult.data ?? []) {
    const relation = Array.isArray((item as any).order) ? (item as any).order[0] : (item as any).order;
    if (!relation) continue;
    const existing = ordersById.get(relation.id) ?? { ...relation, items: [] };
    existing.items.push({
      id: item.id,
      orderId: item.order_id,
      stationId: item.station_id,
      itemName: item.item_name,
      quantity: Number(item.quantity),
      notes: item.notes,
      allergens: item.allergens ?? [],
      modifiers: item.modifiers ?? [],
      status: item.status,
      createdAt: item.created_at,
      acceptedAt: item.accepted_at,
      preparingAt: item.preparing_at,
      readyAt: item.ready_at,
    });
    ordersById.set(relation.id, existing);
  }

  return NextResponse.json({
    success: true,
    mode,
    device: auth.device,
    stations: stationsResult.data ?? [],
    orders: [...ordersById.values()].sort((a, b) => {
      if (a.priority === "rush" && b.priority !== "rush") return -1;
      if (b.priority === "rush" && a.priority !== "rush") return 1;
      return String(a.submitted_at).localeCompare(String(b.submitted_at));
    }),
  });
}
