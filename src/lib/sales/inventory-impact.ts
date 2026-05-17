import type { BranchStock, InventoryItem, MenuItem, Recipe } from "@/types/domain";

export type SalesCartLine = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  itemDiscount: number;
};

export type IngredientDeduction = {
  itemId: string;
  itemName: string;
  categoryName: string;
  requiredQuantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  currentQuantity: number;
  projectedQuantity: number;
  minimumQuantity: number;
  status: "ok" | "low" | "insufficient";
};

export type SalesInventoryImpact = {
  salesTotal: number;
  ingredientCostTotal: number;
  estimatedGrossProfit: number;
  foodCostPercent: number;
  profitMarginPercent: number;
  deductions: IngredientDeduction[];
  missingRecipes: string[];
  lowStockCount: number;
  insufficientCount: number;
};

export function calculateSalesInventoryImpact({
  cart,
  menuItems,
  recipes,
  inventoryItems,
  branchStock,
  branchId,
  invoiceDiscount,
  committedDeductions = {},
}: {
  cart: SalesCartLine[];
  menuItems: MenuItem[];
  recipes: Recipe[];
  inventoryItems: InventoryItem[];
  branchStock: BranchStock[];
  branchId: string;
  invoiceDiscount: number;
  committedDeductions?: Record<string, number>;
}): SalesInventoryImpact {
  const deductions = new Map<string, IngredientDeduction>();
  const missingRecipes = new Set<string>();
  const salesTotalBeforeInvoiceDiscount = cart.reduce(
    (sum, line) => sum + Math.max((line.unitPrice - line.itemDiscount) * line.quantity, 0),
    0,
  );
  const salesTotal = Math.max(salesTotalBeforeInvoiceDiscount - invoiceDiscount, 0);

  cart.forEach((line) => {
    const menuItem = menuItems.find((item) => item.name === line.name || item.id === line.id);
    const recipe = menuItem ? recipes.find((candidate) => candidate.id === menuItem.recipeId) : null;
    if (!recipe) {
      missingRecipes.add(line.name);
      return;
    }

    recipe.ingredients.forEach((ingredient) => {
      const inventoryItem = inventoryItems.find((item) => item.id === ingredient.itemId);
      const branchQuantity =
        branchStock
          .filter((stock) => stock.branchId === branchId && stock.itemId === ingredient.itemId)
          .reduce((sum, stock) => sum + stock.quantity, 0) - (committedDeductions[ingredient.itemId] ?? 0);
      const requiredQuantity = ingredient.quantity * line.quantity;
      const previous = deductions.get(ingredient.itemId);
      const nextRequired = (previous?.requiredQuantity ?? 0) + requiredQuantity;
      const unitCost = ingredient.unitCost;
      const totalCost = (previous?.totalCost ?? 0) + requiredQuantity * unitCost;
      const minimumQuantity = inventoryItem?.minimumQuantity ?? 0;
      const projectedQuantity = branchQuantity - nextRequired;
      const status =
        projectedQuantity < 0 ? "insufficient" : projectedQuantity <= minimumQuantity ? "low" : "ok";

      deductions.set(ingredient.itemId, {
        itemId: ingredient.itemId,
        itemName: ingredient.itemName,
        categoryName: inventoryItem?.categoryName ?? "غير مصنف",
        requiredQuantity: nextRequired,
        unit: ingredient.unit,
        unitCost,
        totalCost,
        currentQuantity: branchQuantity,
        projectedQuantity,
        minimumQuantity,
        status,
      });
    });
  });

  const ingredientCostTotal = Array.from(deductions.values()).reduce((sum, item) => sum + item.totalCost, 0);
  const estimatedGrossProfit = salesTotal - ingredientCostTotal;
  const foodCostPercent = salesTotal > 0 ? (ingredientCostTotal / salesTotal) * 100 : 0;
  const profitMarginPercent = salesTotal > 0 ? (estimatedGrossProfit / salesTotal) * 100 : 0;
  const deductionList = Array.from(deductions.values()).sort((a, b) => b.totalCost - a.totalCost);

  return {
    salesTotal,
    ingredientCostTotal,
    estimatedGrossProfit,
    foodCostPercent,
    profitMarginPercent,
    deductions: deductionList,
    missingRecipes: Array.from(missingRecipes),
    lowStockCount: deductionList.filter((item) => item.status === "low").length,
    insufficientCount: deductionList.filter((item) => item.status === "insufficient").length,
  };
}
