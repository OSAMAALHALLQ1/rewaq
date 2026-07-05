import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOptionalSession } from "@/lib/auth/session";
import { ForbiddenError, requireSensitiveActionCapability } from "@/lib/auth/require-auth";

const allowedRoles = new Set(["chef", "cashier", "inventory_manager", "staff"]);
const allowedModuleKeys = new Set(["inventory", "recipes", "purchasing", "waste", "pos", "reports"]);
const roleModuleAllowlist: Record<string, Set<string>> = {
  chef: new Set(["recipes", "inventory", "waste"]),
  cashier: new Set(["pos"]),
  inventory_manager: new Set(["inventory", "purchasing", "waste", "reports"]),
  staff: new Set(["inventory", "recipes", "waste", "pos"]),
};

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

    const body = await request.json();
    const { deviceName, branchId, role, allowedModules } = body;
    const normalizedRole = typeof role === "string" && allowedRoles.has(role) ? role : "staff";
    const requestedModules = Array.isArray(allowedModules)
      ? [...new Set(allowedModules.filter((module): module is string => typeof module === "string"))]
      : [];
    const permittedForRole = roleModuleAllowlist[normalizedRole] ?? roleModuleAllowlist.staff;
    const normalizedModules = requestedModules.filter(
      (module) => allowedModuleKeys.has(module) && permittedForRole.has(module),
    );

    if (!deviceName || typeof deviceName !== "string") {
      return NextResponse.json(
        { success: false, error: "اسم الجهاز مطلوب." },
        { status: 400 }
      );
    }

    try {
      requireSensitiveActionCapability(session, "device_write", branchId || null);
    } catch (error) {
      const message = error instanceof ForbiddenError ? error.message : "فقط مالك المؤسسة يستطيع إنشاء مفاتيح وصول جديدة.";
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }

    if (normalizedModules.length === 0) {
      return NextResponse.json(
        { success: false, error: "يجب اختيار صلاحية واحدة على الأقل مناسبة لدور الجهاز." },
        { status: 400 }
      );
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
        return NextResponse.json(
          { success: false, error: "تعذر التحقق من الفرع." },
          { status: 500 }
        );
      }

      if (!branch) {
        return NextResponse.json(
          { success: false, error: "الفرع المحدد غير موجود داخل مؤسستك." },
          { status: 400 }
        );
      }
    }

    const rawKey = generateRawKey();
    const keyHash = createHash("sha256").update(rawKey).digest("hex");

    const { data, error } = await (admin as any)
      .from("department_api_keys")
      .insert({
        organization_id: session.organizationId,
        branch_id: branchId || null,
        device_name: deviceName,
        key_hash: keyHash,
        role: normalizedRole,
        allowed_modules: normalizedModules,
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
