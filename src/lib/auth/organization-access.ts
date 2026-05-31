/**
 * Organization context and authorization helpers
 * 
 * Provides middleware functions for validating organization access,
 * checking branch permissions, and enforcing RLS policies at the application level.
 */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv, hasSupabaseAdminEnv } from "@/lib/supabase/env";
import type { Role } from "@/types/domain";

// ============================================================================
// Types
// ============================================================================

export type OrganizationAccess = {
  organizationId: string;
  branchId?: string;
  role: Role;
  isOwner: boolean;
  isSuperAdmin: boolean;
};

export type AuthorizationResult = 
  | { authorized: true; access: OrganizationAccess }
  | { authorized: false; reason: string };

// ============================================================================
// Role Hierarchy
// ============================================================================

const ROLE_HIERARCHY: Record<Role, number> = {
  super_admin: 100,
  organization_owner: 90,
  branch_manager: 70,
  inventory_manager: 60,
  purchasing_manager: 60,
  marketing_manager: 60,
  accountant: 50,
  chef: 40,
  cashier: 30,
  staff: 10,
};

/**
 * Check if a role has at least the specified permission level
 */
export function hasRoleLevel(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// ============================================================================
// Organization Context Resolution
// ============================================================================

/**
 * Get organization access from the current user session
 */
export async function getOrganizationAccess(): Promise<OrganizationAccess | null> {
  if (!hasSupabaseEnv()) {
    return null;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data: membership } = await (supabase as any)
      .from("organization_memberships")
      .select("organization_id, role, branch_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership?.organization_id) {
      return null;
    }

    const role = (membership.role as Role) ?? "staff";

    return {
      organizationId: membership.organization_id,
      branchId: membership.branch_id ?? undefined,
      role,
      isOwner: role === "organization_owner",
      isSuperAdmin: role === "super_admin",
    };
  } catch {
    return null;
  }
}

/**
 * Validate that the current user has access to a specific organization
 */
export async function validateOrganizationAccess(organizationId: string): Promise<AuthorizationResult> {
  const access = await getOrganizationAccess();

  if (!access) {
    return { authorized: false, reason: "غير مصرح - يجب تسجيل الدخول" };
  }

  if (access.isSuperAdmin) {
    // Super admins can access all organizations
    return { authorized: true, access };
  }

  if (access.organizationId !== organizationId) {
    return { authorized: false, reason: "ليس لديك صلاحية على هذه المؤسسة" };
  }

  return { authorized: true, access };
}

/**
 * Validate that the current user has access to a specific branch
 */
export async function validateBranchAccess(branchId: string): Promise<AuthorizationResult> {
  const access = await getOrganizationAccess();

  if (!access) {
    return { authorized: false, reason: "غير مصرح - يجب تسجيل الدخول" };
  }

  // Super admin and org owner can access all branches
  if (access.isSuperAdmin || access.isOwner) {
    return { authorized: true, access };
  }

  // Check if user's branch matches the requested branch
  if (access.branchId === branchId) {
    return { authorized: true, access };
  }

  return { authorized: false, reason: "ليس لديك صلاحية على هذا الفرع" };
}

// ============================================================================
// Authorization Guards for Server Actions
// ============================================================================

/**
 * Require organization access for server actions
 * Throws an error if the user doesn't have access
 */
export async function requireOrganizationAccess(organizationId: string): Promise<OrganizationAccess> {
  const result = await validateOrganizationAccess(organizationId);

  if (!result.authorized) {
    throw new Error(result.reason);
  }

  return result.access;
}

/**
 * Require specific role level for server actions
 */
export async function requireRoleAccess(
  organizationId: string,
  requiredRole: Role
): Promise<OrganizationAccess> {
  const access = await requireOrganizationAccess(organizationId);

  if (!hasRoleLevel(access.role, requiredRole)) {
    throw new Error(`يتطلب هذا الإجراء صلاحية ${requiredRole} على الأقل`);
  }

  return access;
}

/**
 * Require branch access for server actions
 */
export async function requireBranchAccess(branchId: string): Promise<OrganizationAccess> {
  const result = await validateBranchAccess(branchId);

  if (!result.authorized) {
    throw new Error(result.reason);
  }

  return result.access;
}

// ============================================================================
// Permission Check Helpers
// ============================================================================

/**
 * Check if user can perform inventory operations
 */
export function canManageInventory(role: Role): boolean {
  return hasRoleLevel(role, "inventory_manager");
}

/**
 * Check if user can perform purchasing operations
 */
export function canManagePurchasing(role: Role): boolean {
  return hasRoleLevel(role, "purchasing_manager");
}

/**
 * Check if user can manage marketing
 */
export function canManageMarketing(role: Role): boolean {
  return hasRoleLevel(role, "marketing_manager");
}

/**
 * Check if user can view financial reports
 */
export function canViewFinancialReports(role: Role): boolean {
  return hasRoleLevel(role, "accountant");
}

/**
 * Check if user can manage users
 */
export function canManageUsers(role: Role): boolean {
  return hasRoleLevel(role, "branch_manager");
}

/**
 * Check if user can approve account requests (super_admin only)
 */
export function canApproveAccounts(role: Role): boolean {
  return role === "super_admin";
}

// ============================================================================
// API Key Validation (for external integrations)
// ============================================================================

/**
 * Validate API key for external integrations
 */
export async function validateApiKey(apiKey: string | null): Promise<{
  valid: boolean;
  organizationId?: string;
  userId?: string;
  error?: string;
}> {
  if (!apiKey || !hasSupabaseAdminEnv()) {
    return { valid: false, error: "API key not provided" };
  }

  try {
    const admin = createAdminClient();
    
    // Look up API key in department_keys table
    const { data: keyRecord } = await (admin as any)
      .from("department_keys")
      .select("organization_id, user_id, permissions, expires_at")
      .eq("key_hash", hashApiKey(apiKey))
      .maybeSingle();

    if (!keyRecord) {
      return { valid: false, error: "Invalid API key" };
    }

    // Check expiration
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return { valid: false, error: "API key has expired" };
    }

    return {
      valid: true,
      organizationId: keyRecord.organization_id,
      userId: keyRecord.user_id,
    };
  } catch (error) {
    return { valid: false, error: "Failed to validate API key" };
  }
}

/**
 * Simple hash function for API keys (in production, use proper cryptographic hashing)
 */
function hashApiKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// ============================================================================
// Resource Ownership Validation
// ============================================================================

/**
 * Validate that a resource belongs to the user's organization
 */
export async function validateResourceOwnership(
  resourceType: "inventory" | "purchase_order" | "recipe" | "social_post" | "invoice",
  resourceId: string,
  organizationId: string
): Promise<boolean> {
  if (!hasSupabaseEnv()) {
    return false;
  }

  try {
    const admin = createAdminClient();
    const tableMap: Record<string, string> = {
      inventory: "inventory_items",
      purchase_order: "purchase_orders",
      recipe: "recipes",
      social_post: "social_posts",
      invoice: "invoices",
    };

    const table = tableMap[resourceType];
    if (!table) {
      return false;
    }

    const { data } = await admin
      .from(table)
      .select("organization_id")
      .eq("id", resourceId)
      .maybeSingle();

    return data?.organization_id === organizationId;
  } catch {
    return false;
  }
}