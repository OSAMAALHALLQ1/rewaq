/**
 * Data mappers - convert database rows to domain types
 */
import "server-only";
import { mergeCategoryNames } from "@/lib/catalog/categories";
import type { Tables } from "@/types/database";
import type {
  InventoryItem,
  InventoryCategory,
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
  indexBy,
  numberValue,
  optionalText,
  oneOf,
  type AdminClient,
  type BranchRow,
} from "./utils";

// ============================================================================
// Supplier Mapping
// ============================================================================

export function mapSupplier(row: Tables<"suppliers">, priceRisk = 0): Supplier {
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

// ============================================================================
// Inventory Mapping
// ============================================================================

export function mapInventoryItem(
  row: Tables<"inventory_items">,
  categoryMap: Map<string, Tables<"inventory_categories">>,
  supplierMap: Map<string, Tables<"suppliers">>,
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

// ============================================================================
// Branch Stock Mapping
// ============================================================================

export function mapBranchStock(
  row: Tables<"branch_stock">,
  branchMap: Map<string, Tables<"branches">>,
): BranchStock {
  return {
    branchId: row.branch_id,
    branchName: branchMap.get(row.branch_id)?.name ?? "فرع غير معروف",
    itemId: row.item_id,
    quantity: numberValue(row.quantity),
    reservedQuantity: numberValue(row.reserved_quantity),
  };
}

// ============================================================================
// Stock Movement Mapping
// ============================================================================

export function mapStockMovement(
  row: Tables<"stock_movements">,
  branchMap: Map<string, Tables<"branches">>,
  itemMap: Map<string, Tables<"inventory_items">>,
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

// ============================================================================
// Purchase Order Mapping
// ============================================================================

export function mapPurchaseOrder(
  row: Tables<"purchase_orders">,
  supplierMap: Map<string, Tables<"suppliers">>,
  branchMap: Map<string, Tables<"branches">>,
  itemMap: Map<string, Tables<"inventory_items">>,
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

// ============================================================================
// Invoice Mapping
// ============================================================================

export function mapInvoice(
  row: Tables<"invoices">,
  supplierMap: Map<string, Tables<"suppliers">>,
  branchMap: Map<string, Tables<"branches">>,
): Invoice {
  return {
    id: row.id,
    organizationId: row.organization_id,
    supplierName: supplierMap.get(row.supplier_id)?.name ?? "مورد غير معروف",
    branchName: branchMap.get(row.branch_id)?.name ?? "فرع غير معروف",
    invoiceNumber: row.invoice_number ?? row.id.slice(0, 8),
    status: row.status,
    total: numberValue(row.total),
    issuedAt: row.issued_at,
  };
}

// ============================================================================
// Customer Invoice Mapping
// ============================================================================

export function mapCustomerInvoice(
  row: Tables<"customer_invoices">,
  branchMap: Map<string, Tables<"branches">>,
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

// ============================================================================
// Recipe Mapping
// ============================================================================

export function mapRecipeIngredient(
  row: Tables<"recipe_ingredients">,
  itemMap: Map<string, Tables<"inventory_items">>,
  unitMap: Map<string, Tables<"units">>,
): RecipeIngredient {
  return {
    itemId: row.item_id,
    itemName: itemMap.get(row.item_id)?.name ?? "مادة غير معروفة",
    quantity: numberValue(row.quantity),
    unit: unitMap.get(row.unit_id)?.name ?? "",
    unitCost: numberValue(row.unit_cost),
    cost: numberValue(row.cost),
  };
}

export function mapRecipe(
  row: Tables<"recipes">,
  ingredients: RecipeIngredient[],
  branchMap: Map<string, Tables<"branches">>,
): Recipe {
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
    status: row.status === "active" ? "active" : "inactive",
  };
}

// ============================================================================
// Menu Item Mapping
// ============================================================================

export function mapMenuItem(
  row: Tables<"menu_items">,
  branchMap: Map<string, Tables<"branches">>,
): MenuItem {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: optionalText(row.description),
    price: numberValue(row.price),
    category: row.category ?? "general",
    recipeId: optionalText(row.recipe_id),
    status: row.status === "active" ? "active" : "inactive",
  };
}