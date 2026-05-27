import "server-only";
import {
  demoAdminMetrics,
  demoBranches,
  demoBranchStock,
  demoBillPaymentBatches,
  demoCatalogItems,
  demoCostTracking,
  demoCategories,
  demoCustomerInvoices,
  demoDashboard,
  demoDirectDebitMandates,
  demoDirectDebitRuns,
  demoDigitalReceiptShares,
  demoFinancialCalendar,
  demoInvoices,
  demoInventoryItems,
  demoMenuItems,
  demoNotifications,
  demoOrganization,
  demoPayableBills,
  demoPermissionSettings,
  demoPurchaseOrders,
  demoRecipes,
  demoRestaurantTables,
  demoSalesShift,
  demoSmartSavingsFeatures,
  demoSocialAccounts,
  demoSocialPosts,
  demoSocialTemplates,
  demoStockMovements,
  demoSuppliers,
  demoSystemLogs,
  demoTransfers,
  demoWasteLogs,
} from "@/lib/demo-data";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { mergeCategoryNames } from "@/lib/catalog/categories";
import type { Tables } from "@/types/database";
import type {
  AdminMetric,
  BillPaymentBatch,
  Branch,
  BranchStock,
  CatalogItem,
  CatalogUnit,
  CostTrackingData,
  CustomerInvoice,
  CustomerInvoiceItem,
  DashboardData,
  DirectDebitMandate,
  DirectDebitRun,
  DigitalReceiptShare,
  FinancialCalendarDay,
  FinancialCalendarExpense,
  FinancialCalendarSale,
  InventoryCategory,
  InventoryItem,
  Invoice,
  MenuItem,
  Notification,
  Organization,
  PayableBill,
  PurchaseOrder,
  PurchaseOrderItem,
  Recipe,
  RecipeIngredient,
  RestaurantTable,
  Role,
  SmartSavingsFeature,
  SocialAccount,
  SocialPlatform,
  SocialPost,
  SocialPostTarget,
  SocialTemplate,
  StockMovement,
  StockMovementType,
  Supplier,
  Transfer,
  WasteLog,
} from "@/types/domain";

export type AccountApprovalRequest = {
  id: string;
  email: string;
  authUserId: string | null;
  authEmailConfirmed: boolean;
  authLastSignInAt: string | null;
  organizationId: string | null;
  ownerName: string;
  organizationName: string;
  businessType: string;
  phone: string | null;
  status: string;
  requestedAt: string;
  approvedAt: string | null;
  rejectionReason: string | null;
};

type AdminClient = ReturnType<typeof createAdminClient>;
type QueryResult<T> = { data: T | null; error: { message: string } | null };
type AppScope = { organizationId: string; branchId: string | null };
type BranchRow = Tables<"branches">;
type CatalogItemRow = Tables<"catalog_items">;
type CustomerInvoiceItemRow = Tables<"customer_invoice_items">;
type CustomerInvoiceRow = Tables<"customer_invoices">;
type DailyCostEntryRow = Tables<"daily_cost_entries">;
type InventoryItemRow = Tables<"inventory_items">;
type ItemBarcodeRow = Tables<"item_barcodes">;
type MenuItemRecipeMappingRow = Tables<"menu_item_recipe_mapping">;
type MenuItemRow = Tables<"menu_items">;
type NotificationRow = Tables<"notifications">;
type RecipeIngredientRow = Tables<"recipe_ingredients">;
type RecipeRow = Tables<"recipes">;
type SalesDailySummaryRow = Tables<"sales_daily_summaries">;
type SocialAccountRow = Tables<"social_accounts">;
type SocialMediaAssetRow = Tables<"social_media_assets">;
type SocialPostRow = Tables<"social_posts">;
type SocialPostTargetRow = Tables<"social_post_targets">;
type SupplierRow = Tables<"suppliers">;
type BillPaymentsData = {
  bills: PayableBill[];
  batches: BillPaymentBatch[];
  mandates: DirectDebitMandate[];
  runs: DirectDebitRun[];
};
export type StockCountSummary = {
  id: string;
  branchName: string;
  status: string;
  countedAt: string | null;
  approvedAt: string | null;
  itemsCount: number;
  varianceCount: number;
  notes?: string;
};

const fallbackContext = {
  organization: demoOrganization,
  branches: demoBranches,
};

const smartSavingsFeatures: SmartSavingsFeature[] = [
  {
    id: "mobile-scanner",
    title: "ماسح جوال",
    description: "استخدام كاميرا الجوال لمسح المنتج وإضافته للفاتورة دون شراء جهاز ماسح منفصل.",
    monthlySaving: 120,
    status: "active",
  },
  {
    id: "digital-receipts",
    title: "فواتير رقمية",
    description: "إظهار رمز استجابة للزبون لتنزيل الفاتورة على جواله بدل الطباعة الورقية.",
    monthlySaving: 90,
    status: "active",
  },
  {
    id: "remote-management",
    title: "إدارة من أي مكان",
    description: "متابعة المبيعات والفروع والفواتير من البيت أو الطريق عبر لوحة تحكم سحابية.",
    monthlySaving: 160,
    status: "available",
  },
  {
    id: "device-light",
    title: "تجهيزات أخف",
    description: "تقليل الاعتماد على أجهزة باركود وطابعات وصيانة مستمرة، مع بقاء البيع سريعًا.",
    monthlySaving: 140,
    status: "available",
  },
];

/** Wraps a Supabase query, throws on error/null, and returns typed data. */
async function query<T>(promise: PromiseLike<QueryResult<T>>, label: string): Promise<T> {
  const { data, error } = await promise;

  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }

  if (data === null) {
    throw new Error(`${label}: no data returned`);
  }

  return data as T;
}

async function withAdminScope<T>(
  fallback: T,
  loader: (admin: AdminClient, scope: AppScope) => Promise<T>,
): Promise<T> {
  if (!hasSupabaseAdminEnv()) {
    return fallback;
  }

  try {
    const admin = createAdminClient();
    const scope = await resolveScope(admin);
    return await loader(admin, scope);
  } catch (error) {
    console.error("[queries/app]", error instanceof Error ? error.message : error);
    return fallback;
  }
}

async function getCurrentUserId() {
  if (!hasSupabaseEnv()) {
    return null;
  }

  try {
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getClaims();
    return data?.claims?.sub ? String(data.claims.sub) : null;
  } catch {
    return null;
  }
}

async function resolveScope(admin: AdminClient): Promise<AppScope> {
  const userId = await getCurrentUserId();

  if (userId) {
    const { data: membership, error } = await admin
      .from("organization_memberships")
      .select("organization_id, branch_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!error && membership?.organization_id) {
      return {
        organizationId: membership.organization_id,
        branchId: membership.branch_id,
      };
    }
  }

  const { data: demoOrg } = await admin
    .from("organizations")
    .select("id")
    .eq("id", demoOrganization.id)
    .maybeSingle();

  if (demoOrg?.id) {
    return { organizationId: demoOrg.id, branchId: null };
  }

  const { data: firstOrg } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return { organizationId: firstOrg?.id ?? demoOrganization.id, branchId: null };
}

function numberValue(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateKey(value: string | null | undefined) {
  return (value ?? new Date().toISOString()).slice(0, 10);
}

function oneOf<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function optionalText(value: string | null | undefined) {
  return value?.trim() ? value : undefined;
}

function indexBy<T>(rows: T[], getKey: (row: T) => string | null | undefined) {
  return new Map(rows.map((row) => [getKey(row), row]).filter((entry): entry is [string, T] => Boolean(entry[0])));
}

function groupBy<T>(rows: T[], getKey: (row: T) => string | null | undefined) {
  const groups = new Map<string, T[]>();

  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return groups;
}

function sumBy<T>(rows: T[], getValue: (row: T) => number) {
  return rows.reduce((sum, row) => sum + getValue(row), 0);
}

function mapOrganization(row: Tables<"organizations">): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    status: oneOf(row.status, ["active", "trial", "past_due", "paused"] as const, "trial"),
  };
}

