import "server-only";

import {
  MODULE_LABELS,
  REWAQ_MODULES,
  REWAQ_PLAN_LIST,
  getRewaqPlan,
  normalizePlanCode,
  type RewaqModule,
  type RewaqPlanCode,
  type RewaqPlanLimits,
} from "@/lib/billing/plans";

type EntitlementClient = {
  from: (table: string) => any;
};

export type OrganizationEntitlements = {
  organizationId: string;
  planCode: RewaqPlanCode;
  planName: string;
  status: string;
  periodEnd: string | null;
  modules: readonly RewaqModule[];
  limits: RewaqPlanLimits;
  canWrite: boolean;
};

export class SubscriptionEntitlementError extends Error {
  readonly code = "PLAN_MODULE_LOCKED";
  readonly module: RewaqModule;
  readonly currentPlan: RewaqPlanCode;
  readonly requiredPlan: RewaqPlanCode;

  constructor(module: RewaqModule, currentPlan: RewaqPlanCode, message?: string) {
    const requiredPlan = minimumPlanForModule(module);
    super(
      message ??
        `وحدة ${MODULE_LABELS[module]} غير متاحة في باقة ${getRewaqPlan(currentPlan).name}. تحتاج إلى باقة ${getRewaqPlan(requiredPlan).name}.`,
    );
    this.name = "SubscriptionEntitlementError";
    this.module = module;
    this.currentPlan = currentPlan;
    this.requiredPlan = requiredPlan;
  }
}

function minimumPlanForModule(module: RewaqModule): RewaqPlanCode {
  return REWAQ_PLAN_LIST.find((plan) => plan.modules.includes(module))?.code ?? "scale";
}

function parsePlanRelation(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
  }

  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function parseModules(value: unknown, fallbackPlan: RewaqPlanCode): readonly RewaqModule[] {
  if (!Array.isArray(value)) {
    return getRewaqPlan(fallbackPlan).modules;
  }

  const allowed = new Set<string>(REWAQ_MODULES);
  const modules = value.filter(
    (module): module is RewaqModule => typeof module === "string" && allowed.has(module),
  );

  return modules.length > 0 ? modules : getRewaqPlan(fallbackPlan).modules;
}

function parseLimits(value: unknown, fallbackPlan: RewaqPlanCode): RewaqPlanLimits {
  const fallback = getRewaqPlan(fallbackPlan).limits;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const limits = value as Record<string, unknown>;
  const parseLimit = (key: keyof RewaqPlanLimits) => {
    const candidate = limits[key];
    return candidate === null || (typeof candidate === "number" && candidate > 0)
      ? candidate
      : fallback[key];
  };

  return {
    maxBranches: parseLimit("maxBranches"),
    maxUsers: parseLimit("maxUsers"),
    maxDevices: parseLimit("maxDevices"),
  };
}

function catalogEntitlements(
  organizationId: string,
  planCodeValue: unknown,
  status = "active",
  periodEnd: string | null = null,
): OrganizationEntitlements {
  const plan = getRewaqPlan(planCodeValue);
  return {
    organizationId,
    planCode: plan.code,
    planName: plan.name,
    status,
    periodEnd,
    modules: plan.modules,
    limits: plan.limits,
    canWrite: status === "active" || status === "trial",
  };
}

export async function getOrganizationEntitlements(
  admin: EntitlementClient,
  organizationId: string,
): Promise<OrganizationEntitlements> {
  if (process.env.RAWAQ_DEMO_MODE === "true" && process.env.NODE_ENV !== "production") {
    return catalogEntitlements(organizationId, "scale", "trial");
  }

  const { data: subscription, error: subscriptionError } = await admin
    .from("subscriptions")
    .select(
      "status, current_period_end, updated_at, plan:plans(code, name, features, limits, currency, monthly_price)",
    )
    .eq("organization_id", organizationId)
    .in("status", ["trial", "active", "past_due", "paused"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionError) {
    throw new Error(`تعذر التحقق من اشتراك المؤسسة: ${subscriptionError.message}`);
  }

  if (subscription) {
    const relation = parsePlanRelation(subscription.plan);
    const planCode = normalizePlanCode(relation?.code);
    const catalogPlan = getRewaqPlan(planCode);
    const status = String(subscription.status ?? "paused");

    return {
      organizationId,
      planCode,
      planName: typeof relation?.name === "string" ? relation.name : catalogPlan.name,
      status,
      periodEnd:
        typeof subscription.current_period_end === "string"
          ? subscription.current_period_end
          : null,
      modules: parseModules(relation?.features, planCode),
      limits: parseLimits(relation?.limits, planCode),
      canWrite: status === "active" || status === "trial",
    };
  }

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("plan")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError) {
    throw new Error(`تعذر قراءة خطة المؤسسة: ${organizationError.message}`);
  }

  return catalogEntitlements(organizationId, organization?.plan);
}

export async function requireOrganizationModule(
  admin: EntitlementClient,
  organizationId: string,
  module: RewaqModule,
  options: { write?: boolean } = {},
) {
  const entitlements = await getOrganizationEntitlements(admin, organizationId);

  if (!entitlements.modules.includes(module)) {
    throw new SubscriptionEntitlementError(module, entitlements.planCode);
  }

  if (options.write && !entitlements.canWrite) {
    throw new SubscriptionEntitlementError(
      module,
      entitlements.planCode,
      "الاشتراك متوقف عن تنفيذ عمليات جديدة. يمكن مراجعة البيانات الحالية وطلب إعادة التفعيل من صفحة الفوترة.",
    );
  }

  return entitlements;
}
