import "server-only";

import { demoBranches, demoRecipes } from "@/lib/demo-data";
import { isDemoMode, withAdminScope, query, indexBy, groupBy, numberValue, optionalText } from "./_shared/utils";

export type ProductionOrderMaterial = {
  id: string;
  itemName: string;
  sourceBranchName: string;
  plannedQuantity: number;
  issuedQuantity: number;
  unitCost: number;
  totalCost: number;
};

export type ProductionOrderSummary = {
  id: string;
  orderNumber: string;
  recipeName: string;
  branchName: string;
  status: string;
  plannedQuantity: number;
  completedQuantity: number;
  materialCost: number;
  completedAt: string | null;
  notes?: string;
  materials: ProductionOrderMaterial[];
};

export type ProductionData = {
  orders: ProductionOrderSummary[];
  recipes: { id: string; name: string; servings: number }[];
  branches: { id: string; name: string }[];
};

type ProductionOrderRow = {
  id: string;
  order_number: string;
  recipe_id: string;
  branch_id: string;
  status: string;
  planned_quantity: number | string | null;
  completed_quantity: number | string | null;
  material_cost: number | string | null;
  completed_at: string | null;
  notes: string | null;
};

type ProductionMaterialRow = {
  id: string;
  production_order_id: string;
  source_branch_id: string;
  item_id: string;
  planned_quantity: number | string | null;
  issued_quantity: number | string | null;
  unit_cost: number | string | null;
  total_cost: number | string | null;
};

type RecipeOptionRow = {
  id: string;
  name: string;
  servings: number | string | null;
};

type NamedRow = {
  id: string;
  name: string;
};

const demoProductionData: ProductionData = {
  orders: [],
  recipes: demoRecipes.map((recipe) => ({ id: recipe.id, name: recipe.name, servings: recipe.servings })),
  branches: demoBranches.map((branch) => ({ id: branch.id, name: branch.name })),
};

async function loadProductionData(admin: any, organizationId: string): Promise<ProductionData> {
  const [orderRows, materialRows, recipeRows, branchRows, itemRows] = await Promise.all([
    query<ProductionOrderRow[]>(
      admin
        .from("production_orders")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(100),
      "production_orders",
    ),
    query<ProductionMaterialRow[]>(
      admin.from("production_order_materials").select("*").eq("organization_id", organizationId),
      "production_order_materials",
    ),
    query<RecipeOptionRow[]>(
      admin.from("recipes").select("id,name,servings").eq("organization_id", organizationId).order("name"),
      "recipes",
    ),
    query<NamedRow[]>(admin.from("branches").select("id,name").eq("organization_id", organizationId).order("name"), "branches"),
    query<NamedRow[]>(admin.from("inventory_items").select("id,name").eq("organization_id", organizationId), "inventory_items"),
  ]);

  const recipeMap = indexBy(recipeRows, (row) => row.id);
  const branchMap = indexBy(branchRows, (row) => row.id);
  const itemMap = indexBy(itemRows, (row) => row.id);
  const materialsByOrder = groupBy(materialRows, (row) => row.production_order_id);

  return {
    orders: orderRows.map((order): ProductionOrderSummary => {
      const materials = (materialsByOrder.get(order.id) ?? []).map((material): ProductionOrderMaterial => ({
        id: material.id,
        itemName: itemMap.get(material.item_id)?.name ?? "مادة غير معروفة",
        sourceBranchName: branchMap.get(material.source_branch_id)?.name ?? "مستودع غير معروف",
        plannedQuantity: numberValue(material.planned_quantity),
        issuedQuantity: numberValue(material.issued_quantity),
        unitCost: numberValue(material.unit_cost),
        totalCost: numberValue(material.total_cost),
      }));

      return {
        id: order.id,
        orderNumber: order.order_number,
        recipeName: recipeMap.get(order.recipe_id)?.name ?? "وصفة غير معروفة",
        branchName: branchMap.get(order.branch_id)?.name ?? "فرع غير معروف",
        status: order.status,
        plannedQuantity: numberValue(order.planned_quantity),
        completedQuantity: numberValue(order.completed_quantity),
        materialCost: numberValue(order.material_cost),
        completedAt: order.completed_at ?? null,
        notes: optionalText(order.notes),
        materials,
      };
    }),
    recipes: recipeRows.map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      servings: numberValue(recipe.servings),
    })),
    branches: branchRows.map((branch) => ({
      id: branch.id,
      name: branch.name,
    })),
  };
}

export async function getProductionData(): Promise<ProductionData> {
  if (isDemoMode()) {
    return demoProductionData;
  }

  return withAdminScope<ProductionData>(
    demoProductionData,
    (admin, scope) => loadProductionData(admin, scope.organizationId),
  );
}