function mapBranch(row: BranchRow): Branch {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    city: row.city ?? "",
    address: row.address ?? "",
    manager: row.manager_name ?? "",
    status: row.status === "inactive" || row.status === "archived" ? "inactive" : "active",
  };
}

function mapSupplier(row: SupplierRow, priceRisk = 0): Supplier {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    notes: optionalText(row.notes),
    status: row.status === "inactive" || row.status === "archived" ? "inactive" : "active",
    priceRisk,
  };
}

function mapInventoryItem(
  row: InventoryItemRow,
  categoryMap: Map<string, Tables<"inventory_categories">>,
  supplierMap: Map<string, SupplierRow>,
  unitMap: Map<string, Tables<"units">>,
): InventoryItem {
  const supplier = row.primary_supplier_id ? supplierMap.get(row.primary_supplier_id) : null;

  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    categoryId: row.category_id ?? "",
    categoryName: row.category_id ? categoryMap.get(row.category_id)?.name ?? "بدون تصنيف" : "بدون تصنيف",
    purchaseUnit: row.purchase_unit_id ? unitMap.get(row.purchase_unit_id)?.name ?? "" : "",
    usageUnit: row.usage_unit_id ? unitMap.get(row.usage_unit_id)?.name ?? "" : "",
    lastPurchasePrice: numberValue(row.last_purchase_price),
    averageCost: numberValue(row.average_cost),
    minimumQuantity: numberValue(row.minimum_quantity),
    primarySupplierId: optionalText(row.primary_supplier_id),
    primarySupplierName: supplier?.name,
    sku: optionalText(row.sku),
    notes: optionalText(row.notes),
    isActive: row.status === "active",
  };
}

function mapBranchStock(
  row: Tables<"branch_stock">,
  branchMap: Map<string, BranchRow>,
): BranchStock {
  return {
    branchId: row.branch_id,
    branchName: branchMap.get(row.branch_id)?.name ?? "فرع غير معروف",
    itemId: row.item_id,
    quantity: numberValue(row.quantity),
    reservedQuantity: numberValue(row.reserved_quantity),
  };
}

function mapStockMovement(
  row: Tables<"stock_movements">,
  branchMap: Map<string, BranchRow>,
  itemMap: Map<string, InventoryItemRow>,
): StockMovement {
  const movementType = oneOf(
    row.movement_type,
    ["purchase", "sale_usage", "waste", "transfer_in", "transfer_out", "adjustment", "stock_count", "return"] as const,
    "adjustment",
  );

  return {
    id: row.id,
    organizationId: row.organization_id,
    branchId: row.branch_id,
    branchName: branchMap.get(row.branch_id)?.name ?? "فرع غير معروف",
    itemId: row.item_id,
    itemName: itemMap.get(row.item_id)?.name ?? "مادة غير معروفة",
    movementType: movementType as StockMovementType,
    quantity: numberValue(row.quantity),
    unitCost: numberValue(row.unit_cost),
    totalCost: numberValue(row.total_cost),
    reference: optionalText(row.source_doc_type ?? row.source_doc_id ?? undefined),
    notes: optionalText(row.notes),
    createdAt: row.created_at,
  };
}

async function loadBranches(admin: AdminClient, organizationId: string) {
  const rows = await query(
    admin.from("branches").select("*").eq("organization_id", organizationId).order("name", { ascending: true }),
    "branches",
  );

  return rows.map(mapBranch);
}

async function loadOrganizationContext(admin: AdminClient, organizationId: string) {
  const [organizationRow, branchRows] = await Promise.all([
    query<any>(
      admin.from("organizations").select("*").eq("id", organizationId).single(),
      "organization",
    ),
    query<any>(
      admin.from("branches").select("*").eq("organization_id", organizationId).order("name", { ascending: true }),
      "branches",
    ),
  ]);

  return {
    organization: mapOrganization(organizationRow),
    branches: branchRows.map(mapBranch),
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
    categories: mergeCategoryNames(categoryRows.map((row) => row.name)).map((name) => {
      const persisted = categoryRows.find((row) => row.name === name);
      return {
        id: persisted?.id ?? `suggested-${name}`,
        organizationId,
        name,
      };
    }) satisfies InventoryCategory[],
    branchStock: stockRows.map((row) => mapBranchStock(row, branchMap)),
    movements: movementRows.map((row) => mapStockMovement(row, branchMap, itemMap)),
    suppliers: supplierRows.map((row) => mapSupplier(row, priceRiskBySupplier.get(row.id) ?? 0)),
    branches: branchRows.map(mapBranch),
  };
}

async function loadStockCountsBundle(admin: AdminClient, organizationId: string) {
  const [inventory, countRows, countItemRows] = await Promise.all([
    loadInventoryBundle(admin, organizationId),
    query(
      admin
        .from("stock_counts")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(100),
      "stock_counts",
    ),
    query(admin.from("stock_count_items").select("*").eq("organization_id", organizationId), "stock_count_items"),
  ]);

  const branchMap = indexBy(inventory.branches, (row) => row.id);
  const itemsByCount = groupBy(countItemRows, (row) => row.stock_count_id);

  return {
    ...inventory,
    counts: countRows.map((count): StockCountSummary => {
      const items = itemsByCount.get(count.id) ?? [];

      return {
        id: count.id,
        branchName: branchMap.get(count.branch_id)?.name ?? "فرع غير معروف",
        status: count.status,
        countedAt: count.counted_at,
        approvedAt: count.approved_at,
        itemsCount: items.length,
        varianceCount: items.filter((item) => numberValue(item.variance_quantity) !== 0).length,
        notes: optionalText(count.notes),
      };
    }),
  };
}

function mapPurchaseOrder(
  row: Tables<"purchase_orders">,
  supplierMap: Map<string, SupplierRow>,
  branchMap: Map<string, BranchRow>,
  itemMap: Map<string, InventoryItemRow>,
  orderItems: Tables<"purchase_order_items">[],
): PurchaseOrder {
  const items: PurchaseOrderItem[] = orderItems.map((item) => ({
    itemId: item.item_id,
    itemName: itemMap.get(item.item_id)?.name ?? "مادة غير معروفة",
    quantity: numberValue(item.quantity),
    expectedUnitPrice: numberValue(item.expected_unit_price),
    receivedQuantity: numberValue(item.received_quantity),
  }));

  return {
    id: row.id,
    organizationId: row.organization_id,
    supplierId: row.supplier_id,
    supplierName: supplierMap.get(row.supplier_id)?.name ?? "مورد غير معروف",
    branchId: row.branch_id,
    branchName: branchMap.get(row.branch_id)?.name ?? "فرع غير معروف",
    status: row.status,
    orderDate: row.order_date,
    expectedDate: optionalText(row.expected_date),
    total: numberValue(row.total),
    notes: optionalText(row.notes),
    items,
  };
}

async function loadPurchasingBundle(admin: AdminClient, organizationId: string) {
  const [
    supplierRows,
    orderRows,
    orderItemRows,
    invoiceRows,
    branchRows,
    itemRows,
  ] = await Promise.all([
    query(admin.from("suppliers").select("*").eq("organization_id", organizationId).order("name"), "suppliers"),
    query(
      admin
        .from("purchase_orders")
        .select("*")
        .eq("organization_id", organizationId)
        .order("order_date", { ascending: false })
        .limit(150),
      "purchase_orders",
    ),
    query(admin.from("purchase_order_items").select("*").eq("organization_id", organizationId), "purchase_order_items"),
    query(
      admin
        .from("invoices")
        .select("*")
        .eq("organization_id", organizationId)
        .order("issued_at", { ascending: false })
        .limit(150),
      "invoices",
    ),
    query(admin.from("branches").select("*").eq("organization_id", organizationId), "branches"),
    query(admin.from("inventory_items").select("*").eq("organization_id", organizationId), "inventory_items"),
  ]);

  const supplierMap = indexBy(supplierRows, (row) => row.id);
  const branchMap = indexBy(branchRows, (row) => row.id);
  const itemMap = indexBy(itemRows, (row) => row.id);
  const itemsByOrder = groupBy(orderItemRows, (row) => row.purchase_order_id);

  const invoices: Invoice[] = invoiceRows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    supplierName: supplierMap.get(row.supplier_id)?.name ?? "مورد غير معروف",
    branchName: branchMap.get(row.branch_id)?.name ?? "فرع غير معروف",
    invoiceNumber: row.invoice_number ?? row.id.slice(0, 8),
    status: row.status,
    total: numberValue(row.total),
    issuedAt: row.issued_at,
  }));

  return {
    suppliers: supplierRows.map((row) => mapSupplier(row)),
    purchaseOrders: orderRows.map((row) => mapPurchaseOrder(row, supplierMap, branchMap, itemMap, itemsByOrder.get(row.id) ?? [])),
    invoices,
    branches: branchRows.map(mapBranch),
    items: itemRows.map((row) => {
      const emptyCategories = new Map<string, Tables<"inventory_categories">>();
      const emptyUnits = new Map<string, Tables<"units">>();
      return mapInventoryItem(row, emptyCategories, supplierMap, emptyUnits);
    }),
  };
}

