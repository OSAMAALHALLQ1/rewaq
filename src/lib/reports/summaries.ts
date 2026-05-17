import type { BranchStock, InventoryItem, MenuItem, WasteLog } from "@/types/domain";

export function calculateInventoryValue(items: InventoryItem[], stock: BranchStock[]) {
  return stock.reduce((sum, row) => {
    const item = items.find((candidate) => candidate.id === row.itemId);
    return sum + row.quantity * (item?.averageCost ?? 0);
  }, 0);
}

export function calculateWasteTotal(logs: WasteLog[]) {
  return logs.reduce((sum, log) => sum + log.cost, 0);
}

export function averageFoodCost(menuItems: MenuItem[]) {
  if (menuItems.length === 0) return 0;
  return menuItems.reduce((sum, item) => sum + item.foodCostPercent, 0) / menuItems.length;
}
