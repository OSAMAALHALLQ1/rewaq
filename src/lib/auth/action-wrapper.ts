/**
 * Server Action Authorization Wrapper
 * 
 * Wraps server actions with organization and role validation.
 * Use this to protect server actions from unauthorized access.
 * 
 * @example
 * ```typescript
 * // Protect an action with organization access
 * export const createInventoryItemAction = withOrganizationAuth(
 *   async (formData: FormData, context) => {
 *     // context.organizationId is guaranteed to be valid
 *     const item = await createInventoryItem(context.organizationId, formData);
 *     return { ok: true, item };
 *   },
 *   { requiredRole: "inventory_manager" }
 * );
 * ```
 */
import "server-only";
import { requireAuth, type AuthenticatedUser } from "@/lib/auth/require-auth";
import {
  requireOrganizationAccess,
  requireRoleAccess,
  type OrganizationAccess,
} from "@/lib/auth/organization-access";

export type ActionContext = {
  user: AuthenticatedUser;
  access: OrganizationAccess;
};

export type ActionOptions = {
  /** Require minimum role level (default: 'staff') */
  requiredRole?: "super_admin" | "organization_owner" | "branch_manager" | "inventory_manager" | "purchasing_manager" | "marketing_manager" | "accountant" | "chef" | "cashier" | "staff";
  /** Allow organization owners to bypass role checks */
  allowOwnerBypass?: boolean;
};

/**
 * Wrap a server action with organization and role validation
 */
export function withOrganizationAuth<
  Args extends unknown[],
  Result extends { ok: boolean; message?: string }
>(
  handler: (args: Args, context: ActionContext) => Promise<Result>,
  options: ActionOptions = {}
) {
  return async (...args: Args): Promise<Result> => {
    try {
      // Step 1: Authenticate user
      const user = await requireAuth();

      // Step 2: Validate organization access
      if (!user.organizationId) {
        return { ok: false, message: "لم يتم ربطك بمؤسسة. تواصل مع الدعم." } as Result;
      }

      const access = await requireOrganizationAccess(user.organizationId);

      // Step 3: Check role if required
      if (options.requiredRole && options.requiredRole !== "staff") {
        // Owner bypass: organization owners can do almost anything
        if (options.allowOwnerBypass && access.isOwner) {
          // Allow
        } else if (access.role !== options.requiredRole && access.role !== "super_admin") {
          return { 
            ok: false, 
            message: `يتطلب هذا الإجراء صلاحية ${options.requiredRole} على الأقل` 
          } as Result;
        }
      }

      // Step 4: Execute handler with context
      return await handler(args, { user, access });
    } catch (error) {
      console.error("[withOrganizationAuth]", error);
      
      if (error instanceof Error) {
        return { ok: false, message: error.message } as Result;
      }
      
      return { ok: false, message: "حدث خطأ غير متوقع" } as Result;
    }
  };
}

/**
 * Wrap a server action that requires super admin access
 */
export function withAdminAuth<
  Args extends unknown[],
  Result extends { ok: boolean; message?: string }
>(
  handler: (args: Args, context: ActionContext) => Promise<Result>
) {
  return async (...args: Args): Promise<Result> => {
    try {
      const user = await requireAuth();

      if (user.role !== "super_admin") {
        return { ok: false, message: "يتطلب هذا الإجراء صلاحيات مدير النظام" } as Result;
      }

      const access = await requireOrganizationAccess(user.organizationId);

      return await handler(args, { user, access });
    } catch (error) {
      console.error("[withAdminAuth]", error);
      
      if (error instanceof Error) {
        return { ok: false, message: error.message } as Result;
      }
      
      return { ok: false, message: "حدث خطأ غير متوقع" } as Result;
    }
  };
}

/**
 * Wrap a server action that requires branch-level access
 */
export function withBranchAuth<
  Args extends unknown[],
  Result extends { ok: boolean; message?: string }
>(
  handler: (args: Args, context: ActionContext) => Promise<Result>,
  options: ActionOptions = {}
) {
  return async (...args: Args): Promise<Result> => {
    try {
      const user = await requireAuth();

      if (!user.organizationId) {
        return { ok: false, message: "لم يتم ربطك بمؤسسة" } as Result;
      }

      // For branch-specific actions, we need to verify the user has branch access
      // The handler receives the branchId as first argument
      const branchId = args[0] as string | undefined;
      
      if (branchId && user.branchId && user.branchId !== branchId && !access.isOwner) {
        return { ok: false, message: "ليس لديك صلاحية على هذا الفرع" } as Result;
      }

      const access = await requireOrganizationAccess(user.organizationId);

      if (options.requiredRole && !access.isOwner && access.role !== options.requiredRole) {
        return { 
          ok: false, 
          message: `يتطلب هذا الإجراء صلاحية ${options.requiredRole}` 
        } as Result;
      }

      return await handler(args, { user, access });
    } catch (error) {
      console.error("[withBranchAuth]", error);
      
      if (error instanceof Error) {
        return { ok: false, message: error.message } as Result;
      }
      
      return { ok: false, message: "حدث خطأ غير متوقع" } as Result;
    }
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that a string is a valid UUID
 */
export function isValidUuid(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validate organization ID format and ownership
 */
export async function validateOrganizationId(
  organizationId: string
): Promise<{ valid: boolean; error?: string }> {
  if (!isValidUuid(organizationId)) {
    return { valid: false, error: "معرف المؤسسة غير صالح" };
  }

  const result = await validateOrganizationAccess(organizationId);
  
  if (!result.authorized) {
    return { valid: false, error: result.reason };
  }

  return { valid: true };
}

/**
 * Sanitize and validate input for server actions
 */
export function sanitizeInput(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  
  // Remove potential XSS payloads
  return value
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 1000); // Limit length
}