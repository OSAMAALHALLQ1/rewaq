/**
 * Data mappers - convert database rows to domain types
 */
import "server-only";
import type { Tables } from "@/types/database";
import type {
  InventoryItem,
  Supplier,
  BranchStock,
  StockMovement,
  StockMovementType,
  PurchaseOrder,
  PurchaseOrderItem,
  Invoice,
  CustomerInvoice,
  CustomerInvoiceItem,
  Recipe,
  RecipeIngredient,
  MenuItem,
} from "@/types/domain";
import {
  numberValue,
  optionalText,
  oneOf,
} from "./utils";

// Supabase tests and partial selects pass rows that intentionally omit table metadata.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RowLike<T> = Record<string, any> & { [K in keyof T]?: any };
type NamedLookup = { name?: unknown };

// ============================================================================
// Supplier Mapping
// ============================================================================

export function mapSupplier(row: RowLike<Tables<"suppliers">>, priceRisk = 0): Supplier {
  return {
    id: String(row.id ?? ""),
    organizationId: String(row.organization_id ?? ""),
    name: String(row.name ?? ""),
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    notes: optionalText(row.notes),
    status: row.status === "inactive" || row.status === "archived" ? "inactive" : "active",
    priceRisk,
  };
}

// ============================================================================
// Inventory Mapping
// ============================================================================

export function mapInventoryItem(
  row: RowLike<Tables<"inventory_items">>,
  categoryMap: Map<string, NamedLookup>,
  supplierMap: Map<string, NamedLookup>,
  unitMap: Map<string, NamedLookup>,
): InventoryItem {
  const supplierId = optionalText(row.primary_supplier_id);
  const categoryId = optionalText(row.category_id) ?? "";
  const purchaseUnitId = optionalText(row.purchase_unit_id);
  const usageUnitId = optionalText(row.usage_unit_id);
  const supplier = supplierId ? supplierMap.get(supplierId) : null;

  return {
    id: String(row.id ?? ""),
    organizationId: String(row.organization_id ?? ""),
    name: String(row.name ?? ""),
    categoryId,
    categoryName: categoryId ? String(categoryMap.get(categoryId)?.name ?? "بدون تصنيف") : "بدون تصنيف",
    purchaseUnit: purchaseUnitId ? String(unitMap.get(purchaseUnitId)?.name ?? "") : "",
    usageUnit: usageUnitId ? String(unitMap.get(usageUnitId)?.name ?? "") : "",
    lastPurchasePrice: numberValue(row.last_purchase_price),
    averageCost: numberValue(row.average_cost),
    minimumQuantity: numberValue(row.minimum_quantity),
    primarySupplierId: supplierId,
    primarySupplierName: supplier?.name ? String(supplier.name) : undefined,
    sku: optionalText(row.sku),
    notes: optionalText(row.notes),
    isActive: row.status === "active",
    warehouse: row.warehouse === "kitchen" ? "kitchen" : "general",
  };
}

export function mapBranchStock(
  row: RowLike<Tables<"branch_stock">>,
  branchMap: Map<string, NamedLookup>,
): BranchStock {
  return {
    branchId: String(row.branch_id ?? ""),
    branchName: String(branchMap.get(String(row.branch_id ?? ""))?.name ?? "فرع غير معروف"),
    itemId: String(row.item_id ?? ""),
    quantity: numberValue(row.quantity),
    reservedQuantity: numberValue(row.reserved_quantity),
  };
}

// ============================================================================
// Stock Movement Mapping
// ============================================================================

