/**
 * Reports module index
 * 
 * Central export for all reporting functionality.
 */

export {
  generateFoodCostReport,
  calculateRecipeCosts,
  type FoodCostReport,
  type FoodCostReportParams,
  type RecipeCostBreakdown,
} from "./food-cost";

export type {
  DashboardReport,
  InventoryReport,
  SalesReport,
  WasteReport,
  StockMovementReport,
} from "./types";

export { getDemoFoodCostReport } from "./demo";