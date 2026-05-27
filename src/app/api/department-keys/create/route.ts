import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOptionalSession } from "@/lib/auth/session";

function generateRawKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let key = "RWQ_";
  for (let i = 0; i < 6; i++) {
    key += chars[bytes[i] % chars.length];
  }
  return key;
}

export async function POST(request: Request) {
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
        { success: false, error: "حسابك مسجل دخول لكنه غير مربوط بأي مؤسسة. اعتمد الحساب أو أضفه إلى organization_memberships أولاً." },
        { status: 403 }
      );
    }

    if (session.role !== "organization_owner" && session.role !== "super_admin") {
      return NextResponse.json(
        { success: false, error: "فقط مدير المطعم يمكنه إنشاء مفاتيح وصول جديدة." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { deviceName, branchId, role, allowedModules } = body;

    if (!deviceName || typeof deviceName !== "string") {
      return NextResponse.json(
        { success: false, error: "اسم الجهاز مطلوب." },
        { status: 400 }
      );
    }

    const rawKey = generateRawKey();
    const keyHash = createHash("sha256").update(rawKey).digest("hex");

    const admin = createAdminClient();
    const { data, error } = await (admin as any)
      .from("department_api_keys")
      .insert({
        organization_id: session.organizationId,
        branch_id: branchId || null,
        device_name: deviceName,
        key_hash: keyHash,
        role: role || "staff",
        allowed_modules: allowedModules || [],
        created_by: session.user.id,
      })
      .select("id, device_name, role, allowed_modules, is_active, created_at")
      .single();

    if (error) {
      console.error("Error creating department key:", error);
      return NextResponse.json(
        { success: false, error: "فشل إنشاء مفتاح الوصول." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      key: rawKey,
      keyId: data.id,
      deviceName: data.device_name,
    });
  } catch (err: any) {
    console.error("Department key creation error:", err);
    return NextResponse.json(
      { success: false, error: "فشل إنشاء مفتاح الوصول بسبب مشكلة داخلية." },
      { status: 500 }
    );
  }
}
