import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOptionalSession } from "@/lib/auth/session";
import { ForbiddenError, requireSensitiveActionCapability } from "@/lib/auth/require-auth";

export async function PATCH(request: Request) {
  try {
    const session = await getOptionalSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "يجب تسجيل الدخول أولاً." },
        { status: 401 }
      );
    }

    if (!session.organizationId) {
      return NextResponse.json(
        { success: false, error: "حسابك مسجل دخول لكنه غير مربوط بأي مؤسسة." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { keyId } = body;

    if (!keyId) {
      return NextResponse.json(
        { success: false, error: "معرف المفتاح مطلوب." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Verify the key belongs to this organization
    const { data: existing } = await (admin as any)
      .from("department_api_keys")
      .select("id, organization_id, branch_id, is_active")
      .eq("id", keyId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "المفتاح غير موجود." },
        { status: 404 }
      );
    }

    if (existing.organization_id !== session.organizationId) {
      return NextResponse.json(
        { success: false, error: "لا يمكنك تعديل هذا المفتاح." },
        { status: 403 }
      );
    }

    try {
      requireSensitiveActionCapability(session, "device_write", existing.branch_id);
    } catch (error) {
      const message = error instanceof ForbiddenError ? error.message : "فقط مالك المؤسسة يستطيع إلغاء تنشيط المفاتيح.";
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }

    if (!existing.is_active) {
      return NextResponse.json(
        { success: false, error: "المفتاح ملغي بالفعل." },
        { status: 400 }
      );
    }

    const { error } = await (admin as any)
      .from("department_api_keys")
      .update({ is_active: false })
      .eq("id", keyId);

    if (error) {
      console.error("Error revoking key:", error);
      return NextResponse.json(
        { success: false, error: "فشل إلغاء المفتاح." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Department key revocation error:", err);
    return NextResponse.json(
      { success: false, error: "فشل إلغاء المفتاح بسبب مشكلة داخلية." },
      { status: 500 }
    );
  }
}
