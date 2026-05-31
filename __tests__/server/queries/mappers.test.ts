/**
 * Tests for data mapper functions
 */
import { describe, it, expect } from "vitest";
import {
  mapSupplier,
  mapInventoryItem,
  mapBranchStock,
  mapPurchaseOrder,
  mapInvoice,
} from "@/server/queries/_shared/mappers";

describe("mapSupplier", () => {
  it("should map database row to Supplier type", () => {
    const row = {
      id: "sup-123",
      organization_id: "org-456",
      name: "مورد الدجاج",
      phone: "0591234567",
      email: "chicken@supplier.com",
      address: "شارع المورد",
      notes: "توريد يومي",
      status: "active",
    };

    const result = mapSupplier(row, 15);

    expect(result).toEqual({
      id: "sup-123",
      organizationId: "org-456",
      name: "مورد الدجاج",
      phone: "0591234567",
      email: "chicken@supplier.com",
      address: "شارع المورد",
      notes: "توريد يومي",
      status: "active",
      priceRisk: 15,
    });
  });

  it("should handle inactive status", () => {
    const row = {
      id: "sup-123",
      organization_id: "org-456",
      name: "مورد قديم",
      phone: null,
      email: null,
      address: null,
      notes: null,
      status: "archived",
    };

    const result = mapSupplier(row);

    expect(result.status).toBe("inactive");
    expect(result.phone).toBe("");
    expect(result.email).toBe("");
  });

  it("should default priceRisk to 0", () => {
    const row = {
      id: "sup-123",
      organization_id: "org-456",
      name: "مورد",
      phone: null,
      email: null,
      address: null,
      notes: null,
      status: "active",
    };

    const result = mapSupplier(row);

    expect(result.priceRisk).toBe(0);
  });
});

describe("mapInventoryItem", () => {
  it("should map database row to InventoryItem type", () => {
    const categoryMap = new Map([
      ["cat-meat", { id: "cat-meat", name: "لحوم", organization_id: "org-456" }],
    ]);
    const supplierMap = new Map([
      ["sup-123", { id: "sup-123", name: "مورد الدجاج" }],
    ]);
    const unitMap = new Map([
      ["unit-kg", { id: "unit-kg", name: "كغم" }],
      ["unit-pc", { id: "unit-pc", name: "قطعة" }],
    ]);

    const row = {
      id: "item-001",
      organization_id: "org-456",
      name: "دجاج طازج",
      category_id: "cat-meat",
      purchase_unit_id: "unit-kg",
      usage_unit_id: "unit-pc",
      last_purchase_price: 18.5,
      average_cost: 17.2,
      minimum_quantity: 40,
      primary_supplier_id: "sup-123",
      sku: "CHK-001",
      notes: "صدور دجاج مجمدة",
      status: "active",
    };

    const result = mapInventoryItem(row, categoryMap, supplierMap, unitMap);

    expect(result.id).toBe("item-001");
    expect(result.organizationId).toBe("org-456");
    expect(result.name).toBe("دجاج طازج");
    expect(result.categoryName).toBe("لحوم");
    expect(result.purchaseUnit).toBe("كغم");
    expect(result.usageUnit).toBe("قطعة");
    expect(result.lastPurchasePrice).toBe(18.5);
    expect(result.averageCost).toBe(17.2);
    expect(result.minimumQuantity).toBe(40);
    expect(result.primarySupplierName).toBe("مورد الدجاج");
    expect(result.sku).toBe("CHK-001");
    expect(result.isActive).toBe(true);
  });

  it("should handle missing category", () => {
    const categoryMap = new Map();
    const supplierMap = new Map();
    const unitMap = new Map();

    const row = {
      id: "item-001",
      organization_id: "org-456",
      name: "مادة",
      category_id: "unknown-cat",
      purchase_unit_id: null,
      usage_unit_id: null,
      last_purchase_price: 10,
      average_cost: 9,
      minimum_quantity: 5,
      primary_supplier_id: null,
      sku: null,
      notes: null,
      status: "active",
    };

    const result = mapInventoryItem(row, categoryMap, supplierMap, unitMap);

    expect(result.categoryName).toBe("بدون تصنيف");
    expect(result.purchaseUnit).toBe("");
    expect(result.usageUnit).toBe("");
    expect(result.primarySupplierName).toBeUndefined();
  });
});

