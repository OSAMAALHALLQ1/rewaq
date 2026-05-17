import type { RecipeIngredient } from "@/types/domain";

export function calculateRecipeCost(ingredients: RecipeIngredient[]) {
  return ingredients.reduce((sum, ingredient) => sum + ingredient.totalCost, 0);
}

export function calculateMenuProfitability(recipeCost: number, sellingPrice: number) {
  const grossProfit = sellingPrice - recipeCost;
  const foodCostPercent = sellingPrice > 0 ? (recipeCost / sellingPrice) * 100 : 0;
  const profitMarginPercent = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;

  return {
    recipeCost,
    sellingPrice,
    grossProfit,
    foodCostPercent,
    profitMarginPercent,
    highFoodCost: foodCostPercent > 35,
  };
}
