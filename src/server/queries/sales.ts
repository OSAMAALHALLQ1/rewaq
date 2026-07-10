/**
 * Sales domain queries
 * Handles customer invoices, POS, and receipts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  type AdminClient,
} from "./_shared/utils";
import { mapCustomerInvoice, mapMenuItem } from "./_shared/mappers";
import { mapRecipe, mapRecipeIngredient } from "./_shared/mappers";
import type {
  Branch,
  BranchStock,
  CatalogItem,
  CustomerInvoice,
  InventoryItem,
  MenuItem,
  Organization,
  Recipe,
  SalesShift,
  DigitalReceiptShare,
} from "@/types/domain";

// ============================================================================
// Types
// ============================================================================

export type CustomerInvoicesBundle = {
  invoices: CustomerInvoice[];
  branches: Branch[];
  menuItems: MenuItem[];
  catalogItems: CatalogItem[];
  recipes: Recipe[];
  inventoryItems: InventoryItem[];
  branchStock: BranchStock[];
  shift: SalesShift;
  organization: Organization;
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
  const [invoices, recipes, catalog, inventory, shiftRows] = await Promise.all([
    loadCustomerInvoices(admin, organizationId),
    loadRecipesBundle(admin, organizationId),
    loadCatalogBundle(admin, organizationId),
    loadInventoryBundle(admin, organizationId),
    (admin as any)
      .from("sales_shifts")
      .select("*")
      .eq("organization_id", organizationId)
      .order("opened_at", { ascending: false })
      .limit(1),
  ]);

  const context = await loadOrganizationContext(admin, organizationId);
  const shiftRow = shiftRows.data?.[0];
  const shift: SalesShift = shiftRow
    ? {
        id: shiftRow.id,
        branchName: context.branches.find((branch) => branch.id === shiftRow.branch_id)?.name ?? "الفرع",
        cashierName: shiftRow.cashier_name ?? "كاشير",
        openedAt: shiftRow.opened_at,
        openingCash: numberValue(shiftRow.opening_cash),
        cashSales: numberValue(shiftRow.cash_sales),
        cardSales: numberValue(shiftRow.card_sales),
        expenses: numberValue(shiftRow.expenses),
        withdrawals: numberValue(shiftRow.withdrawals),
        deposits: numberValue(shiftRow.deposits),
        expectedCash: numberValue(shiftRow.expected_cash),
        actualCash: shiftRow.actual_cash === null ? undefined : numberValue(shiftRow.actual_cash),
        difference: numberValue(shiftRow.difference),
        status: shiftRow.status === "closed" ? "closed" : "open",
      }
    : {
        id: "shift-1",
        branchName: context.branches[0]?.name ?? "الفرع",
        openedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        cashierName: "أحمد",
        openingCash: 500,
        cashSales: 0,
        cardSales: 0,
        expenses: 0,
        withdrawals: 0,
        deposits: 0,
        expectedCash: 500,
        difference: 0,
        status: "open",
      };

  return {
    invoices,
    branches: context.branches,
    menuItems: recipes.menuItems,
    catalogItems: catalog.items,
    recipes: recipes.recipes,
    inventoryItems: inventory.items,
    branchStock: inventory.branchStock,
    shift,
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
      const ingredients = (ingredientsByRecipe.get(row.id) ?? []).map((ing) => mapRecipeIngredient(ing, itemMap, unitMap));
      return mapRecipe(row, ingredients, branchMap);
    }),
    menuItems: menuItemRows.map((row) => mapMenuItem(row, branchMap)),
  };
}

async function loadCatalogBundle(admin: AdminClient, organizationId: string) {
  const [itemRows, barcodeRows] = await Promise.all([
    query(admin.from("catalog_items").select("*").eq("organization_id", organizationId).order("name"), "catalog_items"),
    query(admin.from("item_barcodes").select("*").eq("organization_id", organizationId), "item_barcodes"),
  ]);

  const barcodesByItem = groupBy(barcodeRows, (row) => row.item_id);

  return {
    items: itemRows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      code: row.code ?? row.sku ?? row.id.slice(0, 8),
      name: row.name,
      barcodes: [row.barcode, ...(barcodesByItem.get(row.id) ?? []).map((barcode) => barcode.barcode)].filter(Boolean).map(String),
      categoryName: row.category ?? "general",
      mainUnit: row.main_unit ?? "قطعة",
      units: [],
      purchasePrice: numberValue(row.purchase_price),
      retailPrice: numberValue(row.price ?? row.retail_price),
      wholesalePrice: numberValue(row.wholesale_price),
      minimumQuantity: numberValue(row.minimum_quantity),
      taxRate: numberValue(row.tax_rate),
      isActive: row.status === "active",
      stockQuantity: numberValue(row.stock_quantity),
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

  return withAdminScope<CustomerInvoicesBundle>(
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
export async function getDigitalReceiptShares(): Promise<DigitalReceiptShare[]> {
  if (isDemoMode()) {
    return [
      {
        id: "share-1",
        invoiceId: "inv-1",
        shareToken: "abc123",
        invoiceNumber: "فاتورة-٢٠٢٦٠٥-١٩١٥",
        customerName: "عميل نقدي",
        total: 55,
        receiptUrl: "https://rewaq.app/r/202605-1915",
        sentAt: "2026-05-16T19:15:00Z",
        status: "viewed" as const,
      },
    ];
  }

  return withAdminScope<DigitalReceiptShare[]>(
    [
      {
        id: "share-1",
        invoiceId: "inv-1",
        shareToken: "abc123",
        invoiceNumber: "فاتورة-٢٠٢٦٠٥-١٩١٥",
        customerName: "عميل نقدي",
        total: 55,
        receiptUrl: "https://rewaq.app/r/202605-1915",
        sentAt: "2026-05-16T19:15:00Z",
        status: "viewed" as const,
      },
    ],
    async (admin, scope) => {
      const { data, error } = await admin
        .from("digital_receipt_shares")
        .select(`
          id,
          invoice_id,
          share_token,
          total,
          status,
          sent_at,
          customer_invoices (
            invoice_number,
            customer_name
          )
        `)
        .eq("organization_id", scope.organizationId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw new Error(error.message);

      return (data ?? []).map((row: any) => ({
        id: row.id,
        invoiceId: row.invoice_id,
        shareToken: row.share_token,
        invoiceNumber: row.customer_invoices?.invoice_number ?? "بدون رقم",
        customerName: row.customer_invoices?.customer_name ?? "عميل غير معروف",
        total: numberValue(row.total),
        receiptUrl: `/r/customer-invoices/${row.invoice_id}`,
        sentAt: row.sent_at,
        status: row.status as "ready" | "viewed" | "sent",
      }));
    },
  );
}
