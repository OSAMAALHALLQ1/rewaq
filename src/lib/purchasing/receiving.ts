import type { PurchaseOrder, StockMovement } from "@/types/domain";

export function calculatePriceIncreasePercent(previousPrice: number, newPrice: number) {
  if (previousPrice <= 0) return 0;
  return ((newPrice - previousPrice) / previousPrice) * 100;
}

export function buildReceivingMovements(order: PurchaseOrder): Pick<StockMovement, "itemId" | "itemName" | "quantity" | "unitCost" | "movementType">[] {
  return order.items.map((item) => ({
    itemId: item.itemId,
    itemName: item.itemName,
    quantity: item.receivedQuantity || item.quantity,
    unitCost: item.expectedUnitPrice,
    movementType: "purchase",
  }));
}
