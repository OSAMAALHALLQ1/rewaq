import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import type { Role } from "@/types/domain";

export type AppSession = {
  user: {
    id: string;
    email: string;
    name: string;
  };
  organizationId: string;
  organizationName: string;
  branchId?: string;
  branchName?: string;
  role: Role;
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
 * Get the current authenticated session. Redirects to /login if not authenticated.
 * Use in Server Components where the page requires authentication.
 */
export async function getCurrentSession(): Promise<AppSession> {
  if (!hasSupabaseEnv()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // Fetch membership and organization details from DB. Some deployed RLS setups
  // can block the membership read, so keep the approved auth metadata as a fallback.
  const { data: membership } = await (supabase as any)
    .from("organization_memberships")
    .select("organization_id, role, branch_id, organizations(name)")
    .eq("user_id", user.id)
    .maybeSingle();

  const approvalStatus = getApprovalStatus(user);
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.status && String(profile.status) !== "approved") {
    redirect("/pending-approval");
  }

  if (!membership?.organization_id && approvalStatus && approvalStatus !== "approved") {
    redirect("/pending-approval");
  }

  const metadataOrganizationId =
    typeof user.app_metadata?.organization_id === "string" ? user.app_metadata.organization_id : "";
  const organizationId = membership?.organization_id ?? metadataOrganizationId;

  if (!organizationId) {
    redirect("/pending-approval");
  }

  const { data: org } = membership?.organization_id
    ? await (supabase as any)
        .from("organizations")
        .select("name")
        .eq("id", membership.organization_id)
        .single()
    : { data: null };

  const metadataRole = typeof user.app_metadata?.role === "string" ? user.app_metadata.role : undefined;

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      name: user.user_metadata?.name ?? user.email ?? "مستخدم",
    },
    organizationId,
    organizationName: org?.name ?? "",
    branchId: membership?.branch_id ?? undefined,
    branchName: undefined,
    role: ((membership?.role ?? metadataRole) as Role) ?? "staff",
  };
}

/**
 * Get the current session without redirect. Returns null if not authenticated.
 * Use in layouts or pages where auth is optional.
 */
export async function getOptionalSession(): Promise<AppSession | null> {
  if (!hasSupabaseEnv()) {
    return null;
  }

  try {
    return await getCurrentSession();
  } catch {
    return null;
  }
}
