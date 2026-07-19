import "server-only";

import { headers } from "next/headers";
import {
  MODULE_LABELS,
  REWAQ_PLAN_LIST,
  moduleForPath,
  type RewaqModule,
} from "@/lib/billing/plans";
import {
  getOrganizationEntitlements,
  type OrganizationEntitlements,
} from "@/server/billing/entitlements";
import { withAdminScope } from "@/server/queries/_shared/utils";

export const REWAQ_PATHNAME_HEADER = "x-rewaq-pathname";

export type ModuleGateResult =
  | { allowed: true }
  | {
      allowed: false;
      module: RewaqModule;
      moduleLabel: string;
      currentPlanName: string;
      requiredPlanName: string;
      verificationFailed?: boolean;
    };

/**
 * Server-side plan enforcement for dashboard routes. The sidebar hiding a
 * locked module is cosmetic only; this gate is what actually denies access
 * when the pathname maps to a module outside the organization's plan.
 */
export async function checkDashboardModuleAccess(): Promise<ModuleGateResult> {
  const pathname = (await headers()).get(REWAQ_PATHNAME_HEADER) ?? "";
  const routeModule = moduleForPath(pathname);

  if (!routeModule) {
    return { allowed: true };
  }

  if (process.env.RAWAQ_DEMO_MODE === "true" && process.env.NODE_ENV !== "production") {
    return { allowed: true };
  }

  const requiredPlan =
    REWAQ_PLAN_LIST.find((plan) => plan.modules.includes(routeModule)) ??
    REWAQ_PLAN_LIST[REWAQ_PLAN_LIST.length - 1];

  let entitlements: OrganizationEntitlements | null = null;
  try {
    entitlements = await withAdminScope<OrganizationEntitlements | null>(
      null,
      (admin, scope) => getOrganizationEntitlements(admin, scope.organizationId),
    );
  } catch (error) {
    console.error("[module-gate]", error instanceof Error ? error.message : error);
    return {
      allowed: false,
      module: routeModule,
      moduleLabel: MODULE_LABELS[routeModule],
      currentPlanName: "غير متاحة للتحقق الآن",
      requiredPlanName: requiredPlan.name,
      verificationFailed: true,
    };
  }

  if (!entitlements) {
    return {
      allowed: false,
      module: routeModule,
      moduleLabel: MODULE_LABELS[routeModule],
      currentPlanName: "غير متاحة للتحقق الآن",
      requiredPlanName: requiredPlan.name,
      verificationFailed: true,
    };
  }

  if (entitlements.modules.includes(routeModule)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    module: routeModule,
    moduleLabel: MODULE_LABELS[routeModule],
    currentPlanName: entitlements.planName,
    requiredPlanName: requiredPlan.name,
  };
}
