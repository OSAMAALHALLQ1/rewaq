import { afterEach, describe, expect, it, vi } from "vitest";
import { REWAQ_MODULES, REWAQ_PLANS } from "@/lib/billing/plans";
import {
  SubscriptionEntitlementError,
  getOrganizationEntitlements,
  requireOrganizationModule,
} from "@/server/billing/entitlements";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function makeQuery(result: QueryResult) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);

  return query;
}

function makeAdmin(options: {
  subscription?: unknown;
  subscriptionError?: { message: string } | null;
  organization?: unknown;
  organizationError?: { message: string } | null;
} = {}) {
  const subscriptions = makeQuery({
    data: options.subscription ?? null,
    error: options.subscriptionError ?? null,
  });
  const organizations = makeQuery({
    data: options.organization ?? null,
    error: options.organizationError ?? null,
  });
  const from = vi.fn((table: string) => {
    if (table === "subscriptions") return subscriptions;
    if (table === "organizations") return organizations;
    throw new Error(`Unexpected table: ${table}`);
  });

  return { admin: { from }, from };
}

const originalDemoMode = process.env.RAWAQ_DEMO_MODE;
const originalNodeEnv = process.env.NODE_ENV;

function useDatabaseEntitlements() {
  process.env.RAWAQ_DEMO_MODE = "false";
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
}

afterEach(() => {
  if (originalDemoMode === undefined) delete process.env.RAWAQ_DEMO_MODE;
  else process.env.RAWAQ_DEMO_MODE = originalDemoMode;

  if (originalNodeEnv === undefined) delete (process.env as Record<string, string | undefined>).NODE_ENV;
  else (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
});

describe("getOrganizationEntitlements", () => {
  it("parses valid database features and ignores unknown feature values", async () => {
    useDatabaseEntitlements();
    const { admin } = makeAdmin({
      subscription: {
        status: "active",
        current_period_end: "2026-08-01T00:00:00.000Z",
        plan: {
          code: "growth",
          name: "خطة مخصصة",
          features: ["inventory", "purchasing", "unknown", 42, null],
          limits: { maxBranches: 5, maxUsers: 40, maxDevices: null },
        },
      },
    });

    const entitlements = await getOrganizationEntitlements(admin, "org-1");

    expect(entitlements).toMatchObject({
      organizationId: "org-1",
      planCode: "growth",
      planName: "خطة مخصصة",
      status: "active",
      periodEnd: "2026-08-01T00:00:00.000Z",
      modules: ["inventory", "purchasing"],
      limits: { maxBranches: 5, maxUsers: 40, maxDevices: null },
      canWrite: true,
    });
  });

  it("falls back to catalog features and limits when database values are unusable", async () => {
    useDatabaseEntitlements();
    const { admin } = makeAdmin({
      subscription: {
        status: "active",
        plan: [
          {
            code: "growth",
            features: ["unknown", 42],
            limits: { maxBranches: 0, maxUsers: -1, maxDevices: "many" },
          },
        ],
      },
    });

    const entitlements = await getOrganizationEntitlements(admin, "org-2");

    expect(entitlements.modules).toEqual(REWAQ_PLANS.growth.modules);
    expect(entitlements.limits).toEqual(REWAQ_PLANS.growth.limits);
  });

  it("uses the organization plan when no subscription exists", async () => {
    useDatabaseEntitlements();
    const { admin } = makeAdmin({ organization: { plan: "growth" } });

    const entitlements = await getOrganizationEntitlements(admin, "org-3");

    expect(entitlements.planCode).toBe("growth");
    expect(entitlements.modules).toEqual(REWAQ_PLANS.growth.modules);
    expect(entitlements.canWrite).toBe(true);
  });

  it("grants the full scale plan in non-production demo mode without querying", async () => {
    process.env.RAWAQ_DEMO_MODE = "true";
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    const { admin, from } = makeAdmin();

    const entitlements = await getOrganizationEntitlements(admin, "demo-org");

    expect(entitlements).toMatchObject({
      organizationId: "demo-org",
      planCode: "scale",
      status: "trial",
      modules: REWAQ_MODULES,
      limits: { maxBranches: null, maxUsers: null, maxDevices: null },
      canWrite: true,
    });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("requireOrganizationModule", () => {
  it("rejects a module locked by the current plan", async () => {
    useDatabaseEntitlements();
    const { admin } = makeAdmin({ organization: { plan: "starter" } });

    const result = requireOrganizationModule(admin, "org-4", "accounting");

    await expect(result).rejects.toMatchObject({
      name: "SubscriptionEntitlementError",
      code: "PLAN_MODULE_LOCKED",
      module: "accounting",
      currentPlan: "starter",
      requiredPlan: "scale",
    });
    await expect(result).rejects.toBeInstanceOf(SubscriptionEntitlementError);
  });

  it("rejects writes on a paused subscription even when the module is included", async () => {
    useDatabaseEntitlements();
    const { admin } = makeAdmin({
      subscription: {
        status: "paused",
        plan: {
          code: "scale",
          features: ["accounting"],
          limits: REWAQ_PLANS.scale.limits,
        },
      },
    });

    await expect(
      requireOrganizationModule(admin, "org-5", "accounting", { write: true }),
    ).rejects.toMatchObject({
      name: "SubscriptionEntitlementError",
      code: "PLAN_MODULE_LOCKED",
      module: "accounting",
      currentPlan: "scale",
      requiredPlan: "scale",
      message: expect.stringContaining("الاشتراك متوقف"),
    });
  });
});
