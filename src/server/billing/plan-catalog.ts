import "server-only";

import {
  REWAQ_MODULES,
  REWAQ_PLAN_LIST,
  isRewaqPlanCode,
  type RewaqModule,
  type RewaqPlanDefinition,
  type RewaqPlanLimits,
} from "@/lib/billing/plans";
import { createAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";

type PlanCatalogRow = {
  code: unknown;
  name: unknown;
  monthly_price: unknown;
  features: unknown;
  limits: unknown;
};

function validModules(value: unknown, fallback: readonly RewaqModule[]): readonly RewaqModule[] {
  if (!Array.isArray(value)) return fallback;

  const allowed = new Set<string>(REWAQ_MODULES);
  return value.filter(
    (module): module is RewaqModule => typeof module === "string" && allowed.has(module),
  );
}

function validLimit(value: unknown, fallback: number | null): number | null {
  return value === null || (typeof value === "number" && value > 0) ? value : fallback;
}

function validLimits(value: unknown, fallback: RewaqPlanLimits): RewaqPlanLimits {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const limits = value as Record<string, unknown>;
  return {
    maxBranches: validLimit(limits.maxBranches, fallback.maxBranches),
    maxUsers: validLimit(limits.maxUsers, fallback.maxUsers),
    maxDevices: validLimit(limits.maxDevices, fallback.maxDevices),
  };
}

export function mergePlanCatalogRow(
  fallback: RewaqPlanDefinition,
  row: PlanCatalogRow | undefined,
): RewaqPlanDefinition {
  if (!row || !isRewaqPlanCode(row.code) || row.code !== fallback.code) return fallback;

  const price = Number(row.monthly_price);
  return {
    ...fallback,
    name: typeof row.name === "string" && row.name.trim() ? row.name : fallback.name,
    monthlyPriceUsd: Number.isFinite(price) && price >= 0 ? price : fallback.monthlyPriceUsd,
    modules: validModules(row.features, fallback.modules),
    limits: validLimits(row.limits, fallback.limits),
  };
}

/**
 * Reads the live plan catalog when the server can reach Supabase. The local
 * definitions remain the safe build/demo fallback and supply editorial copy;
 * prices, limits, and module entitlements come from the plans table when
 * available so UI surfaces never repeat a second set of price constants.
 */
export async function getCurrentPlanCatalog(): Promise<readonly RewaqPlanDefinition[]> {
  if (!hasSupabaseAdminEnv()) return REWAQ_PLAN_LIST;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("plans")
      .select("code, name, monthly_price, features, limits")
      .in(
        "code",
        REWAQ_PLAN_LIST.map((plan) => plan.code),
      )
      .eq("status", "active");

    if (error) throw new Error(error.message);

    const rows = new Map(
      ((data ?? []) as PlanCatalogRow[])
        .filter((row) => isRewaqPlanCode(row.code))
        .map((row) => [row.code, row] as const),
    );

    return REWAQ_PLAN_LIST.map((plan) => mergePlanCatalogRow(plan, rows.get(plan.code)));
  } catch (error) {
    console.error("[billing-plan-catalog]", error instanceof Error ? error.message : error);
    return REWAQ_PLAN_LIST;
  }
}
