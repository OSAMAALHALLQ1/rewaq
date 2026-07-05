import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseDemoFallback, hasSupabaseAdminEnv } from "@/lib/supabase/env";
import { getOptionalSession } from "@/lib/auth/session";
import { ForbiddenError, requireSensitiveActionCapability } from "@/lib/auth/require-auth";

const allowedRoles = new Set(["waiter", "cashier", "kitchen", "bar", "shisha", "manager"]);
// Tekka-style role -> login code prefix.
const ROLE_PREFIX: Record<string, string> = {
  waiter: "W",
  cashier: "C",
  kitchen: "K",
  bar: "B",
  shisha: "S",
  manager: "M",
};

function generateLoginCode(role: string): string {
  const prefix = ROLE_PREFIX[role] ?? "E";
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${digits}`;
}

export async function POST(request: Request) {
  const session = await getOptionalSession();
  if (!session || !session.organizationId) {
    return NextResponse.json({ success: false, error: "يجب تسجيل الدخول أولاً." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const fullName = String(body.fullName || "").trim();
  const phone = String(body.phone || "").trim();
  const role = allowedRoles.has(body.role) ? body.role : "staff";
  const branchId = body.branchId || null;
  const linkedDeviceKeyId = body.linkedDeviceKeyId || null;

  if (!fullName) {
    return NextResponse.json({ success: false, error: "الاسم الكامل مطلوب." }, { status: 400 });
  }

  try {
    requireSensitiveActionCapability(session, "staff_write", branchId);
  } catch (error) {
    const message = error instanceof ForbiddenError ? error.message : "ليس لديك صلاحية إضافة موظفين.";
    return NextResponse.json({ success: false, error: message }, { status: 403 });
  }

  if (!hasSupabaseAdminEnv()) {
    if (!canUseDemoFallback()) {
      return NextResponse.json(
        { success: false, error: "إعداد Supabase الإداري غير مكتمل." },
        { status: 503 },
      );
    }

    return NextResponse.json({
      success: true,
      loginCode: generateLoginCode(role),
      staffMember: { id: `staff-demo-${Date.now()}`, full_name: fullName, phone, role, login_code: generateLoginCode(role), is_active: true },
    });
  }

  const admin = createAdminClient();

  if (branchId) {
    const { data: branch, error: branchError } = await (admin as any)
      .from("branches")
      .select("id")
      .eq("id", branchId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();

    if (branchError) {
      return NextResponse.json({ success: false, error: branchError.message }, { status: 500 });
    }

    if (!branch) {
      return NextResponse.json({ success: false, error: "الفرع المحدد غير تابع لهذه المؤسسة." }, { status: 403 });
    }
  }

  // Generate a unique login code per organization (retry on collision).
  let loginCode = generateLoginCode(role);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: existing } = await (admin as any)
      .from("staff_members")
      .select("id")
      .eq("organization_id", session.organizationId)
      .eq("login_code", loginCode)
      .maybeSingle();

    if (!existing) break;
    loginCode = generateLoginCode(role);
  }

  const { data, error } = await (admin as any)
    .from("staff_members")
    .insert({
      organization_id: session.organizationId,
      branch_id: branchId,
      full_name: fullName,
      phone: phone || null,
      role,
      login_code: loginCode,
      linked_device_key_id: linkedDeviceKeyId,
      is_active: true,
      created_by: session.user.id,
    })
    .select("id, full_name, phone, role, login_code, is_active")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, loginCode, staffMember: data });
}
