/**
 * Legacy re-export from app.ts
 * 
 * This file exists for backward compatibility with existing imports.
 * All functions have been moved to domain-specific modules in the queries/ directory.
 * 
 * @deprecated Import from specific domain modules instead:
 * 
 * import { getDashboardData } from "@/server/queries/dashboard";
 * import { getInventoryData } from "@/server/queries/inventory";
 * import { getPurchasingData } from "@/server/queries/purchasing";
 * import { getCustomerInvoicesData } from "@/server/queries/sales";
 * import { getRecipesData } from "@/server/queries/recipes";
 * import { getMarketingData } from "@/server/queries/marketing";
 * import { getAdminData } from "@/server/queries/admin";
 */

// Re-export everything from the new index
export * from "./index";

// Re-export all missing functions from their respective modules
export {
  getBillPaymentsData,
  getAmwaliData,
  getTablesData,
  getFinancialCalendarData,
  getOperationsData,
  getReportsData,
  getCatalogData,
} from "./admin";

export { getOrganizationContext } from "./inventory";
export { getNotifications } from "./dashboard";