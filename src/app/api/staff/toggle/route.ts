import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";
import { getOptionalSession } from "@/lib/auth/session";

export async function PATCH(request: Request) {
  const session = await getOptionalSession();
  if (!session || !session.organizationId) {
    return NextResponse.json({ success: false, error: "يجب تسجيل الدخول أولاً." }, { status: 401 });
  }

  if (session.role !== "organization_owner" && session.role !== "branch_manager" && session.role !== "super_admin") {
    return NextResponse.json({ success: false, error: "ليس لديك صلاحية تعديل الموظفين." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const staffId = String(body.staffId || "");
  const action = body.action === "delete" ? "delete" : "toggle";

  if (!staffId) {
    return NextResponse.json({ success: false, error: "معرف الموظف مطلوب." }, { status: 400 });
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ success: true });
  }

  const admin = createAdminClient();

  if (action === "delete") {
    const { error } = await (admin as any)
      .from("staff_members")
      .delete()
      .eq("id", staffId)
      .eq("organization_id", session.organizationId);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } else {
    const { data: current } = await (admin as any)
      .from("staff_members")
      .select("is_active")
      .eq("id", staffId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    if (!current) {
      return NextResponse.json({ success: false, error: "الموظف غير موجود." }, { status: 404 });
    }

    const { error } = await (admin as any)
      .from("staff_members")
      .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
      .eq("id", staffId)
      .eq("organization_id", session.organizationId);

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
