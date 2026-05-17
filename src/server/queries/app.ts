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
  demoPurchaseOrders,
  demoPermissionSettings,
  demoRecipes,
  demoRestaurantTables,
  demoSalesShift,
  demoSocialAccounts,
  demoSocialPosts,
  demoSocialTemplates,
  demoSmartSavingsFeatures,
  demoStockMovements,
  demoSuppliers,
  demoSystemLogs,
  demoTransfers,
  demoWasteLogs,
} from "@/lib/demo-data";

export async function getOrganizationContext() {
  return {
    organization: demoOrganization,
    branches: demoBranches,
  };
}

export async function getDashboardData() {
  return demoDashboard;
}

export async function getInventoryData() {
  return {
    items: demoInventoryItems,
    categories: demoCategories,
    branchStock: demoBranchStock,
    movements: demoStockMovements,
    suppliers: demoSuppliers,
    branches: demoBranches,
  };
}

export async function getInventoryItem(id: string) {
  const item = demoInventoryItems.find((candidate) => candidate.id === id);
  return item
    ? {
        item,
        stock: demoBranchStock.filter((stock) => stock.itemId === id),
        movements: demoStockMovements.filter((movement) => movement.itemId === id),
      }
    : null;
}

export async function getPurchasingData() {
  return {
    suppliers: demoSuppliers,
    purchaseOrders: demoPurchaseOrders,
    invoices: demoInvoices,
    branches: demoBranches,
    items: demoInventoryItems,
  };
}

export async function getCustomerInvoicesData() {
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

export async function getCustomerInvoice(id: string) {
  return demoCustomerInvoices.find((invoice) => invoice.id === id) ?? null;
}

export async function getRecipesData() {
  return {
    recipes: demoRecipes,
    menuItems: demoMenuItems,
    inventoryItems: demoInventoryItems,
    branches: demoBranches,
  };
}

export async function getRecipe(id: string) {
  const recipe = demoRecipes.find((candidate) => candidate.id === id);
  return recipe
    ? {
        recipe,
        menuItems: demoMenuItems.filter((item) => item.recipeId === id),
      }
    : null;
}

export async function getMenuItem(id: string) {
  return demoMenuItems.find((item) => item.id === id) ?? null;
}

export async function getCatalogData() {
  return {
    items: demoCatalogItems,
    categories: demoCategories,
    branches: demoBranches,
    permissions: demoPermissionSettings,
  };
}

export async function getOperationsData() {
  return {
    wasteLogs: demoWasteLogs,
    transfers: demoTransfers,
    branches: demoBranches,
    items: demoInventoryItems,
  };
}

export async function getReportsData() {
  return {
    dashboard: demoDashboard,
    inventoryItems: demoInventoryItems,
    branchStock: demoBranchStock,
    purchaseOrders: demoPurchaseOrders,
    wasteLogs: demoWasteLogs,
    menuItems: demoMenuItems,
    suppliers: demoSuppliers,
    branches: demoBranches,
    financialCalendar: demoFinancialCalendar,
  };
}

export async function getFinancialCalendarData() {
  return {
    days: demoFinancialCalendar,
    branches: demoBranches,
  };
}

export async function getAmwaliData() {
  return {
    costTracking: demoCostTracking,
    branches: demoBranches,
  };
}

export async function getTablesData() {
  return {
    tables: demoRestaurantTables,
    branches: demoBranches,
    catalogItems: demoCatalogItems,
  };
}

export async function getBillPaymentsData() {
  return {
    bills: demoPayableBills,
    batches: demoBillPaymentBatches,
    mandates: demoDirectDebitMandates,
    runs: demoDirectDebitRuns,
  };
}

export async function getSmartSavingsData() {
  return {
    features: demoSmartSavingsFeatures,
    receipts: demoDigitalReceiptShares,
    organization: demoOrganization,
  };
}

export async function getMarketingData() {
  return {
    accounts: demoSocialAccounts,
    posts: demoSocialPosts,
    templates: demoSocialTemplates,
    menuItems: demoMenuItems,
  };
}

export async function getNotifications() {
  return demoNotifications;
}

export async function getAdminData() {
  return {
    metrics: demoAdminMetrics,
    organizations: [demoOrganization],
    users: [
      { id: "user-1", name: "مالك مطعم التايلندي", email: "owner@rewaq.app", role: "organization_owner" },
      { id: "user-2", name: "سارة النجار", email: "sara@thai.example", role: "branch_manager" },
      { id: "user-3", name: "محمود عوض", email: "mahmoud@thai.example", role: "inventory_manager" },
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
      { id: "SUP-91", organization: "مطعم التايلندي", subject: "ربط إنستغرام", status: "open", priority: "high" },
      { id: "SUP-92", organization: "كافيه تجريبي", subject: "سؤال عن الفاتورة", status: "pending", priority: "normal" },
    ],
  };
}
