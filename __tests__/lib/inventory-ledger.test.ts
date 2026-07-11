import { describe, expect, it } from "vitest";
import { isLowStock, quantitiesByItem } from "@/lib/inventory/ledger";

describe("رصيد المخزون", () => {
  it("يجمع كمية المادة عبر الفروع", () => {
    const quantities = quantitiesByItem([
      { itemId: "meat", quantity: 4 },
      { itemId: "meat", quantity: 6 },
      { itemId: "salt", quantity: 100 },
    ]);

    expect(quantities.get("meat")).toBe(10);
    expect(quantities.get("salt")).toBe(100);
  });

  it("يحدد النقص من الكمية الفعلية لا من تكلفة المادة", () => {
    expect(isLowStock(0, 10)).toBe(true);
    expect(isLowStock(10, 10)).toBe(true);
    expect(isLowStock(100, 5)).toBe(false);
  });
});