function mapCustomerInvoice(
  row: CustomerInvoiceRow,
  branchMap: Map<string, BranchRow>,
  invoiceItems: CustomerInvoiceItemRow[],
): CustomerInvoice {
  const items: CustomerInvoiceItem[] = invoiceItems.map((item) => ({
    id: item.id,
    menuItemId: optionalText(item.menu_item_id),
    name: item.name,
    quantity: numberValue(item.quantity),
    unitPrice: numberValue(item.unit_price),
    total: numberValue(item.total) || numberValue(item.quantity) * numberValue(item.unit_price),
  }));

  return {
    id: row.id,
    organizationId: row.organization_id,
    branchId: row.branch_id,
    branchName: branchMap.get(row.branch_id)?.name ?? "فرع غير معروف",
    invoiceNumber: row.invoice_number,
    customerName: row.customer_name,
    customerPhone: optionalText(row.customer_phone),
    customerTaxNumber: optionalText(row.customer_tax_number),
    status: row.status,
    paymentMethod: row.payment_method,
    issuedAt: row.issued_at,
    notes: optionalText(row.notes),
    subtotal: numberValue(row.subtotal),
    discount: numberValue(row.discount),
    taxRate: numberValue(row.tax_rate),
    taxTotal: numberValue(row.tax_total),
    total: numberValue(row.total),
    items,
  };
}

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

function mapRecipeIngredient(
  row: RecipeIngredientRow,
  itemMap: Map<string, InventoryItemRow>,
  unitMap: Map<string, Tables<"units">>,
): RecipeIngredient {
  return {
    itemId: row.item_id,
    itemName: itemMap.get(row.item_id)?.name ?? "مادة غير معروفة",
    quantity: numberValue(row.quantity),
    unit: row.unit_id ? unitMap.get(row.unit_id)?.name ?? "" : "",
    unitCost: numberValue(row.unit_cost),
    totalCost: numberValue(row.total_cost) || numberValue(row.quantity) * numberValue(row.unit_cost),
  };
}

function mapRecipe(
  row: RecipeRow,
  ingredients: RecipeIngredient[],
): Recipe {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    category: row.category ?? "عام",
    servings: numberValue(row.servings),
    preparation: optionalText(row.preparation),
    ingredients,
    totalCost: numberValue(row.total_cost) || sumBy(ingredients, (ingredient) => ingredient.totalCost),
    costPerServing: numberValue(row.cost_per_serving),
    status: row.status === "archived" ? "archived" : row.status === "inactive" ? "draft" : "active",
  };
}

function mapMenuItem(
  row: MenuItemRow,
  mapping: MenuItemRecipeMappingRow | undefined,
  recipeMap: Map<string, Recipe>,
  branchMap: Map<string, BranchRow>,
): MenuItem {
  const recipe = mapping?.recipe_id ? recipeMap.get(mapping.recipe_id) : undefined;
  const recipeCost = recipe ? recipe.costPerServing * numberValue(mapping?.portion_multiplier ?? 1) : 0;
  const sellingPrice = numberValue(row.selling_price);
  const grossProfit = sellingPrice - recipeCost;

  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    branchId: optionalText(row.branch_id),
    branchName: row.branch_id ? branchMap.get(row.branch_id)?.name : undefined,
    recipeId: mapping?.recipe_id ?? "",
    recipeName: recipe?.name ?? "بدون وصفة",
    sellingPrice,
    recipeCost,
    grossProfit,
    foodCostPercent: sellingPrice > 0 ? (recipeCost / sellingPrice) * 100 : 0,
    profitMarginPercent: sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0,
    imagePath: optionalText(row.image_path),
    status: row.status === "active" ? "active" : "inactive",
  };
}

async function loadRecipesBundle(admin: AdminClient, organizationId: string) {
  const [
    recipeRows,
    ingredientRows,
    itemRows,
    unitRows,
    menuRows,
    mappingRows,
    branchRows,
  ] = await Promise.all([
    query(admin.from("recipes").select("*").eq("organization_id", organizationId).order("name"), "recipes"),
    query(admin.from("recipe_ingredients").select("*").eq("organization_id", organizationId), "recipe_ingredients"),
    query(admin.from("inventory_items").select("*").eq("organization_id", organizationId), "inventory_items"),
    query(admin.from("units").select("*").eq("organization_id", organizationId), "units"),
    query(admin.from("menu_items").select("*").eq("organization_id", organizationId).order("name"), "menu_items"),
    query(admin.from("menu_item_recipe_mapping").select("*").eq("organization_id", organizationId), "menu_item_recipe_mapping"),
    query(admin.from("branches").select("*").eq("organization_id", organizationId), "branches"),
  ]);

  const itemMap = indexBy(itemRows, (row) => row.id);
  const unitMap = indexBy(unitRows, (row) => row.id);
  const branchMap = indexBy(branchRows, (row) => row.id);
  const ingredientsByRecipe = groupBy(ingredientRows, (row) => row.recipe_id);
  const recipes = recipeRows.map((row) =>
    mapRecipe(row, (ingredientsByRecipe.get(row.id) ?? []).map((ingredient) => mapRecipeIngredient(ingredient, itemMap, unitMap))),
  );
  const recipeMap = indexBy(recipes, (row) => row.id);
  const mappingByMenuItem = new Map(mappingRows.map((row) => [row.menu_item_id, row]));

  return {
    recipes,
    menuItems: menuRows.map((row) => mapMenuItem(row, mappingByMenuItem.get(row.id), recipeMap, branchMap)),
    inventoryItems: itemRows.map((row) => {
      const emptyCategories = new Map<string, Tables<"inventory_categories">>();
      const emptySuppliers = new Map<string, SupplierRow>();
      return mapInventoryItem(row, emptyCategories, emptySuppliers, unitMap);
    }),
    branches: branchRows.map(mapBranch),
  };
}

function mapCatalogItem(
  row: CatalogItemRow,
  barcodes: ItemBarcodeRow[],
  inventoryItem: InventoryItemRow | undefined,
  stockQuantity: number,
): CatalogItem {
  const units: CatalogUnit[] = barcodes.length
    ? barcodes.map((barcode) => ({
        name: barcode.unit_name,
        factor: numberValue(barcode.unit_factor),
        barcode: barcode.barcode,
      }))
    : [{ name: row.main_unit, factor: 1 }];

  return {
    id: row.id,
    organizationId: row.organization_id,
    code: row.code,
    name: row.name,
    barcodes: barcodes.map((barcode) => barcode.barcode),
    categoryName: row.category_name ?? inventoryItem?.name ?? "عام",
    mainUnit: row.main_unit,
    units,
    purchasePrice: numberValue(inventoryItem?.last_purchase_price),
    retailPrice: numberValue(row.retail_price),
    wholesalePrice: numberValue(row.wholesale_price),
    branchPrice: row.branch_price === null ? undefined : numberValue(row.branch_price),
    customerPrice: row.customer_price === null ? undefined : numberValue(row.customer_price),
    minimumQuantity: numberValue(inventoryItem?.minimum_quantity),
    taxRate: numberValue(row.tax_rate),
    imagePath: optionalText(row.image_path),
    isActive: row.status === "active",
    stockQuantity,
  };
}

