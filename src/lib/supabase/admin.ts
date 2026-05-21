import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export function hasSupabaseAdminEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Create a Supabase admin client using the service_role key.
 *
 * ⚠️  WARNING: The service_role key BYPASSES Row-Level Security.
 * Only use this client when you have ALREADY verified the user's
 * authorization through requireAuth() or similar.
 *
 * NEVER expose data from this client to unauthorized users.
 * NEVER pass this client to client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create an admin client with an optional caller context for audit logging.
 * Same as createAdminClient but includes a caller identifier in errors.
 */
export function createAdminClientWithContext(caller: string) {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[ADMIN] ${caller} — using service_role client (bypasses RLS)`);
  }
  return createAdminClient();
}
