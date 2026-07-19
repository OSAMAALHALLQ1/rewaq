import "server-only";

import { createHash } from "crypto";
import { cookies } from "next/headers";
import { isRewaqModule, type RewaqModule } from "@/lib/billing/plans";
import { createAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { isDemoModeEnabled } from "@/lib/supabase/env";
import {
  SubscriptionEntitlementError,
  requireOrganizationModule,
} from "@/server/billing/entitlements";

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

const DEPARTMENT_CAPABILITY_ROLES = {
  // الكاشير يبيع فقط؛ الإرجاع والخصم وتعديل السعر للمدير.
  pos_write: new Set(["cashier", "manager"]),
  pos_refund: new Set(["manager"]),
  pos_discount: new Set(["manager"]),
  pos_price_edit: new Set(["manager"]),
  pos_shift: new Set(["cashier", "manager"]),
  pos_hold: new Set(["cashier", "manager"]),
  pos_read: new Set(["cashier", "manager", "staff"]),
  kitchen_write: new Set(["chef", "kitchen", "manager", "staff"]),
  waiter_write: new Set(["cashier", "manager", "staff"]),
  expo_write: new Set(["chef", "kitchen", "manager", "staff"]),
  inventory_write: new Set(["inventory_manager", "manager"]),
} as const;

const DEPARTMENT_MODULE_ENTITLEMENTS: Readonly<Record<string, RewaqModule>> = {
  waiter: "restaurant_workflow",
  orders: "restaurant_workflow",
  kitchen: "restaurant_workflow",
  kds: "restaurant_workflow",
  expo: "restaurant_workflow",
};

export type DepartmentDeviceCapability = keyof typeof DEPARTMENT_CAPABILITY_ROLES;

export function requireDepartmentDeviceCapability(
  auth: DepartmentAuthResult,
  capability: DepartmentDeviceCapability,
  targetBranchId?: string | null,
): DepartmentAuthResult {
  if (!auth.ok) return auth;

  if (!DEPARTMENT_CAPABILITY_ROLES[capability].has(auth.device.role)) {
    return { ok: false, status: 403, error: "دور هذا الجهاز لا يسمح بهذه العملية." };
  }

  if (targetBranchId !== undefined && auth.device.branchId !== targetBranchId) {
    return { ok: false, status: 403, error: "هذا الجهاز غير مخول للعمل على هذا الفرع." };
  }

  return auth;
}

export async function authenticateDepartmentDevice(
  request: Request,
  requiredModule?: string,
): Promise<DepartmentAuthResult> {
  if (!hasSupabaseAdminEnv()) {
    if (!isDemoModeEnabled()) {
      return { ok: false, status: 503, error: "إعداد Supabase الإداري غير مكتمل." };
    }

    return {
      ok: true,
      admin: null as any,
      device: {
        id: "demo-device-id",
        organizationId: "00000000-0000-4000-8000-000000000001",
        branchId: "00000000-0000-4000-8000-000000000101",
        role: "manager",
        deviceName: "جهاز كاشير تجريبي",
        allowedModules: ["pos", "inventory", "recipes", "waste", "waiter", "kitchen", "expo"],
      },
    };
  }

  const cookieStore = await cookies();
  const cookieKey = cookieStore.get("rwq_dept_token")?.value;
  const rawKey = request.headers.get("x-department-key") || request.headers.get("x-api-key") || cookieKey;
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

  const commercialModule = requiredModule
    ? (isRewaqModule(requiredModule) ? requiredModule : DEPARTMENT_MODULE_ENTITLEMENTS[requiredModule])
    : undefined;

  if (commercialModule) {
    try {
      await requireOrganizationModule(admin, data.organization_id, commercialModule);
    } catch (entitlementError) {
      if (entitlementError instanceof SubscriptionEntitlementError) {
        return { ok: false, status: 403, error: entitlementError.message };
      }

      console.error(
        "[department-entitlements]",
        entitlementError instanceof Error ? entitlementError.message : entitlementError,
      );
      return {
        ok: false,
        status: 503,
        error: "تعذر التحقق من باقة المؤسسة. لم يتم فتح الشاشة أو تنفيذ العملية.",
      };
    }
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