async function loadCatalogBundle(admin: AdminClient, organizationId: string) {
  const [catalogRows, barcodeRows, inventoryRows, stockRows, branchRows] = await Promise.all([
    query(admin.from("catalog_items").select("*").eq("organization_id", organizationId).order("code"), "catalog_items"),
    query(admin.from("item_barcodes").select("*").eq("organization_id", organizationId), "item_barcodes"),
    query(admin.from("inventory_items").select("*").eq("organization_id", organizationId), "inventory_items"),
    query(admin.from("branch_stock").select("*").eq("organization_id", organizationId), "branch_stock"),
    query(admin.from("branches").select("*").eq("organization_id", organizationId).order("name"), "branches"),
  ]);

  const barcodesByCatalog = groupBy(barcodeRows, (row) => row.catalog_item_id);
  const inventoryMap = indexBy(inventoryRows, (row) => row.id);
  const stockByItem = new Map<string, number>();

  for (const stock of stockRows) {
    stockByItem.set(stock.item_id, (stockByItem.get(stock.item_id) ?? 0) + numberValue(stock.quantity));
  }

  return {
    items: catalogRows.map((row) =>
      mapCatalogItem(
        row,
        barcodesByCatalog.get(row.id) ?? [],
        row.inventory_item_id ? inventoryMap.get(row.inventory_item_id) : undefined,
        row.inventory_item_id ? stockByItem.get(row.inventory_item_id) ?? 0 : 0,
      ),
    ),
    categories: mergeCategoryNames(catalogRows.map((row) => row.category_name ?? "")).map((name, index) => ({
      id: `catalog-category-${index}`,
      organizationId,
      name: String(name),
    })),
    branches: branchRows.map(mapBranch),
    permissions: demoPermissionSettings,
  };
}

function mapWasteLog(
  row: Tables<"waste_logs">,
  branchMap: Map<string, BranchRow>,
  itemMap: Map<string, InventoryItemRow>,
): WasteLog {
  return {
    id: row.id,
    organizationId: row.organization_id,
    branchName: branchMap.get(row.branch_id)?.name ?? "فرع غير معروف",
    itemName: itemMap.get(row.item_id)?.name ?? "مادة غير معروفة",
    quantity: numberValue(row.quantity),
    reason: oneOf(
      row.reason,
      ["تلف", "انتهاء صلاحية", "خطأ تحضير", "كسر/انسكاب", "محاريق", "منظفات", "إرجاع", "سبب آخر"] as const,
      "سبب آخر",
    ),
    cost: numberValue(row.cost),
    loggedAt: row.logged_at,
    notes: optionalText(row.notes),
  };
}

async function loadOperationsBundle(admin: AdminClient, organizationId: string) {
  const [wasteRows, transferRows, transferItemRows, branchRows, itemRows] = await Promise.all([
    query(
      admin
        .from("waste_logs")
        .select("*")
        .eq("organization_id", organizationId)
        .order("logged_at", { ascending: false })
        .limit(150),
      "waste_logs",
    ),
    query(
      admin
        .from("transfers")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(150),
      "transfers",
    ),
    query(admin.from("transfer_items").select("*").eq("organization_id", organizationId), "transfer_items"),
    query(admin.from("branches").select("*").eq("organization_id", organizationId), "branches"),
    query(admin.from("inventory_items").select("*").eq("organization_id", organizationId), "inventory_items"),
  ]);

  const branchMap = indexBy(branchRows, (row) => row.id);
  const itemMap = indexBy(itemRows, (row) => row.id);
  const transferItemsByTransfer = groupBy(transferItemRows, (row) => row.transfer_id);

  const transfers: Transfer[] = transferRows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    fromBranchName: branchMap.get(row.from_branch_id)?.name ?? "فرع غير معروف",
    toBranchName: branchMap.get(row.to_branch_id)?.name ?? "فرع غير معروف",
    status: row.status,
    createdAt: row.created_at,
    totalItems: sumBy(transferItemsByTransfer.get(row.id) ?? [], (item) => numberValue(item.quantity)),
  }));

  return {
    wasteLogs: wasteRows.map((row) => mapWasteLog(row, branchMap, itemMap)),
    transfers,
    branches: branchRows.map(mapBranch),
    items: itemRows.map((row) => {
      const emptyCategories = new Map<string, Tables<"inventory_categories">>();
      const emptySuppliers = new Map<string, SupplierRow>();
      const emptyUnits = new Map<string, Tables<"units">>();
      return mapInventoryItem(row, emptyCategories, emptySuppliers, emptyUnits);
    }),
  };
}

function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    organizationId: row.organization_id,
    type: row.type,
    title: row.title,
    body: row.body,
    severity: oneOf(row.severity, ["info", "success", "warning", "danger"] as const, "info"),
    readAt: optionalText(row.read_at),
    createdAt: row.created_at,
  };
}

async function loadNotifications(admin: AdminClient, organizationId: string) {
  const rows = await query(
    admin
      .from("notifications")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(50),
    "notifications",
  );

  return rows.map(mapNotification);
}

async function loadDashboard(admin: AdminClient, organizationId: string): Promise<DashboardData> {
  const [
    invoiceRows,
    stockRows,
    itemRows,
    categoryRows,
    purchaseOrderRows,
    recipeBundle,
    notifications,
    supplierInvoiceRows,
    wasteRows,
    branchRows,
  ] = await Promise.all([
    query(
      admin
        .from("customer_invoices")
        .select("*")
        .eq("organization_id", organizationId)
        .order("issued_at", { ascending: false })
        .limit(500),
      "customer_invoices",
    ),
    query(admin.from("branch_stock").select("*").eq("organization_id", organizationId), "branch_stock"),
    query(admin.from("inventory_items").select("*").eq("organization_id", organizationId), "inventory_items"),
    query(admin.from("inventory_categories").select("*").eq("organization_id", organizationId), "inventory_categories"),
    query(admin.from("purchase_orders").select("*").eq("organization_id", organizationId), "purchase_orders"),
    loadRecipesBundle(admin, organizationId),
    loadNotifications(admin, organizationId),
    query(
      admin
        .from("invoices")
        .select("*")
        .eq("organization_id", organizationId)
        .order("issued_at", { ascending: false })
        .limit(500),
      "invoices",
    ),
    query(admin.from("waste_logs").select("*").eq("organization_id", organizationId), "waste_logs"),
    query(admin.from("branches").select("*").eq("organization_id", organizationId), "branches"),
  ]);

  const itemMap = indexBy(itemRows, (row) => row.id);
  const categoryMap = indexBy(categoryRows, (row) => row.id);
  const branchMap = indexBy(branchRows, (row) => row.id);
  const stockByItem = new Map<string, number>();

  for (const stock of stockRows) {
    stockByItem.set(stock.item_id, (stockByItem.get(stock.item_id) ?? 0) + numberValue(stock.quantity));
  }

  const inventoryValue = sumBy(stockRows, (stock) => numberValue(stock.quantity) * numberValue(itemMap.get(stock.item_id)?.average_cost));
  const lowStockCount = itemRows.filter((item) => (stockByItem.get(item.id) ?? 0) <= numberValue(item.minimum_quantity)).length;
  const openPurchaseOrders = purchaseOrderRows.filter((order) => !["received", "cancelled"].includes(order.status)).length;
  const salesEstimate = sumBy(invoiceRows.slice(0, 25), (invoice) => numberValue(invoice.total));
  const invoiceSales = sumBy(invoiceRows, (invoice) => numberValue(invoice.total));
  const invoiceCost = sumBy(invoiceRows, (invoice) => numberValue(invoice.cost_total));
  const foodCostPercent = invoiceSales > 0 ? (invoiceCost / invoiceSales) * 100 : 0;

  const categoryValue = new Map<string, number>();
  for (const stock of stockRows) {
    const item = itemMap.get(stock.item_id);
    const categoryName = item?.category_id ? categoryMap.get(item.category_id)?.name ?? "بدون تصنيف" : "بدون تصنيف";
    categoryValue.set(categoryName, (categoryValue.get(categoryName) ?? 0) + numberValue(stock.quantity) * numberValue(item?.average_cost));
  }

  const purchaseCostByDate = new Map<string, number>();
  for (const invoice of supplierInvoiceRows) {
    const key = dateKey(invoice.issued_at);
    purchaseCostByDate.set(key, (purchaseCostByDate.get(key) ?? 0) + numberValue(invoice.total));
  }

  const salesByDate = new Map<string, { total: number; cost: number }>();
  for (const invoice of invoiceRows) {
    const key = dateKey(invoice.issued_at);
    const current = salesByDate.get(key) ?? { total: 0, cost: 0 };
    current.total += numberValue(invoice.total);
    current.cost += numberValue(invoice.cost_total);
    salesByDate.set(key, current);
  }

  const wasteByBranch = new Map<string, number>();
  for (const waste of wasteRows) {
    const branchName = branchMap.get(waste.branch_id)?.name ?? "فرع غير معروف";
    wasteByBranch.set(branchName, (wasteByBranch.get(branchName) ?? 0) + numberValue(waste.cost));
  }

  return {
    salesEstimate,
    inventoryValue,
    lowStockCount,
    openPurchaseOrders,
    foodCostPercent,
    highCostRecipes: [...recipeBundle.recipes].sort((a, b) => b.costPerServing - a.costPerServing).slice(0, 5),
    alerts: notifications.slice(0, 5),
    inventoryByCategory: Array.from(categoryValue, ([label, value]) => ({ label, value })),
    purchaseCost30Days: Array.from(purchaseCostByDate, ([label, value]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label)),
    foodCostTrend: Array.from(salesByDate, ([label, value]) => ({
      label,
      value: value.total > 0 ? (value.cost / value.total) * 100 : 0,
    })).sort((a, b) => a.label.localeCompare(b.label)),
    wasteByBranch: Array.from(wasteByBranch, ([label, value]) => ({ label, value })),
  };
}

