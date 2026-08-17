import { z } from "zod";

const decimalQuantity = z.coerce.number().finite().positive("الكمية يجب أن تكون أكبر من صفر");
const nonNegativeMoney = z.coerce.number().finite().nonnegative("القيمة لا يمكن أن تكون سالبة");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "صيغة التاريخ غير صالحة");

export const purchaseOrderLineInputSchema = z.object({
  itemId: z.string().uuid("اختر صنفاً صالحاً"),
  quantity: decimalQuantity,
  unitPrice: nonNegativeMoney,
  discountAmount: nonNegativeMoney.default(0),
  taxRate: z.coerce.number().finite().min(0).max(100).default(0),
}).superRefine((line, context) => {
  if (line.discountAmount > line.quantity * line.unitPrice) {
    context.addIssue({
      code: "custom",
      path: ["discountAmount"],
      message: "خصم البند يتجاوز قيمته",
    });
  }
});

export const purchaseOrderDraftInputSchema = z.object({
  supplierId: z.string().uuid("اختر المورد"),
  branchId: z.string().uuid("اختر القسم"),
  orderDate: isoDate,
  expectedDate: isoDate,
  destinationWarehouse: z.enum(["general", "kitchen"]),
  destinationLocation: z.string().trim().min(2, "موقع الاستلام مطلوب").max(120),
  paymentTerms: z.string().trim().min(2, "شروط الدفع مطلوبة").max(500),
  shippingAmount: nonNegativeMoney.default(0),
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().trim().min(8, "مفتاح منع التكرار غير صالح"),
  attachmentMetadata: z.array(z.object({
    name: z.string().trim().min(1).max(180),
    url: z.string().trim().url("رابط المرفق غير صالح").max(2000).optional(),
  })).max(10).default([]),
  items: z.array(purchaseOrderLineInputSchema).min(1, "أضف بنداً واحداً على الأقل").max(200),
}).superRefine((order, context) => {
  if (order.expectedDate < order.orderDate) {
    context.addIssue({
      code: "custom",
      path: ["expectedDate"],
      message: "التسليم المتوقع لا يسبق تاريخ الأمر",
    });
  }
  const uniqueItemIds = new Set(order.items.map((item) => item.itemId));
  if (uniqueItemIds.size !== order.items.length) {
    context.addIssue({ code: "custom", path: ["items"], message: "لا تكرر الصنف نفسه داخل الأمر" });
  }
});

export const purchaseReceiptLineInputSchema = z.object({
  purchaseOrderItemId: z.string().uuid("بند أمر الشراء غير صالح"),
  acceptedQuantity: z.coerce.number().finite().nonnegative().default(0),
  rejectedQuantity: z.coerce.number().finite().nonnegative().default(0),
  rejectionReason: z.string().trim().max(500).optional(),
  batchNumber: z.string().trim().max(120).optional(),
  expiryDate: z.union([isoDate, z.literal("")]).optional(),
  destinationWarehouse: z.enum(["general", "kitchen"]),
  destinationLocation: z.string().trim().min(2, "موقع التخزين مطلوب").max(120),
}).superRefine((line, context) => {
  if (line.acceptedQuantity + line.rejectedQuantity <= 0) {
    context.addIssue({ code: "custom", path: ["acceptedQuantity"], message: "أدخل كمية مقبولة أو مرفوضة" });
  }
  if (line.rejectedQuantity > 0 && !line.rejectionReason) {
    context.addIssue({ code: "custom", path: ["rejectionReason"], message: "سبب الرفض مطلوب" });
  }
  if (line.expiryDate && !line.batchNumber) {
    context.addIssue({ code: "custom", path: ["batchNumber"], message: "رقم التشغيلة مطلوب مع الصلاحية" });
  }
});

export const purchaseReceiptInputSchema = z.object({
  purchaseOrderId: z.string().uuid("أمر الشراء غير صالح"),
  receivedAt: isoDate,
  notes: z.string().trim().max(2000).optional(),
  idempotencyKey: z.string().trim().min(8, "مفتاح منع التكرار غير صالح"),
  lines: z.array(purchaseReceiptLineInputSchema).min(1, "أدخل بند استلام واحداً على الأقل").max(200),
}).superRefine((receipt, context) => {
  const uniqueLineIds = new Set(receipt.lines.map((line) => line.purchaseOrderItemId));
  if (uniqueLineIds.size !== receipt.lines.length) {
    context.addIssue({ code: "custom", path: ["lines"], message: "تكرر بند أمر الشراء في الاستلام" });
  }
});

export type PurchaseOrderLineInput = z.infer<typeof purchaseOrderLineInputSchema>;
export type PurchaseReceiptLineInput = z.infer<typeof purchaseReceiptLineInputSchema>;

export function roundPurchaseMoney(value: number): number {
  return Math.round((Number(value) || 0) * 10_000) / 10_000;
}

export function calculatePurchaseOrderTotals(lines: PurchaseOrderLineInput[], shippingAmount: number) {
  const subtotal = roundPurchaseMoney(
    lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
  );
  const discountTotal = roundPurchaseMoney(
    lines.reduce((sum, line) => sum + line.discountAmount, 0),
  );
  const taxTotal = roundPurchaseMoney(lines.reduce((sum, line) => {
    const taxable = line.quantity * line.unitPrice - line.discountAmount;
    return sum + taxable * line.taxRate / 100;
  }, 0));
  const shippingTotal = roundPurchaseMoney(shippingAmount);
  return {
    subtotal,
    discountTotal,
    taxTotal,
    shippingTotal,
    total: roundPurchaseMoney(subtotal - discountTotal + taxTotal + shippingTotal),
  };
}

export function calculateAcceptedReceiptAmounts(input: {
  orderedQuantity: number;
  acceptedQuantity: number;
  expectedUnitPrice: number;
  lineDiscountAmount: number;
  lineTaxAmount: number;
  orderNetTotal: number;
  orderShippingTotal: number;
  totalOrderQuantity: number;
}) {
  if (input.orderedQuantity <= 0 || input.acceptedQuantity <= 0) {
    return { inventoryTotal: 0, taxTotal: 0, receiptTotal: 0, landedUnitCost: 0 };
  }
  const lineNetTotal = roundPurchaseMoney(
    input.orderedQuantity * input.expectedUnitPrice - input.lineDiscountAmount,
  );
  const baseInventoryTotal = roundPurchaseMoney(
    input.acceptedQuantity * lineNetTotal / input.orderedQuantity,
  );
  const shippingAllocation = input.orderShippingTotal <= 0
    ? 0
    : input.orderNetTotal > 0
      ? roundPurchaseMoney(input.orderShippingTotal * baseInventoryTotal / input.orderNetTotal)
      : input.totalOrderQuantity > 0
        ? roundPurchaseMoney(input.orderShippingTotal * input.acceptedQuantity / input.totalOrderQuantity)
        : 0;
  const inventoryTotal = roundPurchaseMoney(baseInventoryTotal + shippingAllocation);
  const taxTotal = roundPurchaseMoney(
    input.acceptedQuantity * input.lineTaxAmount / input.orderedQuantity,
  );
  const receiptTotal = roundPurchaseMoney(inventoryTotal + taxTotal);
  return {
    inventoryTotal,
    taxTotal,
    receiptTotal,
    landedUnitCost: roundPurchaseMoney(inventoryTotal / input.acceptedQuantity),
  };
}

export function parseJsonField(value: FormDataEntryValue | null, label: string): unknown {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} مطلوبة.`);
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`صيغة ${label} غير صالحة.`);
  }
}
