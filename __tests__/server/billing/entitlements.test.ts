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
    data:
      options.organization ?? {
        plan: "starter",
        plan_selected_at: "2026-07-01T00:00:00.000Z",
      },
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
          monthly_price: "299.50",
          currency: "USD",
          features: ["inventory", "purchasing", "unknown", 42, null],
          limits: { maxBranches: 5, maxUsers: 40, maxDevices: null },
        },
      },
    });

    const entitlements = await getOrganizationEntitlements(admin, "org-1");

    expect(entitlements).toMatchObject({
      organizationId: "org-1",
      selected: true,
      planCode: "growth",
      planName: "خطة مخصصة",
      monthlyPrice: 299.5,
      currency: "USD",
      status: "active",
      periodEnd: "2026-08-01T00:00:00.000Z",
      modules: ["inventory", "purchasing"],
      limits: { maxBranches: 5, maxUsers: 40, maxDevices: null },
      canWrite: true,
    });
  });

  it("fails closed for an explicit feature list with no recognized modules", async () => {
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

    expect(entitlements.modules).toEqual([]);
    expect(entitlements.limits).toEqual(REWAQ_PLANS.growth.limits);
  });

  it("fails closed instead of granting features from an unknown plan code", async () => {
    useDatabaseEntitlements();
    const { admin } = makeAdmin({
      subscription: {
        status: "active",
        plan: {
          code: "custom-unreviewed",
          features: ["accounting", "marketing"],
          limits: {},
        },
      },
    });

    await expect(getOrganizationEntitlements(admin, "org-unknown-plan")).rejects.toThrow(
      "خطة الاشتراك الحالية غير معروفة",
    );
  });

  it("uses the organization plan when no subscription exists", async () => {
    useDatabaseEntitlements();
    const { admin } = makeAdmin({ organization: { plan: "growth" } });

    const entitlements = await getOrganizationEntitlements(admin, "org-3");

    expect(entitlements.planCode).toBe("growth");
    expect(entitlements.modules).toEqual(REWAQ_PLANS.growth.modules);
    expect(entitlements.canWrite).toBe(true);
  });

  it("denies every module while the organization has not selected a plan", async () => {
    useDatabaseEntitlements();
    const { admin } = makeAdmin({
      organization: { plan: "starter", plan_selected_at: null },
      subscription: {
        status: "active",
        plan: { code: "scale", features: REWAQ_MODULES },
      },
    });

    const entitlements = await getOrganizationEntitlements(admin, "org-unselected");

    expect(entitlements).toMatchObject({
      selected: false,
      status: "unselected",
      modules: [],
      canWrite: false,
    });
    await expect(requireOrganizationModule(admin, "org-unselected", "pos")).rejects.toMatchObject({
      code: "PLAN_MODULE_LOCKED",
      message: expect.stringContaining("يختار مالك المؤسسة"),
    });
  });

  it("grants the full scale plan in non-production demo mode without querying", async () => {
    process.env.RAWAQ_DEMO_MODE = "true";
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    const { admin, from } = makeAdmin();

    const entitlements = await getOrganizationEntitlements(admin, "demo-org");

    expect(entitlements).toMatchObject({
      organizationId: "demo-org",
      selected: true,
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
  it.each(["tables", "restaurant_workflow", "kitchen", "expo"] as const)(
    "opens the %s Tikka entitlement from growth but not starter",
    async (module) => {
      useDatabaseEntitlements();
      const starter = makeAdmin({ organization: { plan: "starter" } });
      const growth = makeAdmin({ organization: { plan: "growth" } });

      await expect(
        requireOrganizationModule(starter.admin, "org-starter", module),
      ).rejects.toMatchObject({ code: "PLAN_MODULE_LOCKED", module });
      await expect(
        requireOrganizationModule(growth.admin, "org-growth", module),
      ).resolves.toMatchObject({ planCode: "growth" });
    },
  );

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
