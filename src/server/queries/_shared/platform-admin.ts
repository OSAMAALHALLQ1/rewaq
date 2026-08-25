/**
 * Server-only access boundary for the platform administration console.
 *
 * Platform admins authenticate with the signed `admin_session` cookie. They
 * are intentionally not scoped to a customer organization, so this must not
 * use the tenant-oriented `withAdminScope` helper.
 */
import "server-only";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";

export type PlatformAdminClient = ReturnType<typeof createAdminClient>;

export async function requirePlatformAdminSession() {
  return requireAdminSession();
}

/**
 * Loads cross-organization platform data only for a verified platform-admin
 * session. This is deliberately separate from organization scope resolution.
 */
export async function withPlatformAdmin<T>(
  loader: (admin: PlatformAdminClient) => Promise<T>,
): Promise<T> {
  await requirePlatformAdminSession();

  if (!hasSupabaseAdminEnv()) {
    throw new Error("Supabase admin environment is required for platform administration.");
  }

  return loader(createAdminClient());
}
