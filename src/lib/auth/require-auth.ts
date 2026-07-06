import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import type { Role } from "@/types/domain";

export class AuthenticationError extends Error {
  constructor(message = "يجب تسجيل الدخول أولاً") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "ليس لديك صلاحية للوصول إلى هذا المورد") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: Role;
  organizationId: string;
  branchId?: string;
};

type CapabilitySubject = Pick<AuthenticatedUser, "role" | "branchId">;

export type SensitiveCapability =
  | "sales_write"
  | "shift_close"
  | "inventory_catalog_write"
  | "inventory_movement_write"
  | "purchasing_write"
  | "recipe_write"
  | "menu_write"
  | "staff_write"
  | "device_write"
  | "branch_write"
  | "accounting_write"
  | "expense_write"
  | "period_close"
  | "accounting_settings_write";

const CAPABILITY_ROLES: Record<SensitiveCapability, readonly Role[]> = {
  sales_write: ["super_admin", "organization_owner", "branch_manager", "cashier", "accountant"],
  shift_close: ["super_admin", "organization_owner", "branch_manager", "cashier"],
  inventory_catalog_write: ["super_admin", "organization_owner", "branch_manager", "inventory_manager"],
  inventory_movement_write: ["super_admin", "organization_owner", "branch_manager", "inventory_manager"],
  purchasing_write: ["super_admin", "organization_owner", "branch_manager", "purchasing_manager", "accountant"],
  recipe_write: ["super_admin", "organization_owner", "branch_manager", "chef"],
  menu_write: ["super_admin", "organization_owner", "branch_manager", "chef"],
  staff_write: ["super_admin", "organization_owner", "branch_manager"],
  device_write: ["super_admin", "organization_owner"],
  branch_write: ["super_admin", "organization_owner"],
  // ERP layer: journal entries, chart of accounts, cost centers — never cashiers.
  accounting_write: ["super_admin", "organization_owner", "accountant"],
  expense_write: ["super_admin", "organization_owner", "accountant", "branch_manager"],
  period_close: ["super_admin", "organization_owner", "accountant"],
  // Core accounting configuration stays with the owner/admin per the ERP strategy.
  accounting_settings_write: ["super_admin", "organization_owner"],
};

function getApprovalStatus(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }) {
  const appStatus = user.app_metadata?.approval_status;
  if (typeof appStatus === "string") {
    return appStatus;
  }

  const userStatus = user.user_metadata?.approval_status;
  return typeof userStatus === "string" ? userStatus : undefined;
}

/**
 * Require authentication. Throws if not logged in.
 * Use in Server Actions and Route Handlers where auth is mandatory.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  if (!hasSupabaseEnv()) {
    throw new AuthenticationError("Supabase غير مهيأ. تأكد من متغيرات البيئة.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthenticationError();
  }

  // Fetch user's role and organization from the database
  const { data: membership } = await (supabase as any)
    .from("organization_memberships")
    .select("organization_id, role, branch_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const approvalStatus = getApprovalStatus(user);
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.status && String(profile.status) !== "approved") {
    throw new ForbiddenError("حسابك بانتظار موافقة الإدارة قبل فتح النظام.");
  }

  if (!membership?.organization_id && approvalStatus && approvalStatus !== "approved") {
    throw new ForbiddenError("حسابك بانتظار موافقة الإدارة قبل فتح النظام.");
  }

  const metadataOrganizationId =
    typeof user.app_metadata?.organization_id === "string" ? user.app_metadata.organization_id : "";
  const organizationId = membership?.organization_id ?? metadataOrganizationId;

  if (!organizationId) {
    throw new ForbiddenError("لم يتم ربط حسابك بمؤسسة بعد. انتظر موافقة الإدارة.");
  }

  return {
    id: user.id,
    email: user.email ?? "",
    role: (membership?.role as Role) ?? ((typeof user.app_metadata?.role === "string" ? user.app_metadata.role : "staff") as Role),
    organizationId,
    branchId: membership?.branch_id ?? undefined,
  };
}

/**
 * Require authentication + redirect to login if not authenticated.
 * Use in Server Components and Pages.
 */
export async function requireAuthOrRedirect(redirectTo = "/login"): Promise<AuthenticatedUser> {
  try {
    return await requireAuth();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      redirect("/pending-approval");
    }
    redirect(redirectTo);
  }
}

/**

/**
 * Get current user without throwing. Returns null if not authenticated.
 * Use for optional auth checks where the action can proceed without a user.
 */
export async function getOptionalUser(): Promise<AuthenticatedUser | null> {
  try {
    return await requireAuth();
  } catch {
    return null;
  }
}

/**
 * Require user to have specific role capabilities.
 * Throws ForbiddenError if user doesn't have required role.
 */
export function requireRoleCapability(user: CapabilitySubject, allowedRoles: readonly Role[]) {
  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError("ليس لديك الصلاحية الكافية لإتمام هذه العملية.");
  }
}

/**
 * Require user to have access to specific branch.
 * Throws ForbiddenError if user has a scoped branch and it doesn't match the requested branch.
 */
export function requireBranchCapability(user: CapabilitySubject, targetBranchId: string | null) {
  if (user.role === "super_admin" || user.role === "organization_owner") {
    // Owners and Super Admins can access any branch
    return;
  }

  if (!targetBranchId) {
    throw new ForbiddenError("هذه العملية تحتاج فرعًا محددًا ضمن صلاحياتك.");
  }

  if (!user.branchId || user.branchId !== targetBranchId) {
    throw new ForbiddenError("لا تملك الصلاحية لإجراء عمليات خارج فرعك المخصص.");
  }
}

/**
 * Require role capability and, when provided, branch scope for sensitive writes.
 */
export function requireSensitiveActionCapability(
  user: CapabilitySubject,
  capability: SensitiveCapability,
  targetBranchId?: string | null,
) {
  requireRoleCapability(user, CAPABILITY_ROLES[capability]);

  if (targetBranchId !== undefined) {
    requireBranchCapability(user, targetBranchId);
  }
}
