import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateDepartmentDevice, requireDepartmentDeviceCapability } from "@/lib/department/auth";

// In-memory held orders (per-device, survives only within server process)
const heldOrders = new Map<string, any[]>();

const holdSchema = z.object({
  customerName: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    catalogItemId: z.string(),
    name: z.string(),
    price: z.coerce.number(),
    qty: z.coerce.number().positive(),
    taxRate: z.coerce.number().default(0),
    discount: z.coerce.number().default(0),
  })).min(1),
});

function getDeviceOrders(deviceId: string): any[] {
  if (!heldOrders.has(deviceId)) heldOrders.set(deviceId, []);
  return heldOrders.get(deviceId)!;
}

export async function GET(request: Request) {
  const auth = await authenticateDepartmentDevice(request, "pos");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  const orders = getDeviceOrders(auth.device.id);
  return NextResponse.json({ success: true, orders, count: orders.length });
}

export async function POST(request: Request) {
  const auth = await authenticateDepartmentDevice(request, "pos");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const cap = requireDepartmentDeviceCapability(auth, "pos_hold");
  if (!cap.ok) {
    return NextResponse.json({ success: false, error: cap.error }, { status: cap.status });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = holdSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" }, { status: 400 });
  }

  const orders = getDeviceOrders(auth.device.id);
  if (orders.length >= 10) {
    return NextResponse.json({ success: false, error: "الحد الأقصى للطلبات المعلقة 10" }, { status: 400 });
  }

  const holdId = `hold-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const total = parsed.data.items.reduce((s, i) => s + i.price * i.qty * (1 - i.discount / 100) * (1 + i.taxRate / 100), 0);

  const order = {
    id: holdId,
    customerName: parsed.data.customerName || "عميل",
    notes: parsed.data.notes || "",
    items: parsed.data.items,
    total,
    itemCount: parsed.data.items.reduce((s, i) => s + i.qty, 0),
    heldAt: new Date().toISOString(),
  };

  orders.push(order);
  return NextResponse.json({ success: true, order });
}

export async function DELETE(request: Request) {
  const auth = await authenticateDepartmentDevice(request, "pos");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const holdId = url.searchParams.get("id");
  if (!holdId) {
    return NextResponse.json({ success: false, error: "معرف الطلب المعلق مطلوب" }, { status: 400 });
  }

  const orders = getDeviceOrders(auth.device.id);
  const idx = orders.findIndex((o) => o.id === holdId);
  if (idx === -1) {
    return NextResponse.json({ success: false, error: "الطلب المعلق غير موجود" }, { status: 404 });
  }

  const [removed] = orders.splice(idx, 1);
  return NextResponse.json({ success: true, removedOrder: removed });
}
