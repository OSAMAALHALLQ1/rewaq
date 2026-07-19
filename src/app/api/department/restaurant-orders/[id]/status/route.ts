import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticateDepartmentDevice,
  requireDepartmentDeviceCapability,
} from "@/lib/department/auth";
import { canUseDemoFallback } from "@/lib/supabase/env";

const transitionSchema = z.object({
  targetStatus: z.enum(["preparing", "ready", "served"]),
  itemIds: z.array(z.string().uuid()).min(1).max(250),
  idempotencyKey: z.string().trim().min(8).max(48),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = transitionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "بيانات انتقال الطلب غير صحيحة." },
      { status: 400 },
    );
  }
  if (new Set(parsed.data.itemIds).size !== parsed.data.itemIds.length) {
    return NextResponse.json({ success: false, error: "قائمة العناصر تحتوي تكراراً." }, { status: 400 });
  }

  const requiredModule = parsed.data.targetStatus === "served" ? "expo" : "kitchen";
  const auth = await authenticateDepartmentDevice(request, requiredModule);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  if (!auth.device.branchId) {
    return NextResponse.json({ success: false, error: "الجهاز غير مربوط بفرع." }, { status: 403 });
  }
  const capability = requireDepartmentDeviceCapability(
    auth,
    parsed.data.targetStatus === "served" ? "expo_write" : "kitchen_write",
    auth.device.branchId,
  );
  if (!capability.ok) {
    return NextResponse.json(
      { success: false, error: capability.error },
      { status: capability.status },
    );
  }

  const { id: orderId } = await params;
  if (!z.string().uuid().safeParse(orderId).success) {
    return NextResponse.json({ success: false, error: "معرف الطلب غير صالح." }, { status: 400 });
  }
  if (canUseDemoFallback()) {
    return NextResponse.json({
      success: true,
      transition: {
        success: true,
        order_id: orderId,
        status: parsed.data.targetStatus === "served" ? "served" : parsed.data.targetStatus,
        target_item_status: parsed.data.targetStatus,
        item_count: parsed.data.itemIds.length,
      },
    });
  }

  const { data, error } = await (auth.admin as any).rpc(
    "transition_restaurant_order_items_bulk_atomic",
    {
      p_organization_id: auth.device.organizationId,
      p_branch_id: auth.device.branchId,
      p_order_id: orderId,
      p_order_item_ids: parsed.data.itemIds,
      p_to_status: parsed.data.targetStatus,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_actor_user_id: null,
      p_actor_device_id: auth.device.id,
      p_occurred_at: new Date().toISOString(),
    },
  );
  if (error) {
    console.error("Restaurant order bulk transition failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "تعذر تحديث حالة عناصر الطلب." },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, transition: data });
}
