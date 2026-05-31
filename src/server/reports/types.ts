/**
 * Report types for the reporting system
 */

export type DashboardReport = {
  metrics: {
    sales: number;
    inventoryValue: number;
    foodCostPercent: number;
    wasteCost: number;
  };
  alerts: Array<{
    type: "info" | "warning" | "danger";
    title: string;
    description: string;
  }>;
  trends: {
    sales: Array<{ label: string; value: number }>;
    foodCost: Array<{ label: string; value: number }>;
    waste: Array<{ label: string; value: number }>;
  };
  generatedAt: string;
};

export type InventoryReport = {
  summary: {
    totalItems: number;
    totalValue: number;
    lowStockItems: number;
    expiringItems: number;
  };
  categories: Array<{
    name: string;
    itemCount: number;
    totalValue: number;
  }>;
  lowStockAlerts: Array<{
    itemId: string;
    itemName: string;
    currentQuantity: number;
    minimumQuantity: number;
    recommendedOrder: number;
  }>;
  expiryAlerts: Array<{
    itemId: string;
    itemName: string;
    expiryDate: string;
    quantity: number;
    daysUntilExpiry: number;
  }>;
  generatedAt: string;
};

export type SalesReport = {
  summary: {
    totalRevenue: number;
    totalTransactions: number;
    averageOrderValue: number;
    topCategory: string;
  };
  byBranch: Array<{
    branchId: string;
    branchName: string;
    revenue: number;
    transactions: number;
    avgOrderValue: number;
  }>;
  byPaymentMethod: Array<{
    method: "cash" | "card" | "bank_transfer" | "delivery_app";
    count: number;
    amount: number;
    percentage: number;
  }>;
  topItems: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    revenue: number;
  }>;
  generatedAt: string;
};

export type WasteReport = {
  summary: {
    totalCost: number;
    wasteCount: number;
    topCategory: string;
  };
  byCategory: Array<{
    category: string;
    cost: number;
    count: number;
    percentage: number;
  }>;
  byBranch: Array<{
    branchId: string;
    branchName: string;
    cost: number;
    count: number;
  }>;
  byReason: Array<{
    reason: string;
    cost: number;
    count: number;
  }>;
  trend: Array<{
    period: string;
    cost: number;
    count: number;
  }>;
  generatedAt: string;
};

export type StockMovementReport = {
  summary: {
    totalIn: number;
    totalOut: number;
    netChange: number;
  };
  byType: Array<{
    type: string;
    count: number;
    totalQuantity: number;
    totalCost: number;
  }>;
  topItems: Array<{
    itemId: string;
    itemName: string;
    totalIn: number;
    totalOut: number;
    currentBalance: number;
  }>;
  generatedAt: string;
};