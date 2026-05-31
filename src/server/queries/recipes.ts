/**
 * Recipes domain queries
 * Handles recipes, menu items, and food costing
 */
import "server-only";
import {
  demoRecipes,
  demoMenuItems,
  demoInventoryItems,
  demoBranches,
} from "@/lib/demo-data";
import {
  isDemoMode,
  withAdminScope,
  query,
  indexBy,
  groupBy,
  numberValue,
  optionalText,
  type AdminClient,
} from "./_shared/utils";
import { mapRecipeIngredient, mapMenuItem } from "./_shared/mappers";

// ============================================================================
// Types
// ============================================================================

export type RecipesBundle = {
  recipes: typeof demoRecipes;
  menuItems: typeof demoMenuItems;
  inventoryItems: typeof demoInventoryItems;
  branches: typeof demoBranches;
};

// ============================================================================
// Loaders
// ============================================================================

async function loadRecipesBundle(admin: AdminClient, organizationId: string) {
  const [recipeRows, ingredientRows, menuItemRows, itemRows, unitRows, branchRows] = await Promise.all([
    query(admin.from("recipes").select("*").eq("organization_id", organizationId).order("name"), "recipes"),
    query(admin.from("recipe_ingredients").select("*").eq("organization_id", organizationId), "recipe_ingredients"),
    query(admin.from("menu_items").select("*").eq("organization_id", organizationId).order("name"), "menu_items"),
    query(admin.from("inventory_items").select("*").eq("organization_id", organizationId), "inventory_items"),
    query(admin.from("units").select("*").eq("organization_id", organizationId), "units"),
    query(admin.from("branches").select("*").eq("organization_id", organizationId), "branches"),
  ]);

  const itemMap = indexBy(itemRows, (row) => row.id);
  const unitMap = indexBy(unitRows, (row) => row.id);
  const branchMap = indexBy(branchRows, (row) => row.id);
  const ingredientsByRecipe = groupBy(ingredientRows, (row) => row.recipe_id);

  return {
    recipes: recipeRows.map((row) => {
      const ingredients = (ingredientsByRecipe.get(row.id) ?? []).map((ing) => mapRecipeIngredient(ing, itemMap, unitMap));
      const totalCost = ingredients.reduce((sum, ing) => sum + ing.cost, 0);
      const yieldUnits = numberValue(row.yield_units) || 1;

      return {
        id: row.id,
        organizationId: row.organization_id,
        name: row.name,
        category: row.category ?? "general",
        description: optionalText(row.description),
        totalCost,
        costPerUnit: totalCost / yieldUnits,
        yieldUnits,
        ingredients,
        status: row.status === "active" ? "active" as const : "inactive" as const,
      };
    }),
    menuItems: menuItemRows.map((row) => mapMenuItem(row, branchMap)),
    inventoryItems: itemRows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      categoryId: row.category_id ?? "",
      categoryName: "",
      purchaseUnit: "",
      usageUnit: "",
      lastPurchasePrice: numberValue(row.last_purchase_price),
      averageCost: numberValue(row.average_cost),
      minimumQuantity: numberValue(row.minimum_quantity),
      primarySupplierId: optionalText(row.primary_supplier_id),
      primarySupplierName: undefined,
      sku: optionalText(row.sku),
      notes: optionalText(row.notes),
      isActive: row.status === "active",
    })),
    branches: branchRows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      city: row.city ?? "",
      address: row.address ?? "",
      manager: row.manager_name ?? "",
      status: row.status === "inactive" || row.status === "archived" ? "inactive" as const : "active" as const,
    })),
  };
}

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Get full recipes bundle
 */
export async function getRecipesData(): Promise<RecipesBundle> {
  if (isDemoMode()) {
    return {
      recipes: demoRecipes,
      menuItems: demoMenuItems,
      inventoryItems: demoInventoryItems,
      branches: demoBranches,
    };
  }

  return withAdminScope(
    {
      recipes: demoRecipes,
      menuItems: demoMenuItems,
      inventoryItems: demoInventoryItems,
      branches: demoBranches,
    },
    (admin, scope) => loadRecipesBundle(admin, scope.organizationId),
  );
}

/**
 * Get single recipe with ingredients
 */
export async function getRecipe(id: string) {
  if (isDemoMode()) {
    const recipe = demoRecipes.find((candidate) => candidate.id === id);
    return recipe
      ? {
          recipe,
          ingredients: recipe.ingredients,
          branches: demoBranches,
        }
      : null;
  }

  return withAdminScope(
    (() => {
      const recipe = demoRecipes.find((candidate) => candidate.id === id);
      return recipe
        ? {
            recipe,
            ingredients: recipe.ingredients,
            branches: demoBranches,
          }
        : null;
    })(),
    async (admin, scope) => {
      const bundle = await loadRecipesBundle(admin, scope.organizationId);
      const recipe = bundle.recipes.find((candidate) => candidate.id === id);
      return recipe
        ? {
            recipe,
            ingredients: recipe.ingredients,
            branches: bundle.branches,
          }
        : null;
    },
  );
}

/**
 * Get single menu item with recipe
 */
export async function getMenuItem(id: string) {
  if (isDemoMode()) {
    return demoMenuItems.find((candidate) => candidate.id === id) ?? null;
  }

  return withAdminScope(
    demoMenuItems.find((candidate) => candidate.id === id) ?? null,
    async (admin, scope) => {
      const { data } = await admin
        .from("menu_items")
        .select("*")
        .eq("id", id)
        .eq("organization_id", scope.organizationId)
        .single();

      if (!data) return null;

      return {
        id: data.id,
        organizationId: data.organization_id,
        name: data.name,
        description: optionalText(data.description),
        price: numberValue(data.price),
        category: data.category ?? "general",
        recipeId: optionalText(data.recipe_id),
        status: data.status === "active" ? "active" as const : "inactive" as const,
      };
    },
  );
}

/**
 * Calculate recipe cost breakdown
 */
export async function calculateRecipeCost(recipeId: string) {
  const recipe = await getRecipe(recipeId);
  if (!recipe) return null;

  const materialCost = recipe.recipe.totalCost;
  const costPerUnit = recipe.recipe.costPerUnit;
  const suggestedPrice = costPerUnit / 0.65; // Assuming 65% margin target

  return {
    recipeId,
    materialCost,
    costPerUnit,
    suggestedPrice,
    lastCalculated: new Date().toISOString(),
  };
}

/**
 * Get high-cost recipes (for alerts)
 */
export async function getHighCostRecipes(thresholdPercent = 35) {
  const bundle = await getRecipesData();
  
  return bundle.recipes.filter((recipe) => {
    // This would need actual selling price to calculate percentage
    // For now, flag recipes with high absolute cost
    return recipe.costPerUnit > 15;
  });
}