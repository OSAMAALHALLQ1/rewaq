/**
 * Inventory domain queries
 * Handles stock, movements, waste, and transfers
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import {
  demoInventoryItems,
  demoCategories,
  demoBranchStock,
  demoStockMovements,
  demoSuppliers,
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
  type OrganizationContext,
  type BranchRow,
  fallbackContext,
} from "./_shared/utils";
import { mapSupplier, mapInventoryItem, mapBranchStock, mapStockMovement } from "./_shared/mappers";
import type { Branch, BranchStock, InventoryCategory, InventoryItem, StockMovement, Supplier } from "@/types/domain";

// ============================================================================
// Types
// ============================================================================

export type InventoryBundle = {
  items: InventoryItem[];
  categories: InventoryCategory[];
  branchStock: BranchStock[];
  movements: StockMovement[];
  suppliers: Supplier[];
  branches: Branch[];
};

export type StockCountSummary = {
  id: string;
  countNumber: string;
  branchId: string;
  branchName: string;
  status: string;
  countedAt: string | null;
  approvedAt: string | null;
  warehouse: string;
  blindCount: boolean;
  snapshotAt: string | null;
  varianceApprovalThreshold: number;
  itemsCount: number;
  varianceCount: number;
  notes?: string;
  lines: Array<{
    id: string;
    itemId: string;
    itemName: string;
    systemQuantity: number;
    firstCountQuantity: number | null;
    secondCountQuantity: number | null;
    countedQuantity: number | null;
    varianceQuantity: number | null;
    varianceReason?: string;
    countState: string;
  }>;
};

// ============================================================================
// Loaders (Private - use exported functions)
// ============================================================================

async function loadOrganizationContext(admin: AdminClient, organizationId: string): Promise<OrganizationContext> {
  const [organizationRow, branchRows] = await Promise.all([
    query<any>(
      admin.from("organizations").select("*").eq("id", organizationId).single(),
      "organization",
    ),
    query<BranchRow[]>(
      admin.from("branches").select("*").eq("organization_id", organizationId).order("name", { ascending: true }),
      "branches",
    ),
  ]);

  return {
    organization: {
      id: organizationRow.id,
      name: organizationRow.name,
      slug: organizationRow.slug,
      plan: organizationRow.plan,
      status: organizationRow.status as any,
    },
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

async function loadInventoryBundle(admin: AdminClient, organizationId: string) {
  const [
    categoryRows,
    supplierRows,
    unitRows,
    itemRows,
    stockRows,
    movementRows,
    branchRows,
    priceRows,
  ] = await Promise.all([
    query(admin.from("inventory_categories").select("*").eq("organization_id", organizationId).order("name"), "inventory_categories"),
    query(admin.from("suppliers").select("*").eq("organization_id", organizationId).order("name"), "suppliers"),
    query(admin.from("units").select("*").eq("organization_id", organizationId).order("name"), "units"),
    query(admin.from("inventory_items").select("*").eq("organization_id", organizationId).order("name"), "inventory_items"),
    query(admin.from("branch_stock").select("*").eq("organization_id", organizationId), "branch_stock"),
    query(
      admin
        .from("stock_movements")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(150),
      "stock_movements",
    ),
    query(admin.from("branches").select("*").eq("organization_id", organizationId), "branches"),
    query(
      admin
        .from("supplier_price_history")
        .select("*")
        .eq("organization_id", organizationId)
        .order("recorded_at", { ascending: false })
        .limit(250),
      "supplier_price_history",
    ),
  ]);

  const categoryMap = indexBy(categoryRows, (row) => row.id);
  const supplierMap = indexBy(supplierRows, (row) => row.id);
  const unitMap = indexBy(unitRows, (row) => row.id);
  const branchMap = indexBy(branchRows, (row) => row.id);
  const itemMap = indexBy(itemRows, (row) => row.id);
  const priceRiskBySupplier = new Map<string, number>();

  for (const row of priceRows) {
    const current = priceRiskBySupplier.get(row.supplier_id) ?? 0;
    priceRiskBySupplier.set(row.supplier_id, Math.max(current, Math.abs(numberValue(row.price_change_percent))));
  }

  return {
    items: itemRows.map((row) => mapInventoryItem(row, categoryMap, supplierMap, unitMap)),
    categories: categoryRows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
    })),
    branchStock: stockRows.map((row) => mapBranchStock(row, branchMap)),
    movements: movementRows.map((row) => mapStockMovement(row, branchMap, itemMap)),
    suppliers: supplierRows.map((row) => mapSupplier(row, priceRiskBySupplier.get(row.id) ?? 0)),
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

async function loadStockCountsBundle(admin: AdminClient, organizationId: string) {
  const [inventory, countRows, countItemRows] = await Promise.all([
    loadInventoryBundle(admin, organizationId),
    query<any[]>(
      admin
        .from("stock_counts")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(100),
      "stock_counts",
    ),
    query<any[]>(admin.from("stock_count_items").select("*").eq("organization_id", organizationId), "stock_count_items"),
  ]);

  const branchMap = indexBy(inventory.branches, (row) => row.id);
  const itemMap = indexBy(inventory.items, (row) => row.id);
  const itemsByCount = groupBy(countItemRows, (row) => row.stock_count_id);

  return {
    ...inventory,
    counts: countRows.map((count): StockCountSummary => {
      const items = itemsByCount.get(count.id) ?? [];
      const lines = items.map((item) => ({
        id: item.id,
        itemId: item.item_id,
        itemName: itemMap.get(item.item_id)?.name ?? "مادة غير معروفة",
        systemQuantity: numberValue(item.system_quantity),
        firstCountQuantity: item.first_count_quantity === null || item.first_count_quantity === undefined
          ? null
          : numberValue(item.first_count_quantity),
        secondCountQuantity: item.second_count_quantity === null || item.second_count_quantity === undefined
          ? null
          : numberValue(item.second_count_quantity),
        countedQuantity: item.counted_quantity === null || item.counted_quantity === undefined
          ? null
          : numberValue(item.counted_quantity),
        varianceQuantity: item.counted_quantity === null || item.counted_quantity === undefined
          ? null
          : numberValue(item.counted_quantity) - numberValue(item.system_quantity),
        varianceReason: optionalText(item.variance_reason),
        countState: String(item.count_state ?? "resolved"),
      }));

      return {
        id: count.id,
        countNumber: count.count_number ?? count.id.slice(0, 8),
        branchId: count.branch_id,
        branchName: branchMap.get(count.branch_id)?.name ?? "قسم غير معروف",
        status: count.status,
        countedAt: count.counted_at,
        approvedAt: count.approved_at,
        warehouse: count.warehouse ?? "all",
        blindCount: Boolean(count.blind_count ?? false),
        snapshotAt: count.snapshot_at ?? null,
        varianceApprovalThreshold: numberValue(count.variance_approval_threshold),
        itemsCount: items.length,
        varianceCount: lines.filter((item) => item.varianceQuantity !== null && item.varianceQuantity !== 0).length,
        notes: optionalText(count.notes),
        lines,
      };
    }),
  };
}

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Get organization context (org + branches)
 */
