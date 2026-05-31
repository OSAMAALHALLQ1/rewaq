/**
 * Food Cost Report Generator
 * 
 * Calculates food cost percentage based on:
 * - Actual ingredient costs from recipes
 * - Sales data from POS or manual entry
 * - Inventory movements
 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";
import { isDemoMode } from "@/server/queries/_shared/utils";

// ============================================================================
// Types
// ============================================================================

export type FoodCostReportParams = {
  organizationId: string;
  branchId?: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  groupBy: "day" | "week" | "month";
};

export type FoodCostReport = {
  summary: {
    totalFoodCost: number;
    totalSales: number;
    foodCostPercent: number;
    idealCostPercent: number;
    variance: number;
  };
  trend: Array<{
    period: string;
    foodCost: number;
    sales: number;
    costPercent: number;
  }>;
  highCostRecipes: Array<{
    recipeId: string;
    recipeName: string;
    actualCost: number;
    targetCost: number;
    costPercent: number;
    salesCount: number;
  }>;
  alerts: Array<{
    type: "warning" | "danger";
    message: string;
    details: string;
  }>;
  generatedAt: string;
};

export type RecipeCostBreakdown = {
  recipeId: string;
  recipeName: string;
  ingredients: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
  }>;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  costPerUnit: number;
  suggestedPrice: number;
  targetMargin: number;
};

// ============================================================================
// Helper Functions
// ============================================================================

function numberValue(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ============================================================================
// Recipe Cost Calculation
// ============================================================================

/**
 * Calculate the actual cost of a recipe based on ingredient prices
 */
export async function calculateRecipeCosts(
  organizationId: string,
  recipeIds?: string[]
): Promise<Map<string, RecipeCostBreakdown>> {
  if (!hasSupabaseAdminEnv()) {
    return new Map();
  }

  const admin = createAdminClient();

  // Fetch recipes with ingredients
  let recipeQuery = admin
    .from("recipes")
    .select(`
      id,
      name,
      yield_units,
      labor_cost_per_unit,
      overhead_percent,
      target_margin_percent
    `)
    .eq("organization_id", organizationId);

  if (recipeIds && recipeIds.length > 0) {
    recipeQuery = recipeQuery.in("id", recipeIds);
  }

  const { data: recipes } = await recipeQuery;

  if (!recipes || recipes.length === 0) {
    return new Map();
  }

  // Fetch all ingredients for these recipes
  const recipeIdList = recipes.map((r) => r.id);
  const { data: ingredients } = await admin
    .from("recipe_ingredients")
    .select(`
      recipe_id,
      item_id,
      quantity,
      unit_cost
    `)
    .in("recipe_id", recipeIdList);

  // Fetch inventory item names
  const itemIds = [...new Set((ingredients ?? []).map((i) => i.item_id))];
  const { data: items } = await admin
    .from("inventory_items")
    .select("id, name, average_cost")
    .in("id", itemIds);

  const itemMap = new Map(items?.map((item) => [item.id, item]) ?? []);

  // Calculate costs for each recipe
  const costMap = new Map<string, RecipeCostBreakdown>();

  for (const recipe of recipes) {
    const recipeIngredients = (ingredients ?? []).filter((i) => i.recipe_id === recipe.id);
    const yieldUnits = numberValue(recipe.yield_units) || 1;

    const ingredientBreakdown = recipeIngredients.map((ing) => {
      const item = itemMap.get(ing.item_id);
      const unitCost = numberValue(ing.unit_cost || item?.average_cost || 0);
      return {
        itemId: ing.item_id,
        itemName: item?.name ?? "مادة غير معروفة",
        quantity: numberValue(ing.quantity),
        unit: "",
        unitCost,
        totalCost: numberValue(ing.quantity) * unitCost,
      };
    });

    const materialCost = ingredientBreakdown.reduce((sum, ing) => sum + ing.totalCost, 0);
    const laborCost = numberValue(recipe.labor_cost_per_unit) * yieldUnits;
    const overheadPercent = numberValue(recipe.overhead_percent) / 100;
    const overheadCost = materialCost * overheadPercent;
    const totalCost = materialCost + laborCost + overheadCost;
    const costPerUnit = totalCost / yieldUnits;
    const targetMargin = numberValue(recipe.target_margin_percent) || 35;
    const suggestedPrice = costPerUnit / (1 - targetMargin / 100);

    costMap.set(recipe.id, {
      recipeId: recipe.id,
      recipeName: recipe.name,
      ingredients: ingredientBreakdown,
      materialCost,
      laborCost,
      overheadCost,
      totalCost,
      costPerUnit,
      suggestedPrice,
      targetMargin,
    });
  }

  return costMap;
}

// ============================================================================
// Food Cost Report Generation
// ============================================================================

/**
 * Generate a comprehensive food cost report
 */
