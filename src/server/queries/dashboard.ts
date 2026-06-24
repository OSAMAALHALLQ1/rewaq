/**
 * Dashboard domain queries
 * Handles dashboard metrics, alerts, and summaries
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import {
  demoDashboard,
  demoNotifications,
  demoPurchaseOrders,
  demoInvoices,
  demoWasteLogs,
  demoStockMovements,
} from "@/lib/demo-data";
import {
  isDemoMode,
  withAdminScope,
  numberValue,
  type AdminClient,
} from "./_shared/utils";

// ============================================================================
// Types
// ============================================================================

export type DashboardData = typeof demoDashboard;
export type Notification = typeof demoNotifications[number];

// ============================================================================
// Loaders
// ============================================================================

async function loadDashboardData(admin: AdminClient, organizationId: string) {
  // Fetch real data for dashboard
  const [
    inventoryItems,
    purchaseOrderRows,
    wasteRows,
    notificationRows,
  ] = await Promise.all([
    admin.from("inventory_items").select("*").eq("organization_id", organizationId),
    admin.from("purchase_orders").select("*").eq("organization_id", organizationId).in("status", ["draft", "sent"]),
    admin.from("waste_logs").select("*").eq("organization_id", organizationId).gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    admin.from("notifications").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(10),
  ]);

  // Calculate metrics
  const lowStockItems = inventoryItems.data?.filter(item => {
    const avgCost = numberValue(item.average_cost);
    const minQty = numberValue(item.minimum_quantity);
    return avgCost < minQty;
  }) ?? [];

  const openPurchaseOrders = purchaseOrderRows.data?.length ?? 0;
  // Calculate food cost from recipes
  const recipes = await admin.from("recipes").select("*").eq("organization_id", organizationId);
  const totalRecipeCost = (recipes.data ?? []).reduce((sum: number, recipe: any) => sum + numberValue(recipe.total_cost), 0);
  const avgFoodCost = recipes.data?.length ? (totalRecipeCost / recipes.data.length) : 0;

  // Calculate waste
  const totalWaste = (wasteRows.data ?? []).reduce((sum: number, waste: any) => sum + numberValue(waste.total_cost), 0);

  // Get alerts from notifications
  const alerts = (notificationRows.data ?? []).map((notif: any) => ({
    id: notif.id,
    organizationId: notif.organization_id ?? organizationId,
    type: notif.notification_type,
    title: notif.title,
    body: notif.body,
    severity: notif.severity ?? "info",
    createdAt: notif.created_at,
  }));

  // Build inventory by category (placeholder - real implementation would aggregate)
  const inventoryByCategory = [
    { label: "بروتين", value: 15400 },
    { label: "نشويات", value: 8200 },
    { label: "زيوت", value: 5100 },
    { label: "صوصات", value: 2700 },
    { label: "تغليف", value: 4100 },
  ];

  // Build purchase cost trend (placeholder)
  const purchaseCost30Days = [
    { label: "الأسبوع 1", value: 1200 },
    { label: "الأسبوع 2", value: 2100 },
    { label: "الأسبوع 3", value: 1800 },
    { label: "الأسبوع 4", value: 3200 },
  ];

  return {
    salesEstimate: 18450, // Would come from actual sales data
    inventoryValue: (inventoryItems.data ?? []).reduce((sum: number, item: any) => sum + numberValue(item.average_cost) * 100, 0),
    lowStockCount: lowStockItems.length,
    openPurchaseOrders,
    foodCostPercent: Math.round(avgFoodCost * 10) / 10,
    highCostRecipes: [], // Would filter from actual recipes
    alerts,
    inventoryByCategory,
    purchaseCost30Days,
    foodCostTrend: [
      { label: "الأسبوع 1", value: 31 },
      { label: "الأسبوع 2", value: 28 },
      { label: "الأسبوع 3", value: 29.5 },
      { label: "الأسبوع 4", value: 29.8 },
    ],
    wasteByBranch: [
      { label: "الفرع 1", value: Math.round(totalWaste * 0.6) },
      { label: "الفرع 2", value: Math.round(totalWaste * 0.4) },
    ],
  };
}

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Get dashboard data with metrics and alerts
 */
export async function getDashboardData(): Promise<DashboardData> {
  if (isDemoMode()) {
    return demoDashboard;
  }

  return withAdminScope(demoDashboard, (admin, scope) => loadDashboardData(admin, scope.organizationId));
}

/**
 * Get notifications for the organization
 */
export async function getNotifications(): Promise<Notification[]> {
  if (isDemoMode()) {
    return demoNotifications;
  }

  return withAdminScope(
    demoNotifications,
    async (admin, scope) => {
      const { data } = await admin
        .from("notifications")
        .select("*")
        .eq("organization_id", scope.organizationId)
        .order("created_at", { ascending: false })
        .limit(20);

      return (data ?? []).map((row: any) => ({
        id: row.id,
        organizationId: row.organization_id,
        type: row.notification_type,
        title: row.title,
        body: row.body,
        severity: row.severity ?? "info",
        createdAt: row.created_at,
      }));
    },
  );
}

/**
 * Get quick stats for dashboard cards
 */
export async function getDashboardStats() {
  if (isDemoMode()) {
    return {
      wasteLogsCount: demoWasteLogs.length,
      movementsCount: demoStockMovements.length,
      openPurchaseOrders: demoPurchaseOrders.length,
      openInvoices: demoInvoices.length,
    };
  }

  return withAdminScope(
    {
      wasteLogsCount: demoWasteLogs.length,
      movementsCount: demoStockMovements.length,
      openPurchaseOrders: demoPurchaseOrders.length,
      openInvoices: demoInvoices.length,
    },
    async (admin, scope) => {
      const [wasteRows, movementRows, poRows, invoiceRows] = await Promise.all([
        admin.from("waste_logs").select("id", { count: "exact", head: true }).eq("organization_id", scope.organizationId),
        admin.from("stock_movements").select("id", { count: "exact", head: true }).eq("organization_id", scope.organizationId),
        admin.from("purchase_orders").select("id", { count: "exact", head: true }).eq("organization_id", scope.organizationId).in("status", ["draft", "sent"]),
        admin.from("invoices").select("id", { count: "exact", head: true }).eq("organization_id", scope.organizationId).in("status", ["draft", "matched"]),
      ]);

      return {
        wasteLogsCount: wasteRows.count ?? 0,
        movementsCount: movementRows.count ?? 0,
        openPurchaseOrders: poRows.count ?? 0,
        openInvoices: invoiceRows.count ?? 0,
      };
    },
  );
}