export async function getOrganizationContext(): Promise<OrganizationContext> {
  if (isDemoMode()) {
    return fallbackContext;
  }

  return withAdminScope(fallbackContext, (admin, scope) => loadOrganizationContext(admin, scope.organizationId));
}

/**
 * Get full inventory bundle
 */
export async function getInventoryData(): Promise<InventoryBundle> {
  if (isDemoMode()) {
    return {
      items: demoInventoryItems,
      categories: demoCategories,
      branchStock: demoBranchStock,
      movements: demoStockMovements,
      suppliers: demoSuppliers,
      branches: demoBranches,
    };
  }

  return withAdminScope<InventoryBundle>(
    {
      items: demoInventoryItems,
      categories: demoCategories,
      branchStock: demoBranchStock,
      movements: demoStockMovements,
      suppliers: demoSuppliers,
      branches: demoBranches,
    },
    (admin, scope) => loadInventoryBundle(admin, scope.organizationId),
  );
}

/**
 * Get stock counts bundle
 */
export async function getStockCountsData(): Promise<InventoryBundle & { counts: StockCountSummary[] }> {
  if (isDemoMode()) {
    return {
      items: demoInventoryItems,
      categories: demoCategories,
      branchStock: demoBranchStock,
      movements: demoStockMovements,
      suppliers: demoSuppliers,
      branches: demoBranches,
      counts: [],
    };
  }

  return withAdminScope<InventoryBundle & { counts: StockCountSummary[] }>(
    {
      items: demoInventoryItems,
      categories: demoCategories,
      branchStock: demoBranchStock,
      movements: demoStockMovements,
      suppliers: demoSuppliers,
      branches: demoBranches,
      counts: [] as StockCountSummary[],
    },
    (admin, scope) => loadStockCountsBundle(admin, scope.organizationId),
  );
}

/**
 * Get single inventory item with stock and movements
 */
export async function getInventoryItem(id: string) {
  if (isDemoMode()) {
    const item = demoInventoryItems.find((candidate) => candidate.id === id);
    return item
      ? {
          item,
          stock: demoBranchStock.filter((stock) => stock.itemId === id),
          movements: demoStockMovements.filter((movement) => movement.itemId === id),
          branches: demoBranches,
        }
      : null;
  }

  return withAdminScope(
    (() => {
      const item = demoInventoryItems.find((candidate) => candidate.id === id);
      return item
        ? {
            item,
            stock: demoBranchStock.filter((stock) => stock.itemId === id),
            movements: demoStockMovements.filter((movement) => movement.itemId === id),
            branches: demoBranches,
          }
        : null;
    })(),
    async (admin, scope) => {
      const inventory = await loadInventoryBundle(admin, scope.organizationId);
      const item = inventory.items.find((candidate) => candidate.id === id);
      return item
        ? {
            item,
            stock: inventory.branchStock.filter((stock) => stock.itemId === id),
            movements: inventory.movements.filter((movement) => movement.itemId === id),
            branches: inventory.branches,
          }
        : null;
    },
  );
}