function expenseCategory(costCenter: string): FinancialCalendarExpense["category"] {
  if (costCenter.includes("رواتب")) return "أجور";
  if (costCenter.includes("ثابت") || costCenter.includes("إيجار")) return "إيجار";
  if (costCenter.includes("مواد")) return "مواد خام";
  if (costCenter.includes("كهرب") || costCenter.includes("ماء")) return "كهرباء وماء";
  if (costCenter.includes("توصيل")) return "توصيل";
  return "مصروفات أخرى";
}

async function loadFinancialCalendar(admin: AdminClient, organizationId: string): Promise<FinancialCalendarDay[]> {
  const invoiceRows: any = await query<any>(admin.from("customer_invoices").select("*").eq("organization_id", organizationId).limit(500), "customer_invoices");
  const invoiceItemRows: any = await query<any>(admin.from("customer_invoice_items").select("*").eq("organization_id", organizationId).limit(1000), "customer_invoice_items");
  const branchRows: any = await query<any>(admin.from("branches").select("*").eq("organization_id", organizationId), "branches");
  const costRows: any = await query<any>((admin as any).from("daily_cost_entries").select("*").eq("organization_id", organizationId).limit(1000), "daily_cost_entries");

  const branchMap = indexBy<any>(branchRows, (row) => row.id);
  const itemsByInvoice = groupBy<any>(invoiceItemRows, (row) => row.customer_invoice_id);
  const dayKeys = new Set<string>();

  for (const invoice of invoiceRows) dayKeys.add(`${dateKey(invoice.issued_at)}:${invoice.branch_id}`);
  for (const cost of costRows) dayKeys.add(`${dateKey(cost.entry_date)}:${cost.branch_id}`);

  return Array.from(dayKeys)
    .sort()
    .map((key) => {
      const [date, branchId] = key.split(":");
      const invoices = invoiceRows.filter((invoice: any) => dateKey(invoice.issued_at) === date && invoice.branch_id === branchId);
      const expensesForDay = costRows.filter((cost: any) => dateKey(cost.entry_date) === date && cost.branch_id === branchId);
      const sales: FinancialCalendarSale[] = invoices.flatMap((invoice: any) =>
        (itemsByInvoice.get(invoice.id) ?? []).map((item: any) => ({
          itemName: item.name,
          quantity: numberValue(item.quantity),
          revenue: numberValue(item.total) || numberValue(item.quantity) * numberValue(item.unit_price),
        })),
      );
      const expenses: FinancialCalendarExpense[] = expensesForDay.map((cost: any) => ({
        category: expenseCategory(cost.cost_center),
        amount: numberValue(cost.amount),
        notes: optionalText(cost.notes ?? cost.name),
      }));
      const salesTotal = sumBy<any>(invoices, (invoice) => numberValue(invoice.total));
      const expensesTotal = sumBy(expenses, (expense: any) => expense.amount);

      return {
        date,
        branchName: branchMap.get(branchId)?.name ?? "فرع غير معروف",
        salesTotal,
        expensesTotal,
        netProfit: salesTotal - expensesTotal,
        cashSales: sumBy<any>(invoices.filter((invoice: any) => invoice.payment_method === "cash"), (invoice) => numberValue(invoice.total)),
        cardSales: sumBy<any>(invoices.filter((invoice: any) => invoice.payment_method !== "cash"), (invoice) => numberValue(invoice.total)),
        sales,
        expenses,
        status: salesTotal - expensesTotal > 0 ? "profit" : salesTotal - expensesTotal < 0 ? "loss" : "balanced",
      };
    });
}

