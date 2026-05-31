/**
 * Sales domain queries
 * Handles customer invoices, POS, and receipts
 */
import "server-only";
import {
  demoCustomerInvoices,
  demoBranches,
  demoMenuItems,
  demoCatalogItems,
  demoRecipes,
  demoInventoryItems,
  demoBranchStock,
  demoSalesShift,
  demoOrganization,
} from "@/lib/demo-data";
import {
  isDemoMode,
  withAdminScope,
  query,
  indexBy,
  groupBy,
  numberValue,
  optionalText,
  fallbackContext,
  type AdminClient,
} from "./_shared/utils";
import { mapCustomerInvoice, mapMenuItem } from "./_shared/mappers";

// ============================================================================
// Types
// ============================================================================

export type CustomerInvoicesBundle = {
  invoices: typeof demoCustomerInvoices;
  branches: typeof demoBranches;
  menuItems: typeof demoMenuItems;
  catalogItems: typeof demoCatalogItems;
  recipes: typeof demoRecipes;
  inventoryItems: typeof demoInventoryItems;
  branchStock: typeof demoBranchStock;
  shift: typeof demoSalesShift;
  organization: typeof demoOrganization;
};

// ============================================================================
// Loaders
// ============================================================================

async function loadCustomerInvoices(admin: AdminClient, organizationId: string, invoiceId?: string) {
  let invoiceQuery = admin
    .from("customer_invoices")
    .select("*")
    .eq("organization_id", organizationId)
    .order("issued_at", { ascending: false })
    .limit(200);

  if (invoiceId) {
    invoiceQuery = invoiceQuery.eq("id", invoiceId);
  }

  const [invoiceRows, itemRows, branchRows] = await Promise.all([
    query(invoiceQuery, "customer_invoices"),
    query(admin.from("customer_invoice_items").select("*").eq("organization_id", organizationId), "customer_invoice_items"),
    query(admin.from("branches").select("*").eq("organization_id", organizationId), "branches"),
  ]);

  const branchMap = indexBy(branchRows, (row) => row.id);
  const itemsByInvoice = groupBy(itemRows, (row) => row.customer_invoice_id);

  return invoiceRows.map((row) => mapCustomerInvoice(row, branchMap, itemsByInvoice.get(row.id) ?? []));
}

async function loadSalesBundle(admin: AdminClient, organizationId: string) {
  const [invoices, recipes, catalog, inventory] = await Promise.all([
    loadCustomerInvoices(admin, organizationId),
    loadRecipesBundle(admin, organizationId),
    loadCatalogBundle(admin, organizationId),
    loadInventoryBundle(admin, organizationId),
  ]);

  const context = await loadOrganizationContext(admin, organizationId);

  return {
    invoices,
    branches: context.branches,
    menuItems: recipes.menuItems,
    catalogItems: catalog.items,
    recipes: recipes.recipes,
    inventoryItems: inventory.items,
    branchStock: inventory.branchStock,
    shift: {
      id: "shift-1",
      branchId: context.branches[0]?.id ?? "",
      branchName: context.branches[0]?.name ?? "الفرع",
      openedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      closedAt: null,
      cashierName: "أحمد",
      openingCash: 500,
      totalSales: 0,
      cashPayments: 0,
      cardPayments: 0,
      voidCount: 0,
      voidAmount: 0,
      customersServed: 0,
      status: "open" as const,
    },
    organization: context.organization,
  };
}

async function loadOrganizationContext(admin: AdminClient, organizationId: string) {
  const [organizationRow, branchRows] = await Promise.all([
    query<any>(admin.from("organizations").select("*").eq("id", organizationId).single(), "organization"),
    query<any[]>(admin.from("branches").select("*").eq("organization_id", organizationId).order("name", { ascending: true }), "branches"),
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
      const ingredients = (ingredientsByRecipe.get(row.id) ?? []).map((ing) => ({
        itemId: ing.item_id,
        itemName: itemMap.get(ing.item_id)?.name ?? "مادة غير معروفة",
        quantity: numberValue(ing.quantity),
        unit: unitMap.get(ing.unit_id)?.name ?? "",
        unitCost: numberValue(ing.unit_cost),
        cost: numberValue(ing.cost),
      }));
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
  };
}

async function loadCatalogBundle(admin: AdminClient, organizationId: string) {
  const [itemRows, barcodeRows] = await Promise.all([
    query(admin.from("catalog_items").select("*").eq("organization_id", organizationId).order("name"), "catalog_items"),
    query(admin.from("item_barcodes").select("*").eq("organization_id", organizationId), "item_barcodes"),
  ]);

  return {
    items: itemRows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      barcode: row.barcode ?? "",
      price: numberValue(row.price),
      category: row.category ?? "general",
      status: row.status === "active" ? "active" as const : "inactive" as const,
    })),
  };
}

