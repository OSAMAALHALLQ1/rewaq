import "server-only";

import { createHash } from "crypto";
import { createAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

export type DepartmentDeviceContext = {
  id: string;
  organizationId: string;
  branchId: string | null;
  role: string;
  deviceName: string;
  allowedModules: string[];
};

export type DepartmentAuthResult =
  | { ok: true; admin: ReturnType<typeof createAdminClient>; device: DepartmentDeviceContext }
  | { ok: false; status: number; error: string };

export async function authenticateDepartmentDevice(
  request: Request,
  requiredModule?: string,
): Promise<DepartmentAuthResult> {
  if (!hasSupabaseAdminEnv()) {
    // Return mock session in Demo/Simulation mode!
    return {
      ok: true,
      admin: null as any,
      device: {
        id: "demo-device-id",
        organizationId: "00000000-0000-4000-8000-000000000001",
        branchId: "00000000-0000-4000-8000-000000000101",
        role: "cashier",
        deviceName: "جهاز كاشير تجريبي",
        allowedModules: ["pos", "inventory", "recipes", "waste"],
      },
    };
  }

  const rawKey = request.headers.get("x-department-key") || request.headers.get("x-api-key");
  const normalizedKey = rawKey?.trim().toUpperCase();

  if (!normalizedKey || normalizedKey.length !== 10) {
    return { ok: false, status: 401, error: "رمز الجهاز غير صالح." };
  }

  const admin = createAdminClient();
  const keyHash = createHash("sha256").update(normalizedKey).digest("hex");
  const { data, error } = await (admin as any)
    .from("department_api_keys")
    .select("id, organization_id, branch_id, device_name, role, allowed_modules, is_active")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }

  if (!data || !data.is_active) {
    return { ok: false, status: 401, error: "رمز الجهاز غير موجود أو غير مفعل." };
  }

  const allowedModules = Array.isArray(data.allowed_modules) ? data.allowed_modules.map(String) : [];

  if (requiredModule && !allowedModules.includes(requiredModule)) {
    return { ok: false, status: 403, error: "هذا الجهاز لا يملك صلاحية هذه الشاشة." };
  }

  await (admin as any)
    .from("department_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    ok: true,
    admin,
    device: {
      id: data.id,
      organizationId: data.organization_id,
      branchId: data.branch_id,
      role: data.role,
      deviceName: data.device_name,
      allowedModules,
    },
  };
}