async function loadCostTracking(admin: AdminClient, organizationId: string): Promise<CostTrackingData> {
  const [summaryRows, costRows, branchRows]: [any, any, any] = await Promise.all([
    query<any>((admin as any).from("sales_daily_summaries").select("*").eq("organization_id", organizationId).limit(500), "sales_daily_summaries"),
    query<any>((admin as any).from("daily_cost_entries").select("*").eq("organization_id", organizationId).limit(1000), "daily_cost_entries"),
    query<any>((admin as any).from("branches").select("*").eq("organization_id", organizationId), "branches"),
  ]);

  const latestDate =
    [...summaryRows.map((row: any) => row.summary_date), ...costRows.map((row: any) => row.entry_date)].sort().at(-1) ??
    dateKey(new Date().toISOString());
  const branchId = summaryRows.find((row: any) => row.summary_date === latestDate)?.branch_id ?? costRows.find((row: any) => row.entry_date === latestDate)?.branch_id ?? branchRows[0]?.id ?? "";
  const branchName = branchRows.find((row: any) => row.id === branchId)?.name ?? "كل الفروع";
  const daySummaries = summaryRows.filter((row: any) => row.summary_date === latestDate && row.branch_id === branchId);
  const dayCosts = costRows.filter((row: any) => row.entry_date === latestDate && row.branch_id === branchId);
  const salesTotal = sumBy<any>(daySummaries, (row) => numberValue(row.sales_total));
  const rawMaterials = sumBy<any>(daySummaries, (row) => numberValue(row.ingredient_cost_total));
  const expensesTotal = sumBy<any>(dayCosts, (row) => numberValue(row.amount)) + rawMaterials;
  const netProfit = salesTotal - expensesTotal;

  const channelLabel: Record<SalesDailySummaryRow["channel"], "الصالة" | "الدليفري" | "الاستلام"> = {
    dine_in: "الصالة",
    delivery: "الدليفري",
    pickup: "الاستلام",
  };

  const sectionLabels: Record<string, { title: string; description: string }> = {
    raw_materials: { title: "المواد الخام", description: "تكلفة المكونات التي خرجت من المخزون بسبب البيع الفعلي." },
    labor: { title: "العمالة", description: "تكلفة الأشخاص الموجودين في الوردية لهذا اليوم." },
    operations: { title: "تشغيل", description: "كل شيء يستهلك لتشغيل اليوم وليس مادة مباشرة في الطبق." },
    fixed: { title: "ثابت", description: "تحويل المصاريف الشهرية إلى تكلفة يومية على أساس 30 يومًا." },
    waste: { title: "الهدر", description: "المواد التي خرجت من المخزون بدون بيع وربح." },
  };

  const costCenterId = (center: string) => {
    if (center.includes("رواتب")) return "labor";
    if (center.includes("ثابت")) return "fixed";
    if (center.includes("هدر")) return "waste";
    return "operations";
  };

  const sectionMap = new Map<string, DailyCostEntryRow[]>();
  for (const cost of dayCosts as any[]) {
    const id = costCenterId(cost.cost_center);
    sectionMap.set(id, [...(sectionMap.get(id) ?? []), cost]);
  }

  const sections = [
    {
      id: "raw_materials",
      title: sectionLabels.raw_materials.title,
      description: sectionLabels.raw_materials.description,
      total: rawMaterials,
      lines: daySummaries.map((summary: any) => ({
        name: `مبيعات ${channelLabel[summary.channel as keyof typeof channelLabel]}`,
        amount: numberValue(summary.ingredient_cost_total),
        quantity: numberValue(summary.orders_count),
        unit: "طلبات",
      })),
    },
    ...Array.from(sectionMap, ([id, rows]) => ({
      id,
      title: sectionLabels[id]?.title ?? "مصروفات أخرى",
      description: sectionLabels[id]?.description ?? "مصروفات تشغيلية مرتبطة باليوم.",
      total: sumBy<any>(rows, (row) => numberValue(row.amount)),
      lines: rows.map((row: any) => ({
        name: row.name,
        amount: numberValue(row.amount),
        quantity: row.quantity === null ? undefined : numberValue(row.quantity),
        unit: optionalText(row.unit),
        notes: optionalText(row.notes),
      })),
    })),
  ];

  return {
    date: latestDate,
    branchName,
    channelBreakdown: daySummaries.map((summary: any) => ({
      channel: channelLabel[summary.channel as keyof typeof channelLabel],
      orders: numberValue(summary.orders_count),
      revenue: numberValue(summary.sales_total),
      directCost: numberValue(summary.ingredient_cost_total),
      profit: numberValue(summary.sales_total) - numberValue(summary.ingredient_cost_total),
    })),
    salesTotal,
    expensesTotal,
    netProfit,
    profitMarginPercent: salesTotal > 0 ? (netProfit / salesTotal) * 100 : 0,
    sections,
    costCenters: sections.map((section) => {
      const percent = salesTotal > 0 ? (section.total / salesTotal) * 100 : 0;
      return {
        name: section.title,
        amount: section.total,
        percent,
        status: percent > 35 ? "danger" : percent > 22 ? "watch" : "healthy",
        notes: section.description,
      };
    }),
    smartInsights: [
      {
        title: "هامش اليوم",
        value: `${salesTotal > 0 ? Math.round((netProfit / salesTotal) * 100) : 0}%`,
        notes: netProfit >= 0 ? "اليوم مربح حسب البيانات المسجلة." : "اليوم يحتاج مراجعة تكلفة أو تسعير.",
        tone: netProfit >= 0 ? "success" : "danger",
      },
    ],
  };
}

function mapSocialAccount(row: SocialAccountRow): SocialAccount {
  return {
    id: row.id,
    organizationId: row.organization_id,
    platform: row.platform as SocialPlatform,
    accountName: row.account_name,
    status: row.status === "active" ? "connected" : row.status === "inactive" ? "disabled" : "expired",
    lastPublishedAt: optionalText(row.oauth_connected_at ?? row.updated_at),
  };
}

function mapSocialTarget(row: SocialPostTargetRow, accountMap: Map<string, SocialAccountRow>): SocialPostTarget {
  const account = accountMap.get(row.social_account_id);

  return {
    platform: row.platform as SocialPlatform,
    accountName: account?.account_name ?? row.platform,
    status: row.status,
    error: optionalText(row.error_message),
  };
}

function mapSocialPost(
  row: SocialPostRow,
  targets: SocialPostTarget[],
  assets: SocialMediaAssetRow[],
): SocialPost {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    body: row.body,
    status: row.status,
    scheduledAt: optionalText(row.scheduled_at),
    assetUrl: optionalText(assets[0]?.url ?? assets[0]?.storage_path),
    targets,
    createdAt: row.created_at,
  };
}

async function loadMarketingBundle(admin: AdminClient, organizationId: string) {
  const [accountRows, postRows, targetRows, templateRows, assetRows]: [any, any, any, any, any] = await Promise.all([
    query<any>((admin as any).from("social_accounts").select("*").eq("organization_id", organizationId).order("platform"), "social_accounts"),
    query<any>(
      (admin as any)
        .from("social_posts")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(150),
      "social_posts",
    ),
    query<any>((admin as any).from("social_post_targets").select("*").eq("organization_id", organizationId), "social_post_targets"),
    query<any>((admin as any).from("social_templates").select("*").eq("organization_id", organizationId).order("name"), "social_templates"),
    query<any>((admin as any).from("social_media_assets").select("*").eq("organization_id", organizationId), "social_media_assets"),
  ]);

  const accountMap = indexBy<any>(accountRows, (row) => row.id);
  const targetsByPost = groupBy<any>(targetRows, (row) => row.social_post_id);
  const assetsByPost = groupBy<any>(assetRows, (row) => row.social_post_id);

  const templates: SocialTemplate[] = templateRows.map((row: any) => ({
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    body: row.body,
    category: row.category ?? "عام",
  }));

  return {
    accounts: accountRows.map(mapSocialAccount),
    posts: postRows.map((row: any) =>
      mapSocialPost(
        row,
        (targetsByPost.get(row.id) ?? []).map((target: any) => mapSocialTarget(target, accountMap)),
        assetsByPost.get(row.id) ?? [],
      ),
    ),
    templates,
    menuItems: (await loadRecipesBundle(admin, organizationId)).menuItems,
  };
}

async function loadBillPayments(admin: AdminClient, organizationId: string): Promise<BillPaymentsData> {
  const costRows = await query<any>(
    (admin as any)
      .from("daily_cost_entries")
      .select("*")
      .eq("organization_id", organizationId)
      .order("entry_date", { ascending: false })
      .limit(100),
    "daily_cost_entries",
  );

  const bills: PayableBill[] = (costRows as any[])
    .filter((row) => numberValue(row.amount) > 0)
    .slice(0, 20)
    .map((row: any) => ({
      id: row.id,
      organizationId: row.organization_id,
      billerName: row.name,
      category: expenseCategory(row.cost_center) === "إيجار" ? "إيجار" : expenseCategory(row.cost_center) === "كهرباء وماء" ? "كهرباء" : "خدمات",
      billNumber: row.source_doc_id ?? row.id.slice(0, 8),
      referenceNumber: row.source_doc_type ?? row.id.slice(0, 8).toUpperCase(),
      dueDate: row.entry_date,
      amount: numberValue(row.amount),
      paidAmount: 0,
      remainingAmount: numberValue(row.amount),
      status: new Date(row.entry_date) < new Date() ? "overdue" : "due",
      canPartialPay: true,
      lastInquiryAt: row.created_at,
    }));

  return {
    bills,
    batches: bills.length
      ? [
          {
            id: "batch-current-costs",
            organizationId,
            referenceNumber: `BATCH-${dateKey(new Date().toISOString()).replaceAll("-", "")}`,
            billIds: bills.slice(0, 3).map((bill) => bill.id),
            totalAmount: sumBy(bills.slice(0, 3), (bill) => bill.remainingAmount),
            status: "ready" as const,
          },
        ]
      : [],
    mandates: demoDirectDebitMandates.filter((mandate) => mandate.organizationId === organizationId),
    runs: demoDirectDebitRuns,
  };
}