async function loadInventoryBundle(admin: AdminClient, organizationId: string) {
  const [itemRows, stockRows, branchRows] = await Promise.all([
    query(admin.from("inventory_items").select("*").eq("organization_id", organizationId).order("name"), "inventory_items"),
    query(admin.from("branch_stock").select("*").eq("organization_id", organizationId), "branch_stock"),
    query(admin.from("branches").select("*").eq("organization_id", organizationId), "branches"),
  ]);

  const branchMap = indexBy(branchRows, (row) => row.id);

  return {
    items: itemRows.map((row) => ({
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
    branchStock: stockRows.map((row) => ({
      branchId: row.branch_id,
      branchName: branchMap.get(row.branch_id)?.name ?? "فرع غير معروف",
      itemId: row.item_id,
      quantity: numberValue(row.quantity),
      reservedQuantity: numberValue(row.reserved_quantity),
    })),
  };
}

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Get full customer invoices bundle
 */
export async function getCustomerInvoicesData(): Promise<CustomerInvoicesBundle> {
  if (isDemoMode()) {
    return {
      invoices: demoCustomerInvoices,
      branches: demoBranches,
      menuItems: demoMenuItems,
      catalogItems: demoCatalogItems,
      recipes: demoRecipes,
      inventoryItems: demoInventoryItems,
      branchStock: demoBranchStock,
      shift: demoSalesShift,
      organization: demoOrganization,
    };
  }

  return withAdminScope(
    {
      invoices: demoCustomerInvoices,
      branches: demoBranches,
      menuItems: demoMenuItems,
      catalogItems: demoCatalogItems,
      recipes: demoRecipes,
      inventoryItems: demoInventoryItems,
      branchStock: demoBranchStock,
      shift: demoSalesShift,
      organization: demoOrganization,
    },
    async (admin, scope) => loadSalesBundle(admin, scope.organizationId),
  );
}

/**
 * Get single customer invoice
 */
export async function getCustomerInvoice(id: string) {
  if (isDemoMode()) {
    return demoCustomerInvoices.find((invoice) => invoice.id === id) ?? null;
  }

  return withAdminScope(
    demoCustomerInvoices.find((invoice) => invoice.id === id) ?? null,
    async (admin, scope) => (await loadCustomerInvoices(admin, scope.organizationId, id))[0] ?? null,
  );
}

/**
 * Get digital receipt shares
 */
export async function getDigitalReceiptShares() {
  if (isDemoMode()) {
    return [
      {
        id: "share-1",
        invoiceId: "inv-1",
        shareToken: "abc123",
        total: 85,
        receiptUrl: "/r/customer-invoices/inv-1",
        sentAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        status: "ready" as const,
      },
    ];
  }

  return withAdminScope(
    [
      {
        id: "share-1",
        invoiceId: "inv-1",
        shareToken: "abc123",
        total: 85,
        receiptUrl: "/r/customer-invoices/inv-1",
        sentAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        status: "ready" as const,
      },
    ],
    async (admin, scope) => {
      const { data } = await admin
        .from("digital_receipt_shares")
        .select("*")
        .eq("organization_id", scope.organizationId)
        .order("created_at", { ascending: false })
        .limit(50);

      return (data ?? []).map((row: any) => ({
        id: row.id,
        invoiceId: row.invoice_id,
        shareToken: row.share_token,
        total: numberValue(row.total),
        receiptUrl: `/r/customer-invoices/${row.invoice_id}`,
        sentAt: row.sent_at,
        status: row.status === "viewed" ? "viewed" as const : "ready" as const,
      }));
    },
  );
}