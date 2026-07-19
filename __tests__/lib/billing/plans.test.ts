import { describe, expect, it } from "vitest";
import {
  MODULE_ROUTE_RULES,
  REWAQ_MODULES,
  REWAQ_PLAN_LIST,
  REWAQ_PLANS,
  moduleForPath,
  planHasModule,
} from "@/lib/billing/plans";

describe("Rawaq billing plans", () => {
  it("defines the 150/250/350 monthly plan matrix", () => {
    expect(
      REWAQ_PLAN_LIST.map(({ code, monthlyPriceUsd }) => ({ code, monthlyPriceUsd })),
    ).toEqual([
      { code: "starter", monthlyPriceUsd: 150 },
      { code: "growth", monthlyPriceUsd: 250 },
      { code: "scale", monthlyPriceUsd: 350 },
    ]);

    expect(planHasModule("starter", "pos")).toBe(true);
    expect(planHasModule("starter", "inventory")).toBe(false);
    expect(planHasModule("starter", "restaurant_workflow")).toBe(false);
    expect(planHasModule("starter", "digital_presence")).toBe(false);
    expect(planHasModule("growth", "inventory")).toBe(true);
    expect(planHasModule("growth", "restaurant_workflow")).toBe(true);
    expect(planHasModule("growth", "digital_presence")).toBe(true);
    expect(planHasModule("growth", "accounting")).toBe(false);
  });

  it("opens every module on the scale plan", () => {
    expect(REWAQ_PLANS.scale.modules).toEqual(REWAQ_MODULES);
    expect(new Set(REWAQ_PLANS.scale.modules).size).toBe(REWAQ_MODULES.length);

    for (const moduleKey of REWAQ_MODULES) {
      expect(planHasModule("scale", moduleKey)).toBe(true);
    }
  });
});

describe("billing module routes", () => {
  it("maps every declared route prefix to its module", () => {
    for (const rule of MODULE_ROUTE_RULES) {
      expect(moduleForPath(rule.prefix)).toBe(rule.module);
      expect(moduleForPath(`${rule.prefix}/details`)).toBe(rule.module);
    }
  });

  it("returns null for routes without a billing module rule", () => {
    expect(moduleForPath("/dashboard/profile")).toBeNull();
    expect(moduleForPath("/login")).toBeNull();
  });
});