export function mapStockMovement(
  row: RowLike<Tables<"stock_movements">>,
  branchMap: Map<string, NamedLookup>,
  itemMap: Map<string, NamedLookup>,
): StockMovement {
  const movementType = oneOf(
    row.movement_type,
    ["purchase", "sale_usage", "waste", "transfer_in", "transfer_out", "adjustment", "stock_count", "return"] as const,
    "adjustment",
  );

  return {
    id: String(row.id ?? ""),
    organizationId: String(row.organization_id ?? ""),
    branchId: String(row.branch_id ?? ""),
    branchName: String(branchMap.get(String(row.branch_id ?? ""))?.name ?? "فرع غير معروف"),
    itemId: String(row.item_id ?? ""),
    itemName: String(itemMap.get(String(row.item_id ?? ""))?.name ?? "مادة غير معروفة"),
    movementType: movementType as StockMovementType,
    quantity: numberValue(row.quantity),
    unitCost: numberValue(row.unit_cost),
    totalCost: numberValue(row.total_cost),
    reference: optionalText(row.source_doc_type ?? row.source_doc_id ?? undefined),
    notes: optionalText(row.notes),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

// ============================================================================
// Purchase Order Mapping
// ============================================================================

export function mapPurchaseOrder(
  row: RowLike<Tables<"purchase_orders">>,
  supplierMap: Map<string, NamedLookup>,
  branchMap: Map<string, NamedLookup>,
  itemMap: Map<string, NamedLookup>,
  orderItems: Array<RowLike<Tables<"purchase_order_items">>>,
): PurchaseOrder {
  const items: PurchaseOrderItem[] = orderItems.map((item) => ({
    itemId: String(item.item_id),
    itemName: String(itemMap.get(item.item_id)?.name ?? "مادة غير معروفة"),
    quantity: numberValue(item.quantity),
    expectedUnitPrice: numberValue(item.expected_unit_price),
    receivedQuantity: numberValue(item.received_quantity),
  }));

  return {
    id: String(row.id ?? ""),
    organizationId: String(row.organization_id ?? ""),
    supplierId: String(row.supplier_id ?? ""),
    supplierName: String(supplierMap.get(String(row.supplier_id ?? ""))?.name ?? "مورد غير معروف"),
    branchId: String(row.branch_id ?? ""),
    branchName: String(branchMap.get(String(row.branch_id ?? ""))?.name ?? "فرع غير معروف"),
    status: oneOf(String(row.status ?? ""), ["draft", "sent", "received", "partially_received", "cancelled"] as const, "draft"),
    orderDate: String(row.order_date ?? ""),
    expectedDate: optionalText(row.expected_date),
    total: numberValue(row.total),
    notes: optionalText(row.notes),
    items,
  };
}

// ============================================================================
// Invoice Mapping
// ============================================================================

export function mapInvoice(
  row: RowLike<Tables<"invoices">>,
  supplierMap: Map<string, NamedLookup>,
  branchMap: Map<string, NamedLookup>,
): Invoice {
  return {
    id: String(row.id ?? ""),
    organizationId: String(row.organization_id ?? ""),
    supplierName: String(supplierMap.get(String(row.supplier_id ?? ""))?.name ?? "مورد غير معروف"),
    branchName: String(branchMap.get(String(row.branch_id ?? ""))?.name ?? "فرع غير معروف"),
    invoiceNumber: String(row.invoice_number ?? row.id ?? "").slice(0, 24),
    status: oneOf(String(row.status ?? ""), ["draft", "matched", "paid", "flagged"] as const, "draft"),
    total: numberValue(row.total),
    issuedAt: String(row.issued_at ?? ""),
  };
}

// ============================================================================
// Customer Invoice Mapping
// ============================================================================

export function mapCustomerInvoice(
  row: RowLike<Tables<"customer_invoices">>,
  branchMap: Map<string, NamedLookup>,
  invoiceItems: Tables<"customer_invoice_items">[],
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
    id: String(row.id ?? ""),
    organizationId: String(row.organization_id ?? ""),
    branchId: String(row.branch_id ?? ""),
    branchName: String(branchMap.get(String(row.branch_id ?? ""))?.name ?? "فرع غير معروف"),
    invoiceNumber: String(row.invoice_number ?? ""),
    customerName: String(row.customer_name ?? ""),
    customerPhone: optionalText(row.customer_phone),
    customerTaxNumber: optionalText(row.customer_tax_number),
    status: oneOf(String(row.status ?? ""), ["draft", "issued", "paid", "void"] as const, "draft"),
    paymentMethod: oneOf(String(row.payment_method ?? ""), ["cash", "card", "bank_transfer", "delivery_app"] as const, "cash"),
    issuedAt: String(row.issued_at ?? ""),
    notes: optionalText(row.notes),
    subtotal: numberValue(row.subtotal),
    discount: numberValue(row.discount),
    taxRate: numberValue(row.tax_rate),
    taxTotal: numberValue(row.tax_total),
    total: numberValue(row.total),
    items,
  };
}

// ============================================================================
// Recipe Mapping
// ============================================================================

export function mapRecipeIngredient(
  row: RowLike<Tables<"recipe_ingredients">>,
  itemMap: Map<string, NamedLookup>,
  unitMap: Map<string, NamedLookup>,
): RecipeIngredient {
  return {
    itemId: String(row.item_id ?? ""),
    itemName: String(itemMap.get(String(row.item_id ?? ""))?.name ?? "مادة غير معروفة"),
    quantity: numberValue(row.quantity),
    unit: String(unitMap.get(String(row.unit_id ?? ""))?.name ?? ""),
    unitCost: numberValue(row.unit_cost),
    totalCost: numberValue(row.total_cost) || numberValue(row.quantity) * numberValue(row.unit_cost),
  };
}

export function mapRecipe(
  row: RowLike<Tables<"recipes">>,
  ingredients: RecipeIngredient[],
  _branchMap: Map<string, NamedLookup>,
): Recipe {
  void _branchMap;
  const totalCost = numberValue(row.total_cost) || ingredients.reduce((sum, ing) => sum + ing.totalCost, 0);
  const servings = numberValue(row.servings) || 1;

  return {
    id: String(row.id ?? ""),
    organizationId: String(row.organization_id ?? ""),
    name: String(row.name ?? ""),
    category: String(row.category ?? "general"),
    servings,
    preparation: optionalText(row.preparation),
    ingredients,
    totalCost,
    costPerServing: numberValue(row.cost_per_serving) || totalCost / servings,
    status: row.status === "archived" ? "archived" : row.status === "active" ? "active" : "draft",
  };
}

// ============================================================================
// Menu Item Mapping
// ============================================================================

export function mapMenuItem(
  row: RowLike<Tables<"menu_items">>,
  branchMap: Map<string, NamedLookup>,
): MenuItem {
  const sellingPrice = numberValue(row.selling_price);
  const recipeCost = numberValue(row.recipe_cost);
  const grossProfit = sellingPrice - recipeCost;

  return {
    id: String(row.id ?? ""),
    organizationId: String(row.organization_id ?? ""),
    name: String(row.name ?? ""),
    branchId: optionalText(String(row.branch_id ?? "")),
    branchName: row.branch_id ? String(branchMap.get(String(row.branch_id))?.name ?? "") : undefined,
    recipeId: String(row.recipe_id ?? ""),
    recipeName: String(row.recipe_name ?? ""),
    sellingPrice,
    recipeCost,
    grossProfit,
    foodCostPercent: sellingPrice > 0 ? (recipeCost / sellingPrice) * 100 : 0,
    profitMarginPercent: sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0,
    imagePath: optionalText(String(row.image_path ?? "")),
    status: row.status === "active" ? "active" : "inactive",
  };
}
