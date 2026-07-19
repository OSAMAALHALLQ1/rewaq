import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticateDepartmentDevice,
  requireDepartmentDeviceCapability,
} from "@/lib/department/auth";
import { canUseDemoFallback } from "@/lib/supabase/env";

const orderItemSchema = z.object({
  clientLineId: z.string().trim().min(1).max(80),
  stationId: z.string().uuid(),
  catalogItemId: z.string().uuid(),
  quantity: z.coerce.number().positive().max(999),
  notes: z.string().trim().max(500).optional().nullable(),
  allergens: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
});

const submitOrderSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(100),
  tableId: z.string().uuid().optional().nullable(),
  waiterName: z.string().trim().min(1).max(120).optional().nullable(),
  customerName: z.string().trim().max(120).optional().nullable(),
  customerPhone: z.string().trim().max(40).optional().nullable(),
  channel: z.enum(["dine_in", "delivery", "pickup"]).default("dine_in"),
  guestCount: z.coerce.number().int().positive().max(500).optional().nullable(),
  priority: z.enum(["normal", "rush"]).default("normal"),
  notes: z.string().trim().max(1000).optional().nullable(),
  allergens: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).default("JOD"),
  items: z.array(orderItemSchema).min(1).max(250),
});

async function authenticateWaiter(request: Request) {
  const auth = await authenticateDepartmentDevice(request, "waiter");
  if (!auth.ok) return auth;
  return requireDepartmentDeviceCapability(auth, "waiter_write", auth.device.branchId);
}

export async function GET(request: Request) {
  const auth = await authenticateWaiter(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  if (!auth.device.branchId) {
    return NextResponse.json({ success: false, error: "جهاز النادل غير مربوط بفرع." }, { status: 403 });
  }
  if (canUseDemoFallback()) {
    return NextResponse.json({ success: true, orders: [] });
  }

  const { data: orders, error: orderError } = await auth.admin
    .from("restaurant_orders")
    .select(
      "id, order_number, status, restaurant_table_id, waiter_name, customer_name, channel, guest_count, priority, notes, allergens, currency, subtotal, tax_total, total, version, submitted_at, accepted_at, preparing_at, ready_at, served_at",
    )
    .eq("organization_id", auth.device.organizationId)
    .eq("branch_id", auth.device.branchId)
    .in("status", ["submitted", "accepted", "preparing", "ready", "served"])
    .order("submitted_at", { ascending: false })
    .limit(100);
  if (orderError) {
    console.error("Waiter order list failed:", orderError);
    return NextResponse.json({ success: false, error: "تعذر تحميل الطلبات النشطة." }, { status: 500 });
  }

  const orderIds = (orders ?? []).map((order: any) => order.id);
  const { data: items, error: itemError } = orderIds.length
    ? await auth.admin
        .from("restaurant_order_items")
        .select(
          "id, order_id, client_line_id, station_id, catalog_item_id, item_name, quantity, unit_price, line_total, notes, allergens, status, created_at, accepted_at, preparing_at, ready_at, served_at",
        )
        .eq("organization_id", auth.device.organizationId)
        .eq("branch_id", auth.device.branchId)
        .in("order_id", orderIds)
        .order("created_at")
    : { data: [], error: null };
  if (itemError) {
    console.error("Waiter order item list failed:", itemError);
    return NextResponse.json({ success: false, error: "تعذر تحميل عناصر الطلبات." }, { status: 500 });
  }

  const itemsByOrder = new Map<string, any[]>();
  for (const item of items ?? []) {
    itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item]);
  }

  return NextResponse.json({
    success: true,
    orders: (orders ?? []).map((order: any) => ({
      ...order,
      items: itemsByOrder.get(order.id) ?? [],
    })),
  });
}

export async function POST(request: Request) {
  const auth = await authenticateWaiter(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  if (!auth.device.branchId) {
    return NextResponse.json({ success: false, error: "جهاز النادل غير مربوط بفرع." }, { status: 403 });
  }

  const parsed = submitOrderSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "بيانات الطلب غير صحيحة." },
      { status: 400 },
    );
  }
  const input = parsed.data;
  const uniqueLineIds = new Set(input.items.map((item) => item.clientLineId));
  if (uniqueLineIds.size !== input.items.length) {
    return NextResponse.json(
      { success: false, error: "معرفات عناصر الطلب يجب أن تكون فريدة." },
      { status: 400 },
    );
  }

  if (canUseDemoFallback()) {
    return NextResponse.json({
      success: true,
      order: {
        success: true,
        duplicate: false,
        order_id: crypto.randomUUID(),
        order_number: `ORD-DEMO-${Date.now().toString().slice(-5)}`,
        status: "submitted",
        priority: input.priority,
        total: input.items.reduce((sum, item) => sum + item.quantity * 10, 0),
        version: input.priority === "rush" ? 3 : 2,
      },
    });
  }

  const { data, error } = await (auth.admin as any).rpc(
    "submit_restaurant_order_with_priority_atomic",
    {
      p_organization_id: auth.device.organizationId,
      p_branch_id: auth.device.branchId,
      p_idempotency_key: input.idempotencyKey,
      p_items: input.items.map((item) => ({
        client_line_id: item.clientLineId,
        station_id: item.stationId,
        catalog_item_id: item.catalogItemId,
        quantity: item.quantity,
        notes: item.notes || null,
        allergens: item.allergens,
      })),
      p_restaurant_table_id: input.tableId || null,
      p_waiter_user_id: null,
      p_waiter_name: input.waiterName || auth.device.deviceName,
      p_customer_name: input.customerName || null,
      p_customer_phone: input.customerPhone || null,
      p_channel: input.channel,
      p_guest_count: input.guestCount || null,
      p_priority: input.priority,
      p_notes: input.notes || null,
      p_allergens: input.allergens,
      p_currency: input.currency,
      p_order_discount: 0,
      p_service_fee: 0,
      p_delivery_fee: 0,
      p_actor_user_id: null,
      p_actor_device_id: auth.device.id,
      p_submitted_at: new Date().toISOString(),
    },
  );
  if (error) {
    console.error("Restaurant order submission failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "فشل إرسال الطلب إلى المطبخ." },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, order: data });
}
