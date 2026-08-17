import { describe, expect, it } from "vitest";
import { summarizeSupplierBills } from "@/server/queries/financial-services/bill-payments";
import type { Invoice } from "@/types/domain";

function invoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "invoice-1",
    organizationId: "org-1",
    supplierName: "مورد الاختبار",
    branchName: "الفرع الرئيسي",
    invoiceNumber: "INV-1",
    status: "posted",
    total: 100,
    issuedAt: "2026-08-01",
    dueDate: "2026-08-10",
    paidAmount: 0,
    balanceDue: 100,
    ...overrides,
  };
}

describe("supplier bill payments summary", () => {
  it("uses actual invoice balances and excludes settled and void invoices", () => {
    const result = summarizeSupplierBills([
      invoice({ id: "open", balanceDue: 100 }),
      invoice({ id: "partial", paidAmount: 40, balanceDue: 60 }),
      invoice({ id: "paid", status: "paid", paidAmount: 100, balanceDue: 0 }),
      invoice({ id: "void", status: "void", balanceDue: 500 }),
    ], "2026-08-17");

    expect(result.openInvoices.map((item) => item.id)).toEqual(["open", "partial"]);
    expect(result.outstandingTotal).toBe(160);
    expect(result.partialCount).toBe(1);
  });

  it("counts only open invoices past their due date as overdue", () => {
    const result = summarizeSupplierBills([
      invoice({ id: "overdue", dueDate: "2026-08-16" }),
      invoice({ id: "today", dueDate: "2026-08-17" }),
      invoice({ id: "future", dueDate: "2026-08-18" }),
      invoice({ id: "without-date", dueDate: undefined }),
    ], "2026-08-17");

    expect(result.overdueCount).toBe(1);
  });
});