describe("mapBranchStock", () => {
  it("should map database row to BranchStock type", () => {
    const branchMap = new Map([
      ["branch-001", { id: "branch-001", name: "الفرع الرئيسي" }],
    ]);

    const row = {
      branch_id: "branch-001",
      item_id: "item-001",
      quantity: 50,
      reserved_quantity: 5,
    };

    const result = mapBranchStock(row, branchMap);

    expect(result).toEqual({
      branchId: "branch-001",
      branchName: "الفرع الرئيسي",
      itemId: "item-001",
      quantity: 50,
      reservedQuantity: 5,
    });
  });

  it("should handle unknown branch", () => {
    const branchMap = new Map();

    const row = {
      branch_id: "unknown-branch",
      item_id: "item-001",
      quantity: 30,
      reserved_quantity: 0,
    };

    const result = mapBranchStock(row, branchMap);

    expect(result.branchName).toBe("فرع غير معروف");
  });
});

describe("mapPurchaseOrder", () => {
  it("should map database row to PurchaseOrder type", () => {
    const supplierMap = new Map([
      ["sup-123", { id: "sup-123", name: "مورد الدجاج" }],
    ]);
    const branchMap = new Map([
      ["branch-001", { id: "branch-001", name: "الفرع الرئيسي" }],
    ]);
    const itemMap = new Map([
      ["item-001", { id: "item-001", name: "دجاج" }],
    ]);

    const row = {
      id: "po-001",
      organization_id: "org-456",
      supplier_id: "sup-123",
      branch_id: "branch-001",
      status: "received",
      order_date: "2026-05-15",
      expected_date: "2026-05-20",
      total: 1500,
      notes: "طلب شهري",
    };

    const orderItems = [
      { item_id: "item-001", quantity: 100, expected_unit_price: 15, received_quantity: 100 },
    ];

    const result = mapPurchaseOrder(row, supplierMap, branchMap, itemMap, orderItems);

    expect(result.id).toBe("po-001");
    expect(result.supplierName).toBe("مورد الدجاج");
    expect(result.branchName).toBe("الفرع الرئيسي");
    expect(result.status).toBe("received");
    expect(result.total).toBe(1500);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].itemName).toBe("دجاج");
  });
});

describe("mapInvoice", () => {
  it("should map database row to Invoice type", () => {
    const supplierMap = new Map([
      ["sup-123", { id: "sup-123", name: "مورد الخضار" }],
    ]);
    const branchMap = new Map([
      ["branch-001", { id: "branch-001", name: "فرع الرمال" }],
    ]);

    const row = {
      id: "inv-001",
      organization_id: "org-456",
      supplier_id: "sup-123",
      branch_id: "branch-001",
      invoice_number: "INV-2026-001",
      status: "paid",
      total: 2500,
      issued_at: "2026-05-10",
    };

    const result = mapInvoice(row, supplierMap, branchMap);

    expect(result.id).toBe("inv-001");
    expect(result.supplierName).toBe("مورد الخضار");
    expect(result.branchName).toBe("فرع الرمال");
    expect(result.invoiceNumber).toBe("INV-2026-001");
    expect(result.status).toBe("paid");
    expect(result.total).toBe(2500);
    expect(result.issuedAt).toBe("2026-05-10");
  });

  it("should use id as fallback for invoice number", () => {
    const supplierMap = new Map();
    const branchMap = new Map();

    const row = {
      id: "inv-abc12345",
      organization_id: "org-456",
      supplier_id: "sup-123",
      branch_id: "branch-001",
      invoice_number: null,
      status: "draft",
      total: 100,
      issued_at: "2026-05-01",
    };

    const result = mapInvoice(row, supplierMap, branchMap);

    expect(result.invoiceNumber).toBe("inv-abc1"); // First 8 chars
  });
});