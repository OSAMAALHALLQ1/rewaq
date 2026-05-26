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

  return {
    id: user.id,
    email: user.email ?? "",
    role: (membership?.role as Role) ?? "staff",
    organizationId: membership?.organization_id ?? "",
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
  } catch {
    redirect(redirectTo);
  }
}

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