function makeDefaultTables(branches: Branch[]): RestaurantTable[] {
  return branches.flatMap((branch, branchIndex) =>
    Array.from({ length: 4 }).map((_, index) => ({
      id: `${branch.id}-table-${index + 1}`,
      organizationId: branch.organizationId,
      branchId: branch.id,
      branchName: branch.name,
      number: branchIndex * 10 + index + 1,
      zone: branchIndex === 0 ? "الصالة" : branch.name,
      seats: index % 2 === 0 ? 4 : 2,
      status: "available",
      currentTotal: 0,
      orderItems: [],
    })),
  );
}

async function loadDigitalReceipts(admin: AdminClient, organizationId: string): Promise<DigitalReceiptShare[]> {
  const invoices = await loadCustomerInvoices(admin, organizationId);

  return invoices.slice(0, 20).map((invoice) => ({
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName,
    total: invoice.total,
    receiptUrl: `/r/customer-invoices/${invoice.id}`,
    sentAt: invoice.issuedAt,
    status: invoice.status === "paid" ? "viewed" : "ready",
  }));
}

export async function getOrganizationContext() {
  return withAdminScope(fallbackContext, (admin, scope) => loadOrganizationContext(admin, scope.organizationId));
}

export async function getDashboardData() {
  return withAdminScope(demoDashboard, (admin, scope) => loadDashboard(admin, scope.organizationId));
}

