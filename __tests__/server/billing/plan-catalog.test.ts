import { describe, expect, it } from "vitest";
import { REWAQ_PLANS } from "@/lib/billing/plans";
import { mergePlanCatalogRow } from "@/server/billing/plan-catalog";

describe("billing plan catalog", () => {
  it("uses the current database price, limits, and module list", () => {
    const plan = mergePlanCatalogRow(REWAQ_PLANS.growth, {
      code: "growth",
      name: "باقة النمو الحالية",
      monthly_price: "275.50",
      features: ["dashboard", "digital_presence", "inventory"],
      limits: { maxBranches: 4, maxUsers: 30, maxDevices: 15 },
    });

    expect(plan).toMatchObject({
      code: "growth",
      name: "باقة النمو الحالية",
      monthlyPriceUsd: 275.5,
      modules: ["dashboard", "digital_presence", "inventory"],
      limits: { maxBranches: 4, maxUsers: 30, maxDevices: 15 },
    });
  });

  it("keeps an explicit empty database entitlement list fail-closed", () => {
    const plan = mergePlanCatalogRow(REWAQ_PLANS.starter, {
      code: "starter",
      name: "Starter",
      monthly_price: 150,
      features: [],
      limits: {},
    });

    expect(plan.modules).toEqual([]);
  });

  it("does not merge a row belonging to another plan", () => {
    const plan = mergePlanCatalogRow(REWAQ_PLANS.starter, {
      code: "scale",
      name: "Wrong row",
      monthly_price: 1,
      features: [],
      limits: {},
    });

    expect(plan).toBe(REWAQ_PLANS.starter);
  });
});
