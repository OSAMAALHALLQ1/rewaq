import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  withAdminScope: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/server/queries/_shared/utils", () => ({
  withAdminScope: mocks.withAdminScope,
}));

import { checkDashboardModuleAccess } from "@/server/billing/module-gate";

const savedDemoMode = process.env.RAWAQ_DEMO_MODE;
const savedNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RAWAQ_DEMO_MODE = "false";
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  mocks.headers.mockResolvedValue(
    new Headers({ "x-rewaq-pathname": "/dashboard/accounting/journal" }),
  );
});

afterEach(() => {
  if (savedDemoMode === undefined) delete process.env.RAWAQ_DEMO_MODE;
  else process.env.RAWAQ_DEMO_MODE = savedDemoMode;

  if (savedNodeEnv === undefined) {
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
  } else {
    (process.env as Record<string, string | undefined>).NODE_ENV = savedNodeEnv;
  }
});

describe("checkDashboardModuleAccess", () => {
  it("fails closed when subscription verification returns no entitlement state", async () => {
    mocks.withAdminScope.mockResolvedValue(null);

    await expect(checkDashboardModuleAccess()).resolves.toMatchObject({
      allowed: false,
      module: "accounting",
      verificationFailed: true,
    });
  });

  it("fails closed when subscription verification throws", async () => {
    mocks.withAdminScope.mockRejectedValue(new Error("backend unavailable"));

    await expect(checkDashboardModuleAccess()).resolves.toMatchObject({
      allowed: false,
      module: "accounting",
      verificationFailed: true,
    });
  });

  it("denies a verified plan that does not contain the requested module", async () => {
    mocks.withAdminScope.mockResolvedValue({
      organizationId: "org-1",
      planCode: "growth",
      planName: "رواق للمطعم المتوسط",
      status: "trial",
      periodEnd: null,
      modules: ["inventory"],
      limits: { maxBranches: 3, maxUsers: 25, maxDevices: 12 },
      canWrite: true,
    });

    await expect(checkDashboardModuleAccess()).resolves.toMatchObject({
      allowed: false,
      module: "accounting",
      currentPlanName: "رواق للمطعم المتوسط",
      requiredPlanName: "رواق للمطعم الكبير",
    });
  });

  it("allows a verified plan that contains the requested module", async () => {
    mocks.withAdminScope.mockResolvedValue({
      organizationId: "org-1",
      planCode: "scale",
      planName: "رواق للمطعم الكبير",
      status: "active",
      periodEnd: null,
      modules: ["accounting"],
      limits: { maxBranches: null, maxUsers: null, maxDevices: null },
      canWrite: true,
    });

    await expect(checkDashboardModuleAccess()).resolves.toEqual({ allowed: true });
  });
});
