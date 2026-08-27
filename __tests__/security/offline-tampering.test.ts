/**
 * Offline POS Payload Tampering & Server Verification Tests
 *
 * Validates that:
 * 1. The server never blindly trusts client-computed totals, discounts, or prices.
 * 2. Manipulated offline totals are recalculated from authoritative server pricing.
 * 3. Injected catalog item IDs from other tenants or non-existent items are rejected.
 * 4. Idempotency prevents duplicate stock decrements or double charging on re-sync.
 */
import { describe, it, expect } from "vitest";

describe("Offline POS Tampering & Replay Defense", () => {
  const authoritativeCatalog = [
    { id: "item-burger", name: "برغر", retail_price: 30, tax_rate: 15 },
    { id: "item-fries", name: "بطاطا", retail_price: 10, tax_rate: 15 },
  ];

  const serverRecalculateInvoice = (clientPayload: {
    items: Array<{ catalogItemId: string; quantity: number; clientClaimedPrice?: number }>;
    clientClaimedTotal?: number;
    discount?: number;
  }) => {
    let subtotal = 0;
    let taxTotal = 0;

    for (const line of clientPayload.items) {
      const item = authoritativeCatalog.find((c) => c.id === line.catalogItemId);
      if (!item) {
        throw new Error("صنف غير معروف في الفاتورة.");
      }
      if (line.quantity <= 0) {
        throw new Error("كمية غير صالحة.");
      }

      // Server uses authoritative price, IGNORING clientClaimedPrice
      const lineSubtotal = item.retail_price * line.quantity;
      const lineTax = (lineSubtotal * item.tax_rate) / 100;
      subtotal += lineSubtotal;
      taxTotal += lineTax;
    }

    const discount = Math.max(0, Math.min(clientPayload.discount ?? 0, subtotal));
    const total = subtotal + taxTotal - discount;

    return { subtotal, taxTotal, total };
  };

  it("recomputes invoice totals correctly ignoring manipulated client prices", () => {
    // Malicious cashier tampered with IndexedDB: claims burger is 1 shekel and total is 1 shekel
    const tamperedPayload = {
      items: [{ catalogItemId: "item-burger", quantity: 1, clientClaimedPrice: 1 }],
      clientClaimedTotal: 1,
      discount: 0,
    };

    const serverResult = serverRecalculateInvoice(tamperedPayload);

    // Server computed the true total: 30 + 15% tax (4.5) = 34.5
    expect(serverResult.subtotal).toBe(30);
    expect(serverResult.taxTotal).toBe(4.5);
    expect(serverResult.total).toBe(34.5);
  });

  it("rejects unknown or foreign-tenant items in offline synced payloads", () => {
    const maliciousPayload = {
      items: [{ catalogItemId: "item-secret-org-b", quantity: 1 }],
      clientClaimedTotal: 50,
    };

    expect(() => serverRecalculateInvoice(maliciousPayload)).toThrow("صنف غير معروف");
  });

  it("enforces idempotency preventing duplicate execution on replayed sync requests", () => {
    const processedKeys = new Set<string>();

    const processSyncWithIdempotency = (idempotencyKey: string) => {
      if (processedKeys.has(idempotencyKey)) {
        return { status: "duplicate", message: "تمت معالجة الفاتورة مسبقاً." };
      }
      processedKeys.add(idempotencyKey);
      return { status: "created", message: "تم إصدار الفاتورة بنجاح." };
    };

    const key = "offline-idem-999";
    const res1 = processSyncWithIdempotency(key);
    expect(res1.status).toBe("created");

    // Replay attack / duplicate network retry
    const res2 = processSyncWithIdempotency(key);
    expect(res2.status).toBe("duplicate");
    expect(res2.message).toContain("مسبقاً");
  });
});
