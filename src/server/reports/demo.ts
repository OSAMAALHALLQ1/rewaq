/**
 * Demo data for food cost report
 */

export function getDemoFoodCostReport() {
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
      {
        recipeId: "recipe-3",
        recipeName: "سلطة سيزر",
        actualCost: 4.2,
        targetCost: 4.5,
        costPercent: 36,
        salesCount: 280,
      },
    ],
    alerts: [
      {
        type: "warning" as const,
        message: "وصفة برجر لحم بتكلفة عالية",
        details: "تكلفة الوصفة 42% أعلى من الهدف 35%",
      },
      {
        type: "info" as const,
        message: "تكلفة الطعام ضمن الهدف",
        details: "متوسط تكلفة الطعام 30% وهو ضمن النطاق المستهدف",
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}