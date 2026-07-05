import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateDepartmentDevice, requireDepartmentDeviceCapability } from "@/lib/department/auth";

const statusSchema = z.object({
  status: z.enum(["pending", "preparing", "ready", "served", "cancelled"]),
});

const timestampByStatus: Record<string, string | null> = {
  pending: null,
  preparing: "started_at",
  ready: "ready_at",
  served: "served_at",
  cancelled: null,
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateDepartmentDevice(request, "recipes");

  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const parsed = statusSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "حالة الطلب غير صحيحة." },
      { status: 400 },
    );
  }

  if (!auth.device.branchId) {
    return NextResponse.json(
      { success: false, error: "لا يمكن تحديث تذكرة مطبخ بدون ربط الجهاز بفرع محدد." },
      { status: 403 },
    );
  }

  const capability = requireDepartmentDeviceCapability(auth, "kitchen_write", auth.device.branchId);
  if (!capability.ok) {
    return NextResponse.json({ success: false, error: capability.error }, { status: capability.status });
  }

  const updates: Record<string, string | null> = {
    status: parsed.data.status,
    updated_at: new Date().toISOString(),
  };
  const timestampColumn = timestampByStatus[parsed.data.status];
  if (timestampColumn) {
    updates[timestampColumn] = new Date().toISOString();
  }

  const { data: ticket, error } = await (auth.admin as any)
    .from("kitchen_tickets")
    .update(updates)
    .eq("id", id)
    .eq("organization_id", auth.device.organizationId)
    .eq("branch_id", auth.device.branchId)
    .select("id, status, started_at, ready_at, served_at")
    .single();

  if (error || !ticket) {
    return NextResponse.json({ success: false, error: error?.message ?? "تعذر تحديث الطلب." }, { status: 500 });
  }

  const { error: itemsError } = await (auth.admin as any)
    .from("kitchen_ticket_items")
    .update({ status: parsed.data.status })
    .eq("organization_id", auth.device.organizationId)
    .eq("kitchen_ticket_id", id);

  if (itemsError) {
    return NextResponse.json({ success: false, error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, ticket });
}
