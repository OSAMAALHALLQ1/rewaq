import type { StockMovement, StockMovementType } from "@/types/domain";

export type StockMovementInput = {
  organizationId: string;
  branchId: string;
  branchName: string;
  itemId: string;
  itemName: string;
  movementType: StockMovementType;
  quantity: number;
  unitCost: number;
  reference?: string;
  notes?: string;
};

export function buildStockMovement(input: StockMovementInput): StockMovement {
  return {
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    branchId: input.branchId,
    branchName: input.branchName,
    itemId: input.itemId,
    itemName: input.itemName,
    movementType: input.movementType,
    quantity: input.quantity,
    unitCost: input.unitCost,
    totalCost: input.quantity * input.unitCost,
    reference: input.reference,
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };
}

export function isLowStock(quantity: number, minimumQuantity: number) {
  return quantity <= minimumQuantity;
}
