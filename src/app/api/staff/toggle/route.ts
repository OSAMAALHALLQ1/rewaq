import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseDemoFallback, hasSupabaseAdminEnv } from "@/lib/supabase/env";
import { getOptionalSession } from "@/lib/auth/session";
import { ForbiddenError, requireSensitiveActionCapability } from "@/lib/auth/require-auth";

export async function PATCH(request: Request) {
  const session = await getOptionalSession();
  if (!session || !session.organizationId) {
    return NextResponse.json({ success: false, error: "يجب تسجيل الدخول أولاً." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const staffId = String(body.staffId || "");
  const action = body.action === "delete" ? "archive" : "toggle";

  if (!staffId) {
    return NextResponse.json({ success: false, error: "معرف الموظف مطلوب." }, { status: 400 });
  }

  if (!hasSupabaseAdminEnv()) {
    if (canUseDemoFallback()) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json(
      { success: false, error: "إعداد Supabase الإداري غير مكتمل." },
      { status: 503 },
    );
  }

  const admin = createAdminClient();

  const { data: staff, error: staffReadError } = await (admin as any)
    .from("staff_members")
    .select("is_active, branch_id")
    .eq("id", staffId)
    .eq("organization_id", session.organizationId)
    .maybeSingle();

  if (staffReadError || !staff) {
    return NextResponse.json({ success: false, error: "الموظف غير موجود." }, { status: 404 });
  }

  try {
    requireSensitiveActionCapability(session, "staff_write", staff.branch_id);
  } catch (error) {
    const message = error instanceof ForbiddenError ? error.message : "ليس لديك صلاحية تعديل الموظفين.";
    return NextResponse.json({ success: false, error: message }, { status: 403 });
  }

  if (action === "archive") {
    const { error } = await (admin as any)
      .from("staff_members")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", staffId)
      .eq("organization_id", session.organizationId);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } else {
    const current = staff;

    const { error } = await (admin as any)
      .from("staff_members")
      .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
      .eq("id", staffId)
      .eq("organization_id", session.organizationId);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
