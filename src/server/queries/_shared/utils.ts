/**
 * Shared utilities and types for queries
 * Used across all domain query modules
 */
import "server-only";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseDemoFallback, hasSupabaseEnv, hasSupabaseAdminEnv, isDemoModeEnabled } from "@/lib/supabase/env";
import { demoOrganization, demoBranches } from "@/lib/demo-data";
import type { Tables } from "@/types/database";
import type { Organization, Branch } from "@/types/domain";

// ============================================================================
// Types
// ============================================================================

export type QueryResult<T> = { data: T | null; error: { message: string } | null };
export type AdminClient = ReturnType<typeof createAdminClient>;
export type AppScope = { organizationId: string; branchId: string | null };

export type OrganizationContext = {
  organization: Organization;
  branches: Branch[];
};

// ============================================================================
// Database Row Types
// ============================================================================

export type BranchRow = Tables<"branches">;
export type InventoryItemRow = Tables<"inventory_items">;
export type SupplierRow = Tables<"suppliers">;
export type RecipeRow = Tables<"recipes">;
export type RecipeIngredientRow = Tables<"recipe_ingredients">;
export type MenuItemRow = Tables<"menu_items">;
export type CustomerInvoiceRow = Tables<"customer_invoices">;
export type CustomerInvoiceItemRow = Tables<"customer_invoice_items">;
export type NotificationRow = Tables<"notifications">;
export type SocialAccountRow = Tables<"social_accounts">;
export type SocialPostRow = Tables<"social_posts">;
export type SocialPostTargetRow = Tables<"social_post_targets">;
export type CatalogItemRow = Tables<"catalog_items">;
export type ItemBarcodeRow = Tables<"item_barcodes">;
export type SalesDailySummaryRow = Tables<"sales_daily_summaries">;
export type DailyCostEntryRow = Tables<"daily_cost_entries">;
export type SocialMediaAssetRow = Tables<"social_media_assets">;

// ============================================================================
// Demo Fallback
// ============================================================================

export const fallbackContext: OrganizationContext = {
  organization: demoOrganization,
  branches: demoBranches,
};

// ============================================================================
// Helper Functions
// ============================================================================

/** Wraps a Supabase query, throws on error/null, and returns typed data. */
export async function query<T>(promise: PromiseLike<QueryResult<T>>, label: string): Promise<T> {
  const { data, error } = await promise;

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  if (data === null) {
    throw new Error(`${label}: no data returned`);
  }

  return data as T;
}

/**
 * Wrapper that falls back to demo data only in explicit local demo mode.
 * USE THIS SPARINGLY - prefer isDemoMode() checks instead.
 */
export async function withAdminScope<T>(
  fallback: T,
  loader: (admin: AdminClient, scope: AppScope) => Promise<T>,
): Promise<T> {
  if (!hasSupabaseAdminEnv()) {
    if (canUseDemoFallback()) {
      return fallback;
    }
    throw new Error("Supabase admin environment is required unless RAWAQ_DEMO_MODE=true outside production.");
  }

  try {
    const admin = createAdminClient();
    const scope = await resolveScope(admin);
    return await loader(admin, scope);
  } catch (error) {
    console.error("[queries]", error instanceof Error ? error.message : error);
    if (isDemoModeEnabled()) {
      return fallback;
    }
    throw error;
  }
}

/** Check if explicit local demo mode is enabled. Production never enters demo mode. */
export function isDemoMode(): boolean {
  return isDemoModeEnabled() && !hasSupabaseEnv();
}

/** Get current authenticated user ID */
export async function getCurrentUserId(): Promise<string | null> {
  if (!hasSupabaseEnv()) {
    return null;
  }

  try {
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getClaims();
    return data?.claims?.sub ? String(data.claims.sub) : null;
  } catch {
    return null;
  }
}

/** Resolve the current organization scope from user membership */
export async function resolveScope(admin: AdminClient): Promise<AppScope> {
  const userId = await getCurrentUserId();

  if (userId) {
    const { data: membership, error } = await admin
      .from("organization_memberships")
      .select("organization_id, branch_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!error && membership?.organization_id) {
      return {
        organizationId: membership.organization_id,
        branchId: membership.branch_id,
      };
    }

    // المستخدم مصادق عليه لكن لا يوجد له صف عضوية بعد: نُسقطه على أول منظمة
    // موجودة بدلاً من رمي خطأ يعطّل كل صفحات الـ dashboard. يُسجَّل تحذير للمتابعة.
    console.warn(
      "[resolveScope] user has no organization_memberships row; falling back to first organization.",
      { userId },
    );
    const { data: firstOrgForUser } = await admin
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstOrgForUser?.id) {
      return { organizationId: firstOrgForUser.id, branchId: null };
    }
  }

  if (!isDemoModeEnabled()) {
    throw new Error("Unable to resolve organization scope for the current user.");
  }

  // Explicit local demo fallback.
  const { data: demoOrg } = await admin
    .from("organizations")
    .select("id")
    .eq("id", demoOrganization.id)
    .maybeSingle();

  if (demoOrg?.id) {
    return { organizationId: demoOrg.id, branchId: null };
  }

  // Fallback to first organization
  const { data: firstOrg } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return { organizationId: firstOrg?.id ?? demoOrganization.id, branchId: null };
}

// ============================================================================
// Value Conversion Utilities
// ============================================================================

export function numberValue(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function dateKey(value: string | null | undefined): string {
  return (value ?? new Date().toISOString()).slice(0, 10);
}

export function oneOf<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function optionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

// ============================================================================
// Collection Utilities
// ============================================================================

export function indexBy<T>(rows: T[], getKey: (row: T) => string | null | undefined): Map<string, T> {
  return new Map(rows.map((row) => [getKey(row), row]).filter((entry): entry is [string, T] => Boolean(entry[0])));
}

export function groupBy<T>(rows: T[], getKey: (row: T) => string | null | undefined): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return groups;
}

export function sumBy<T>(rows: T[], getValue: (row: T) => number): number {
  return rows.reduce((sum, row) => sum + getValue(row), 0);
}

// ============================================================================
// Mapping Functions
// ============================================================================

export function mapOrganization(row: Tables<"organizations">): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    status: oneOf(row.status, ["active", "trial", "past_due", "paused"] as const, "trial"),
  };
}

export function mapBranch(row: BranchRow): Branch {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    city: row.city ?? "",
    address: row.address ?? "",
    manager: row.manager_name ?? "",
    status: row.status === "inactive" || row.status === "archived" ? "inactive" : "active",
  };
}
