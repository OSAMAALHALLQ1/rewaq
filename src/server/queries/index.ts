/**
 * Query module index
 * 
 * This file re-exports all domain queries for backward compatibility.
 * New code should import directly from domain modules for better tree-shaking.
 * 
 * @example
 * // Old way (still works):
 * import { getDashboardData } from '@/server/queries';
 * 
 * // New way (preferred):
 * import { getDashboardData } from '@/server/queries/dashboard';
 */

// ============================================================================
// Re-export all domain modules
// ============================================================================

export * from "./dashboard";
export * from "./inventory";
export * from "./purchasing";
export * from "./sales";
export * from "./recipes";
export * from "./marketing";
export * from "./admin";

// ============================================================================
// Re-export shared utilities (for internal use)
// ============================================================================

export {
  isDemoMode,
  withAdminScope,
  query,
  numberValue,
  dateKey,
  oneOf,
  optionalText,
  indexBy,
  groupBy,
  sumBy,
  mapOrganization,
  mapBranch,
  fallbackContext,
  type AdminClient,
  type AppScope,
  type OrganizationContext,
  type QueryResult,
} from "./_shared/utils";

// ============================================================================
// Re-export mappers (for internal use)
// ============================================================================

export {
  mapSupplier,
  mapInventoryItem,
  mapBranchStock,
  mapStockMovement,
  mapPurchaseOrder,
  mapInvoice,
  mapCustomerInvoice,
  mapRecipeIngredient,
  mapRecipe,
  mapMenuItem,
} from "./_shared/mappers";

// ============================================================================
// Backward compatibility aliases
// ============================================================================

// Keep old exports working for existing code
export type { StockCountSummary } from "./inventory";
export type { AccountApprovalRequest } from "./admin";