/**
 * Purchasing domain queries
 * Handles suppliers, purchase orders, and invoices
 */
import "server-only";
import {
  demoSuppliers,
  demoPurchaseOrders,
  demoInvoices,
  demoBranches,
  demoInventoryItems,
} from "@/lib/demo-data";
import {
  isDemoMode,
  withAdminScope,
  query,
  indexBy,
  groupBy,
  numberValue,
  optionalText,
  oneOf,
  type AdminClient,
} from "./_shared/utils";
import { mapSupplier, mapPurchaseOrder, mapInvoice } from "./_shared/mappers";
import type { Branch, InventoryItem, Invoice, PurchaseOrder, Supplier } from "@/types/domain";

// ============================================================================
// Types
// ============================================================================

export type PurchasingBundle = {
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  invoices: Invoice[];
  branches: Branch[];
  items: InventoryItem[];
};

// ============================================================================
// Loaders
// ============================================================================

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

  return {
    suppliers: supplierRows.map((row) => mapSupplier(row)),
    purchaseOrders: orderRows.map((row) => mapPurchaseOrder(row, supplierMap, branchMap, itemMap, itemsByOrder.get(row.id) ?? [])),
    invoices: invoiceRows.map((row) => mapInvoice(row, supplierMap, branchMap)),
    branches: branchRows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      city: row.city ?? "",
      address: row.address ?? "",
      manager: row.manager_name ?? "",
      status: row.status === "inactive" || row.status === "archived" ? "inactive" as const : "active" as const,
    })),
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
      primarySupplierName: row.primary_supplier_id ? supplierMap.get(row.primary_supplier_id)?.name : undefined,
      sku: optionalText(row.sku),
      notes: optionalText(row.notes),
      isActive: row.status === "active",
    })),
  };
}

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Get full purchasing bundle (suppliers, orders, invoices)
 */
export async function getPurchasingData(): Promise<PurchasingBundle> {
  if (isDemoMode()) {
    return {
      suppliers: demoSuppliers,
      purchaseOrders: demoPurchaseOrders,
      invoices: demoInvoices,
      branches: demoBranches,
      items: demoInventoryItems,
    };
  }

  return withAdminScope<PurchasingBundle>(
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

/**
 * Get suppliers list
 */
export async function getSuppliers() {
  if (isDemoMode()) {
    return demoSuppliers;
  }

  return withAdminScope(demoSuppliers, async (admin, scope) => {
    const rows = await query(
      admin.from("suppliers").select("*").eq("organization_id", scope.organizationId).order("name"),
      "suppliers",
    );
    return rows.map((row) => mapSupplier(row));
  });
}

/**
 * Get single supplier with order history
 */
export async function getSupplier(id: string) {
  if (isDemoMode()) {
    const supplier = demoSuppliers.find((s) => s.id === id);
    if (!supplier) return null;
    
    return {
      supplier,
      orders: demoPurchaseOrders.filter((o) => o.supplierId === id).slice(0, 10),
      invoices: demoInvoices.filter((i) => i.supplierName === supplier.name).slice(0, 10),
    };
  }

  return withAdminScope(
    (() => {
      const supplier = demoSuppliers.find((s) => s.id === id);
      if (!supplier) return null;
      return {
        supplier,
        orders: demoPurchaseOrders.filter((o) => o.supplierId === id).slice(0, 10),
        invoices: demoInvoices.filter((i) => i.supplierName === supplier.name).slice(0, 10),
      };
    })(),
    async (admin, scope) => {
      const [supplierRows, orderRows, invoiceRows] = await Promise.all([
        query(admin.from("suppliers").select("*").eq("id", id).single(), "supplier"),
        query(admin.from("purchase_orders").select("*").eq("supplier_id", id).eq("organization_id", scope.organizationId).order("order_date", { ascending: false }).limit(10), "purchase_orders"),
        query(admin.from("invoices").select("*").eq("supplier_id", id).eq("organization_id", scope.organizationId).order("issued_at", { ascending: false }).limit(10), "invoices"),
      ]);

      return {
        supplier: mapSupplier(supplierRows ?? {}),
        orders: orderRows.map((row) => ({
          id: row.id,
          organizationId: row.organization_id,
          supplierId: row.supplier_id,
          supplierName: "",
          branchId: row.branch_id,
          branchName: "",
          status: oneOf(row.status, ["draft", "sent", "received", "partially_received", "cancelled"] as const, "draft"),
          orderDate: row.order_date,
          expectedDate: optionalText(row.expected_date),
          total: numberValue(row.total),
          notes: optionalText(row.notes),
          items: [],
        })),
        invoices: invoiceRows.map((row) => ({
          id: row.id,
          organizationId: row.organization_id,
          supplierName: "",
          branchName: "",
          invoiceNumber: row.invoice_number ?? row.id.slice(0, 8),
          status: oneOf(row.status, ["draft", "matched", "paid", "flagged", "posted", "partially_paid", "void"] as const, "draft"),
          total: numberValue(row.total),
          issuedAt: row.issued_at,
          paidAmount: numberValue((row as { paid_amount?: number | string | null }).paid_amount),
          balanceDue: numberValue((row as { balance_due?: number | string | null }).balance_due),
        })),
      };
    },
  );
}

/**
 * Get purchase orders
 */
export async function getPurchaseOrders() {
  if (isDemoMode()) {
    return demoPurchaseOrders;
  }

  return withAdminScope(demoPurchaseOrders, async (admin, scope) => {
    const [orderRows, supplierRows, branchRows, itemRows, orderItemRows] = await Promise.all([
      query(admin.from("purchase_orders").select("*").eq("organization_id", scope.organizationId).order("order_date", { ascending: false }).limit(100), "purchase_orders"),
      query(admin.from("suppliers").select("*").eq("organization_id", scope.organizationId), "suppliers"),
      query(admin.from("branches").select("*").eq("organization_id", scope.organizationId), "branches"),
      query(admin.from("inventory_items").select("*").eq("organization_id", scope.organizationId), "inventory_items"),
      query(admin.from("purchase_order_items").select("*").eq("organization_id", scope.organizationId), "purchase_order_items"),
    ]);

    const supplierMap = indexBy(supplierRows, (row) => row.id);
    const branchMap = indexBy(branchRows, (row) => row.id);
    const itemMap = indexBy(itemRows, (row) => row.id);
    const itemsByOrder = groupBy(orderItemRows, (row) => row.purchase_order_id);

    return orderRows.map((row) => mapPurchaseOrder(row, supplierMap, branchMap, itemMap, itemsByOrder.get(row.id) ?? []));
  });
}

/**
 * Get invoices
 */
export async function getInvoices() {
  if (isDemoMode()) {
    return demoInvoices;
  }

  return withAdminScope(demoInvoices, async (admin, scope) => {
    const [invoiceRows, supplierRows, branchRows] = await Promise.all([
      query(admin.from("invoices").select("*").eq("organization_id", scope.organizationId).order("issued_at", { ascending: false }).limit(100), "invoices"),
      query(admin.from("suppliers").select("*").eq("organization_id", scope.organizationId), "suppliers"),
      query(admin.from("branches").select("*").eq("organization_id", scope.organizationId), "branches"),
    ]);

    const supplierMap = indexBy(supplierRows, (row) => row.id);
    const branchMap = indexBy(branchRows, (row) => row.id);

    return invoiceRows.map((row) => mapInvoice(row, supplierMap, branchMap));
  });
}
