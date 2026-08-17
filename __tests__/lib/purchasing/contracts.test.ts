import { describe, expect, it } from "vitest";
import {
  calculateAcceptedReceiptAmounts,
  calculatePurchaseOrderTotals,
  purchaseOrderDraftInputSchema,
  purchaseReceiptInputSchema,
} from "@/lib/purchasing/contracts";

const itemA = "11111111-1111-4111-8111-111111111111";
const itemB = "22222222-2222-4222-8222-222222222222";

describe("عقد دورة أمر الشراء", () => {
  it("يحسب عدة بنود مع الخصم والضريبة والشحن بدقة أربع منازل", () => {
    expect(calculatePurchaseOrderTotals([
      { itemId: itemA, quantity: 10, unitPrice: 12.5, discountAmount: 5, taxRate: 15 },
      { itemId: itemB, quantity: 3, unitPrice: 20, discountAmount: 0, taxRate: 0 },
    ], 7.25)).toEqual({
      subtotal: 185,
      discountTotal: 5,
      taxTotal: 18,
      shippingTotal: 7.25,
      total: 205.25,
    });
  });

  it("يرفض تكرار الصنف أو تجاوز الخصم لقيمة البند", () => {
    const result = purchaseOrderDraftInputSchema.safeParse({
      supplierId: "33333333-3333-4333-8333-333333333333",
      branchId: "44444444-4444-4444-8444-444444444444",
      orderDate: "2026-07-20",
      expectedDate: "2026-07-22",
      destinationWarehouse: "general",
      destinationLocation: "رف A2",
      paymentTerms: "صافي 30 يوماً",
      shippingAmount: 0,
      idempotencyKey: "po:test:duplicate",
      attachmentMetadata: [],
      items: [
        { itemId: itemA, quantity: 1, unitPrice: 10, discountAmount: 11, taxRate: 0 },
        { itemId: itemA, quantity: 2, unitPrice: 10, discountAmount: 0, taxRate: 0 },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
        "خصم البند يتجاوز قيمته",
        "لا تكرر الصنف نفسه داخل الأمر",
      ]));
    }
  });
});

describe("عقد الاستلام الجزئي", () => {
  it("يقبل الجمع بين المقبول والمرفوض عندما يسجل سبب الرفض والتشغيلة", () => {
    const result = purchaseReceiptInputSchema.safeParse({
      purchaseOrderId: "55555555-5555-4555-8555-555555555555",
      receivedAt: "2026-07-21",
      idempotencyKey: "receipt:test:1",
      lines: [{
        purchaseOrderItemId: "66666666-6666-4666-8666-666666666666",
        acceptedQuantity: 7,
        rejectedQuantity: 3,
        rejectionReason: "عبوات ممزقة",
        batchNumber: "LOT-202607",
        expiryDate: "2026-12-31",
        destinationWarehouse: "kitchen",
        destinationLocation: "تبريد K1",
      }],
    });

    expect(result.success).toBe(true);
  });

  it("يرفض كمية مرفوضة بلا سبب وصلاحية بلا رقم تشغيلة", () => {
    const result = purchaseReceiptInputSchema.safeParse({
      purchaseOrderId: "55555555-5555-4555-8555-555555555555",
      receivedAt: "2026-07-21",
      idempotencyKey: "receipt:test:2",
      lines: [{
        purchaseOrderItemId: "66666666-6666-4666-8666-666666666666",
        acceptedQuantity: 1,
        rejectedQuantity: 1,
        rejectionReason: "",
        batchNumber: "",
        expiryDate: "2026-12-31",
        destinationWarehouse: "general",
        destinationLocation: "منطقة الفحص",
      }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
        "سبب الرفض مطلوب",
        "رقم التشغيلة مطلوب مع الصلاحية",
      ]));
    }
  });

  it("يوزع الخصم والشحن والضريبة على المقبول فقط ويتوازن مع GRNI", () => {
    const amounts = calculateAcceptedReceiptAmounts({
      orderedQuantity: 10,
      acceptedQuantity: 4,
      expectedUnitPrice: 10,
      lineDiscountAmount: 10,
      lineTaxAmount: 13.5,
      orderNetTotal: 90,
      orderShippingTotal: 20,
      totalOrderQuantity: 10,
    });

    expect(amounts).toEqual({
      inventoryTotal: 44,
      taxTotal: 5.4,
      receiptTotal: 49.4,
      landedUnitCost: 11,
    });
    expect(amounts.inventoryTotal + amounts.taxTotal).toBe(amounts.receiptTotal);
  });

  it("لا يعطي الكمية المرفوضة وحدها أي قيمة مخزون أو قيد", () => {
    expect(calculateAcceptedReceiptAmounts({
      orderedQuantity: 10,
      acceptedQuantity: 0,
      expectedUnitPrice: 10,
      lineDiscountAmount: 0,
      lineTaxAmount: 15,
      orderNetTotal: 100,
      orderShippingTotal: 5,
      totalOrderQuantity: 10,
    })).toEqual({ inventoryTotal: 0, taxTotal: 0, receiptTotal: 0, landedUnitCost: 0 });
  });
});