export async function getInventoryData() {
  return withAdminScope(
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

export async function getStockCountsData() {
  return withAdminScope(
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

export async function getInventoryItem(id: string) {
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

export async function getPurchasingData() {
  return withAdminScope(
    {
      suppliers: demoSuppliers,
      purchaseOrders: demoPurchaseOrders,
      invoices: demoInvoices,
      branches: demoBranches,
      items: demoInventoryItems,
    },
    (admin, scope) => loadPurchasingBundle(admin, scope.organizationId),
  );
}

export async function getCustomerInvoicesData() {
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
    async (admin, scope) => {
      const [context, invoices, recipes, catalog, inventory] = await Promise.all([
        loadOrganizationContext(admin, scope.organizationId),
        loadCustomerInvoices(admin, scope.organizationId),
        loadRecipesBundle(admin, scope.organizationId),
        loadCatalogBundle(admin, scope.organizationId),
        loadInventoryBundle(admin, scope.organizationId),
      ]);

      return {
        invoices,
        branches: context.branches,
        menuItems: recipes.menuItems,
        catalogItems: catalog.items,
        recipes: recipes.recipes,
        inventoryItems: inventory.items,
        branchStock: inventory.branchStock,
        shift: {
          ...demoSalesShift,
          branchName: context.branches[0]?.name ?? demoSalesShift.branchName,
        },
        organization: context.organization,
      };
    },
  );
}

export async function getCustomerInvoice(id: string) {
  return withAdminScope(
    demoCustomerInvoices.find((invoice) => invoice.id === id) ?? null,
    async (admin, scope) => (await loadCustomerInvoices(admin, scope.organizationId, id))[0] ?? null,
  );
}

export async function getRecipesData() {
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

export async function getRecipe(id: string) {
  return withAdminScope(
    (() => {
      const recipe = demoRecipes.find((candidate) => candidate.id === id);
      return recipe
        ? {
            recipe,
            menuItems: demoMenuItems.filter((item) => item.recipeId === id),
          }
        : null;
    })(),
    async (admin, scope) => {
      const recipes = await loadRecipesBundle(admin, scope.organizationId);
      const recipe = recipes.recipes.find((candidate) => candidate.id === id);
      return recipe
        ? {
            recipe,
            menuItems: recipes.menuItems.filter((item) => item.recipeId === id),
          }
        : null;
    },
  );
}

export async function getMenuItem(id: string) {
  return withAdminScope(
    demoMenuItems.find((item) => item.id === id) ?? null,
    async (admin, scope) => {
      const recipes = await loadRecipesBundle(admin, scope.organizationId);
      return recipes.menuItems.find((item) => item.id === id) ?? null;
    },
  );
}

export async function getCatalogData() {
  return withAdminScope(
    {
      items: demoCatalogItems,
      categories: demoCategories,
      branches: demoBranches,
      permissions: demoPermissionSettings,
    },
    (admin, scope) => loadCatalogBundle(admin, scope.organizationId),
  );
}

export async function getOperationsData() {
  return withAdminScope(
    {
      wasteLogs: demoWasteLogs,
      transfers: demoTransfers,
      branches: demoBranches,
      items: demoInventoryItems,
    },
    (admin, scope) => loadOperationsBundle(admin, scope.organizationId),
  );
}

export async function getReportsData() {
  return withAdminScope(
    {
      dashboard: demoDashboard,
      inventoryItems: demoInventoryItems,
      branchStock: demoBranchStock,
      movements: demoStockMovements,
      purchaseOrders: demoPurchaseOrders,
      wasteLogs: demoWasteLogs,
      menuItems: demoMenuItems,
      suppliers: demoSuppliers,
      branches: demoBranches,
      financialCalendar: demoFinancialCalendar,
    },
    async (admin, scope) => {
      const [dashboard, inventory, purchasing, operations, recipes, financialCalendar] = await Promise.all([
        loadDashboard(admin, scope.organizationId),
        loadInventoryBundle(admin, scope.organizationId),
        loadPurchasingBundle(admin, scope.organizationId),
        loadOperationsBundle(admin, scope.organizationId),
        loadRecipesBundle(admin, scope.organizationId),
        loadFinancialCalendar(admin, scope.organizationId),
      ]);

      return {
        dashboard,
        inventoryItems: inventory.items,
        branchStock: inventory.branchStock,
        movements: inventory.movements,
        purchaseOrders: purchasing.purchaseOrders,
        wasteLogs: operations.wasteLogs,
        menuItems: recipes.menuItems,
        suppliers: inventory.suppliers,
        branches: inventory.branches,
        financialCalendar,
      };
    },
  );
}

export async function getFinancialCalendarData() {
  return withAdminScope(
    {
      days: demoFinancialCalendar,
      branches: demoBranches,
    },
    async (admin, scope) => ({
      days: await loadFinancialCalendar(admin, scope.organizationId),
      branches: await loadBranches(admin, scope.organizationId),
    }),
  );
}

export async function getAmwaliData() {
  return withAdminScope(
    {
      costTracking: demoCostTracking,
      branches: demoBranches,
    },
    async (admin, scope) => ({
      costTracking: await loadCostTracking(admin, scope.organizationId),
      branches: await loadBranches(admin, scope.organizationId),
    }),
  );
}

export async function getTablesData() {
  return withAdminScope(
    {
      tables: demoRestaurantTables,
      branches: demoBranches,
      catalogItems: demoCatalogItems,
    },
    async (admin, scope) => {
      const [branches, catalog] = await Promise.all([
        loadBranches(admin, scope.organizationId),
        loadCatalogBundle(admin, scope.organizationId),
      ]);

      return {
        tables: makeDefaultTables(branches),
        branches,
        catalogItems: catalog.items,
      };
    },
  );
}

export async function getBillPaymentsData() {
  return withAdminScope<BillPaymentsData>(
    {
      bills: demoPayableBills,
      batches: demoBillPaymentBatches,
      mandates: demoDirectDebitMandates,
      runs: demoDirectDebitRuns,
    },
    (admin, scope) => loadBillPayments(admin, scope.organizationId),
  );
}

export async function getSmartSavingsData() {
  return withAdminScope(
    {
      features: demoSmartSavingsFeatures,
      receipts: demoDigitalReceiptShares,
      organization: demoOrganization,
    },
    async (admin, scope) => {
      const [context, receipts] = await Promise.all([
        loadOrganizationContext(admin, scope.organizationId),
        loadDigitalReceipts(admin, scope.organizationId),
      ]);

      return {
        features: smartSavingsFeatures,
        receipts,
        organization: context.organization,
      };
    },
  );
}

export async function getMarketingData() {
  return withAdminScope(
    {
      accounts: demoSocialAccounts,
      posts: demoSocialPosts,
      templates: demoSocialTemplates,
      menuItems: demoMenuItems,
    },
    (admin, scope) => loadMarketingBundle(admin, scope.organizationId),
  );
}

export async function getNotifications() {
  return withAdminScope(demoNotifications, (admin, scope) => loadNotifications(admin, scope.organizationId));
}

export async function getAdminData() {
  return withAdminScope(
    {
      metrics: demoAdminMetrics,
      organizations: [demoOrganization],
      users: [
        { id: "user-1", name: "مالك مطعم إيوان", email: "owner@rewaq.app", role: "organization_owner" },
        { id: "user-2", name: "سارة النجار", email: "sara@thai.example", role: "branch_manager" },
        { id: "user-3", name: "محمود عوض", email: "mahmoud@thai.example", role: "inventory_manager" },
        { id: "user-4", name: "أحمد الكاشير", email: "cashier@thai.example", role: "cashier" },
      ],
      plans: [
        { id: "starter", name: "البداية", price: "₪129", features: ["فرع واحد", "مخزون", "تقارير أساسية"] },
        { id: "growth", name: "النمو", price: "₪249", features: ["حتى 5 فروع", "تسويق", "وصفات"] },
        { id: "scale", name: "التوسع", price: "₪499", features: ["فروع غير محدودة", "أتمتة", "صلاحيات متقدمة"] },
      ],
      flags: [
        { key: "ربط_فيسبوك_الحقيقي", enabled: false, description: "تفعيل ربط فيسبوك الحقيقي" },
        { key: "قراءة_الفواتير_آليًا", enabled: false, description: "قراءة الفواتير آليًا" },
        { key: "استيراد_نقاط_البيع", enabled: false, description: "استيراد مبيعات نقاط البيع" },
      ],
      logs: demoSystemLogs,
      tickets: [
        { id: "SUP-91", organization: "مطعم إيوان", subject: "ربط إنستغرام", status: "open", priority: "high" },
        { id: "SUP-92", organization: "كافيه تجريبي", subject: "سؤال عن الفاتورة", status: "pending", priority: "normal" },
      ],
    },
    async (admin) => {
      const [organizationRows, membershipRows, profileRows, planRows, flagRows, logRows, ticketRows, approvalRows]: [any, any, any, any, any, any, any, any] =
        await Promise.all([
          query<any>(admin.from("organizations").select("*").order("created_at", { ascending: false }).limit(100), "organizations"),
          query<any>(admin.from("organization_memberships").select("*").order("created_at", { ascending: false }).limit(500), "organization_memberships"),
          query<any>(admin.from("profiles").select("*").limit(500), "profiles"),
          query<any>(admin.from("plans").select("*").order("monthly_price", { ascending: true }), "plans"),
          query<any>((admin as any).from("feature_flags").select("*").order("key"), "feature_flags"),
          query<any>((admin as any).from("system_logs").select("*").order("created_at", { ascending: false }).limit(100), "system_logs"),
          query<any>((admin as any).from("support_tickets").select("*").order("created_at", { ascending: false }).limit(100), "support_tickets"),
          query<any>(admin.from("account_approval_requests").select("*").limit(200), "account_approval_requests"),
        ]);

      const profileMap = indexBy<any>(profileRows, (row) => row.id);
      const organizationMap = indexBy<any>(organizationRows, (row) => row.id);
      const authUsers = await admin.auth.admin.listUsers().catch(() => null);
      const emailByUserId = new Map((authUsers?.data.users ?? []).map((user) => [user.id, user.email ?? user.id]));
      const activeOrganizations = organizationRows.filter((organization: any) => organization.status === "active").length;
      const openTickets = ticketRows.filter((ticket: any) => ticket.status !== "closed").length;

      const metrics: AdminMetric[] = [
        { label: "المؤسسات", value: String(organizationRows.length), delta: `${activeOrganizations} نشطة`, tone: "default" },
        { label: "طلبات اعتماد", value: String(approvalRows.filter((request: any) => request.status !== "approved").length), delta: "بانتظار المراجعة", tone: "warning" },
        { label: "المستخدمون", value: String(membershipRows.length), delta: "عضويات مسجلة", tone: "success" },
        { label: "تذاكر مفتوحة", value: String(openTickets), delta: "دعم العملاء", tone: openTickets > 0 ? "warning" : "success" },
      ];

      return {
        metrics,
        organizations: organizationRows.map(mapOrganization),
        users: membershipRows.map((membership: any) => {
          const profile = profileMap.get(membership.user_id);
          return {
            id: membership.user_id,
            name: profile?.full_name ?? emailByUserId.get(membership.user_id) ?? "مستخدم",
            email: emailByUserId.get(membership.user_id) ?? membership.user_id,
            role: membership.role as Role,
          };
        }),
        plans: planRows.map((plan: any) => ({
          id: plan.code,
          name: plan.name,
          price: `₪${numberValue(plan.monthly_price)}`,
          features: Array.isArray(plan.features) ? plan.features.map(String) : [],
        })),
        flags: flagRows.map((flag: any) => ({
          key: flag.key,
          enabled: flag.enabled,
          description: flag.description ?? "",
        })),
        logs: logRows.map((log: any) => ({
          id: log.id,
          level: log.level,
          message: log.message,
          createdAt: log.created_at,
        })),
        tickets: ticketRows.map((ticket: any) => ({
          id: ticket.id,
          organization: ticket.organization_id ? organizationMap.get(ticket.organization_id)?.name ?? "مؤسسة غير معروفة" : "عام",
          subject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
        })),
      };
    },
  );
}

export async function getAccountApprovalRequests(): Promise<AccountApprovalRequest[]> {
  return withAdminScope(
    [
      {
        id: "demo-request-1",
        email: "owner@iwan.example",
        authUserId: null,
        authEmailConfirmed: false,
        authLastSignInAt: null,
        organizationId: null,
        ownerName: "مالك مطعم إيوان",
        organizationName: "مطعم إيوان",
        businessType: "restaurant",
        phone: "0590000000",
        status: "pending_owner_approval",
        requestedAt: new Date().toISOString(),
        approvedAt: null,
        rejectionReason: null,
      },
    ],
    async (admin) => {
      const requests = await query(
        (admin as any)
          .from("account_approval_requests")
          .select("id,email,owner_name,organization_name,business_type,phone,status,requested_at,approved_at,rejection_reason")
          .order("requested_at", { ascending: false }),
        "account_approval_requests",
      ) as any[];
      const authUsers = await admin.auth.admin.listUsers().catch(() => null);
      const authUserByEmail = new Map(
        (authUsers?.data.users ?? []).map((user) => [(user.email ?? "").toLowerCase(), user]),
      );
      const userIds = (authUsers?.data.users ?? []).map((user) => user.id);
      const membershipRows = userIds.length
        ? await query(
            (admin as any)
              .from("organization_memberships")
              .select("organization_id,user_id,role")
              .in("user_id", userIds),
            "organization_memberships",
          ) as any[]
        : [];
      const ownerOrgByUserId = new Map(
        membershipRows
          .filter((membership) => membership.role === "organization_owner" || membership.role === "super_admin")
          .map((membership) => [membership.user_id, membership.organization_id]),
      );

      return requests.map((request) => ({
        authUserId: authUserByEmail.get(request.email.toLowerCase())?.id ?? null,
        authEmailConfirmed: Boolean(authUserByEmail.get(request.email.toLowerCase())?.email_confirmed_at),
        authLastSignInAt: authUserByEmail.get(request.email.toLowerCase())?.last_sign_in_at ?? null,
        organizationId: authUserByEmail.get(request.email.toLowerCase())?.id
          ? ownerOrgByUserId.get(authUserByEmail.get(request.email.toLowerCase())!.id) ?? null
          : null,
        id: request.id,
        email: request.email,
        ownerName: request.owner_name,
        organizationName: request.organization_name,
        businessType: request.business_type,
        phone: request.phone,
        status: request.status,
        requestedAt: request.requested_at,
        approvedAt: request.approved_at,
        rejectionReason: request.rejection_reason,
      }));
    },
  );
}
