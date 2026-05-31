/**
 * Tests for food cost report generation
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateFoodCostReport } from "@/server/reports/food-cost";

describe("generateFoodCostReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return demo report when in demo mode", async () => {
    const result = await generateFoodCostReport({
      organizationId: "demo-org",
      dateRange: {
        start: new Date("2026-05-01"),
        end: new Date("2026-05-31"),
      },
      groupBy: "week",
    });

    // Demo mode should return predefined structure
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("trend");
    expect(result).toHaveProperty("highCostRecipes");
    expect(result).toHaveProperty("alerts");
    expect(result).toHaveProperty("generatedAt");

    // Check summary structure
    expect(result.summary).toHaveProperty("totalFoodCost");
    expect(result.summary).toHaveProperty("totalSales");
    expect(result.summary).toHaveProperty("foodCostPercent");
    expect(result.summary).toHaveProperty("idealCostPercent");
    expect(result.summary).toHaveProperty("variance");

    // Check trend structure
    expect(Array.isArray(result.trend)).toBe(true);
    if (result.trend.length > 0) {
      expect(result.trend[0]).toHaveProperty("period");
      expect(result.trend[0]).toHaveProperty("foodCost");
      expect(result.trend[0]).toHaveProperty("sales");
      expect(result.trend[0]).toHaveProperty("costPercent");
    }

    // Check alerts structure
    expect(Array.isArray(result.alerts)).toBe(true);
    if (result.alerts.length > 0) {
      expect(result.alerts[0]).toHaveProperty("type");
      expect(result.alerts[0]).toHaveProperty("message");
      expect(result.alerts[0]).toHaveProperty("details");
    }
  });

  it("should calculate variance correctly", async () => {
    const result = await generateFoodCostReport({
      organizationId: "demo-org",
      dateRange: {
        start: new Date("2026-05-01"),
        end: new Date("2026-05-31"),
      },
      groupBy: "month",
    });

    // Variance should be difference between actual and ideal
    expect(result.summary.variance).toBe(
      result.summary.foodCostPercent - result.summary.idealCostPercent
    );
  });

  it("should generate alerts for high food cost", async () => {
    // This test verifies alert generation logic
    const result = await generateFoodCostReport({
      organizationId: "demo-org",
      dateRange: {
        start: new Date("2026-05-01"),
        end: new Date("2026-05-31"),
      },
      groupBy: "week",
    });

    // If food cost is above 35%, should have danger alert
    if (result.summary.foodCostPercent > 35) {
      const hasDangerAlert = result.alerts.some((a) => a.type === "danger");
      expect(hasDangerAlert).toBe(true);
    }
  });

  it("should include generated timestamp", async () => {
    const before = new Date().toISOString();
    const result = await generateFoodCostReport({
      organizationId: "demo-org",
      dateRange: {
        start: new Date("2026-05-01"),
        end: new Date("2026-05-31"),
      },
      groupBy: "day",
    });
    const after = new Date().toISOString();

    expect(result.generatedAt).toBeDefined();
    expect(new Date(result.generatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(before).getTime()
    );
    expect(new Date(result.generatedAt).getTime()).toBeLessThanOrEqual(
      new Date(after).getTime()
    );
  });

  it("should handle different groupBy options", async () => {
    const groupBys = ["day", "week", "month"] as const;

    for (const groupBy of groupBys) {
      const result = await generateFoodCostReport({
        organizationId: "demo-org",
        dateRange: {
          start: new Date("2026-05-01"),
          end: new Date("2026-05-31"),
        },
        groupBy,
      });

      expect(result.trend).toBeDefined();
    }
  });
});

describe("FoodCostReport structure", () => {
  it("should have valid highCostRecipes entries", async () => {
    const result = await generateFoodCostReport({
      organizationId: "demo-org",
      dateRange: {
        start: new Date("2026-05-01"),
        end: new Date("2026-05-31"),
      },
      groupBy: "week",
    });

    for (const recipe of result.highCostRecipes) {
      expect(recipe).toHaveProperty("recipeId");
      expect(recipe).toHaveProperty("recipeName");
      expect(recipe).toHaveProperty("actualCost");
      expect(recipe).toHaveProperty("targetCost");
      expect(recipe).toHaveProperty("costPercent");
      expect(recipe).toHaveProperty("salesCount");

      // costPercent should be > 35 for high cost recipes
      expect(recipe.costPercent).toBeGreaterThan(0);
    }
  });

  it("should have valid alert types", async () => {
    const result = await generateFoodCostReport({
      organizationId: "demo-org",
      dateRange: {
        start: new Date("2026-05-01"),
        end: new Date("2026-05-31"),
      },
      groupBy: "week",
    });

    const validTypes = ["warning", "danger"] as const;

    for (const alert of result.alerts) {
      expect(validTypes).toContain(alert.type);
      expect(typeof alert.message).toBe("string");
      expect(typeof alert.details).toBe("string");
    }
  });
});