export async function generateFoodCostReport(
  params: FoodCostReportParams
): Promise<FoodCostReport> {
  const { organizationId, branchId, dateRange, groupBy } = params;

  if (isDemoMode()) {
    return getDemoFoodCostReport();
  }

  const admin = createAdminClient();

  // Date range filter
  const startDate = formatDate(dateRange.start);
  const endDate = formatDate(dateRange.end);

  // Fetch sales summaries for the period
  let salesQuery = admin
    .from("sales_daily_summaries")
    .select("date, total_sales, food_cost_amount")
    .eq("organization_id", organizationId)
    .gte("date", startDate)
    .lte("date", endDate);

  if (branchId) {
    salesQuery = salesQuery.eq("branch_id", branchId);
  }

  const { data: salesData } = await salesQuery;

  // Fetch recipe costs
  const recipeCosts = await calculateRecipeCosts(organizationId);

  // Calculate totals
  const totalSales = (salesData ?? []).reduce(
    (sum, row) => sum + numberValue(row.total_sales),
    0
  );

  const totalFoodCost = (salesData ?? []).reduce(
    (sum, row) => sum + numberValue(row.food_cost_amount),
    0
  );

  // If no sales data, calculate from recipes
  let calculatedFoodCost = totalFoodCost;
  if (totalFoodCost === 0 && recipeCosts.size > 0) {
    // Estimate food cost based on average recipe cost
    const avgRecipeCost = Array.from(recipeCosts.values()).reduce(
      (sum, rc) => sum + rc.costPerUnit,
      0
    ) / recipeCosts.size;
    
    // Assume 30% of sales is food cost (industry average)
    calculatedFoodCost = totalSales * 0.30;
  }

  const foodCostPercent = totalSales > 0 
    ? (calculatedFoodCost / totalSales) * 100 
    : 0;

  // Build trend data
  const trend = buildTrendData(salesData ?? [], groupBy);

  // Find high-cost recipes
  const highCostRecipes = Array.from(recipeCosts.entries())
    .map(([recipeId, recipe]) => ({
      recipeId,
      recipeName: recipe.recipeName,
      actualCost: recipe.costPerUnit,
      targetCost: recipe.suggestedPrice * 0.35, // 35% target cost
      costPercent: recipe.targetMargin > 0 
        ? (recipe.costPerUnit / (recipe.costPerUnit / (1 - recipe.targetMargin / 100))) * 100 
        : 35,
      salesCount: 0, // Would need sales data to calculate
    }))
    .filter((r) => r.costPercent > 35)
    .slice(0, 10);

  // Generate alerts
  const alerts: FoodCostReport["alerts"] = [];

  if (foodCostPercent > 35) {
    alerts.push({
      type: "danger",
      message: "تكلفة الطعام مرتفعة",
      details: `تكلفة الطعام وصلت ${foodCostPercent.toFixed(1)}% وهذا أعلى من الهدف (35%)`,
    });
  } else if (foodCostPercent > 32) {
    alerts.push({
      type: "warning",
      message: "تكلفة الطعام تقترب من الحد",
      details: `تكلفة الطعام ${foodCostPercent.toFixed(1)}% قريبة من الهدف`,
    });
  }

  if (highCostRecipes.length > 3) {
    alerts.push({
      type: "warning",
      message: "وصفات بتكلفة عالية",
      details: `يوجد ${highCostRecipes.length} وصفة بتكلفة أعلى من الهدف`,
    });
  }

  return {
    summary: {
      totalFoodCost: calculatedFoodCost,
      totalSales,
      foodCostPercent: Math.round(foodCostPercent * 10) / 10,
      idealCostPercent: 30,
      variance: foodCostPercent - 30,
    },
    trend,
    highCostRecipes,
    alerts,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Build trend data grouped by day/week/month
 */
function buildTrendData(
  salesData: Array<{ date: string; total_sales: number | null; food_cost_amount: number | null }>,
  groupBy: "day" | "week" | "month"
): FoodCostReport["trend"] {
  const groups = new Map<string, { foodCost: number; sales: number }>();

  for (const row of salesData) {
    const date = new Date(row.date);
    let period: string;

    switch (groupBy) {
      case "day":
        period = row.date;
        break;
      case "week":
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        period = formatDate(weekStart);
        break;
      case "month":
        period = row.date.slice(0, 7); // YYYY-MM
        break;
    }

    const existing = groups.get(period) ?? { foodCost: 0, sales: 0 };
    groups.set(period, {
      foodCost: existing.foodCost + numberValue(row.food_cost_amount),
      sales: existing.sales + numberValue(row.total_sales),
    });
  }

  return Array.from(groups.entries())
    .map(([period, data]) => ({
      period,
      foodCost: data.foodCost,
      sales: data.sales,
      costPercent: data.sales > 0 ? Math.round((data.foodCost / data.sales) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

// ============================================================================
// Demo Data
// ============================================================================

function getDemoFoodCostReport(): FoodCostReport {
  return {
    summary: {
      totalFoodCost: 13500,
      totalSales: 45000,
      foodCostPercent: 30,
      idealCostPercent: 30,
      variance: 0,
    },
    trend: [
      { period: "الأسبوع 1", foodCost: 3200, sales: 10500, costPercent: 30.5 },
      { period: "الأسبوع 2", foodCost: 2900, sales: 9800, costPercent: 29.6 },
      { period: "الأسبوع 3", foodCost: 3600, sales: 11500, costPercent: 31.3 },
      { period: "الأسبوع 4", foodCost: 3800, sales: 13200, costPercent: 28.8 },
    ],
    highCostRecipes: [
      {
        recipeId: "recipe-1",
        recipeName: "ساندويتش دجاج",
        actualCost: 8.5,
        targetCost: 8.75,
        costPercent: 38,
        salesCount: 450,
      },
      {
        recipeId: "recipe-2",
        recipeName: "برجر لحم",
        actualCost: 12,
        targetCost: 10.5,
        costPercent: 42,
        salesCount: 320,
      },
    ],
    alerts: [
      {
        type: "warning",
        message: "وصفة برجر لحم بتكلفة عالية",
        details: "تكلفة الوصفة 42% أعلى من الهدف 35%",
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Export All Report Types
// ============================================================================

export { getDemoFoodCostReport } from "./demo";
export type { DashboardReport, InventoryReport, SalesReport, WasteReport } from "./types";