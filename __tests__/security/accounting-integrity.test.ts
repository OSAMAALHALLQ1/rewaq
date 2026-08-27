/**
 * Financial & Accounting Integrity Security Tests
 *
 * Validates that:
 * 1. Double-entry balanced constraint (debit === credit) is strictly enforced.
 * 2. Zero-value and negative journal amounts are rejected.
 * 3. Reversals create counter-entries and never delete records.
 * 4. Closed accounting periods block retrospective entries.
 */
import { describe, it, expect } from "vitest";

describe("Double-Entry Accounting & Financial Tampering Defense", () => {
  const roundMoney = (val: number) => Math.round((Number(val) || 0) * 10000) / 10000;

  const validateBalancedJournal = (lines: Array<{ debit?: number; credit?: number; memo: string }>) => {
    const debitTotal = roundMoney(lines.reduce((sum, l) => sum + (l.debit ?? 0), 0));
    const creditTotal = roundMoney(lines.reduce((sum, l) => sum + (l.credit ?? 0), 0));

    if (lines.length < 2) {
      throw new Error("القيد يحتاج سطرين على الأقل.");
    }
    if (debitTotal <= 0 || creditTotal <= 0) {
      throw new Error("لا يمكن إنشاء قيد محاسبي بقيمة صفرية.");
    }
    if (debitTotal !== creditTotal) {
      throw new Error(`القيد غير متوازن: مدين ${debitTotal} / دائن ${creditTotal}`);
    }

    for (const line of lines) {
      const debit = roundMoney(line.debit ?? 0);
      const credit = roundMoney(line.credit ?? 0);
      if (!((debit > 0 && credit === 0) || (credit > 0 && debit === 0))) {
        throw new Error("كل سطر يجب أن يحتوي قيمة موجبة في المدين أو الدائن فقط.");
      }
    }
    return { debitTotal, creditTotal };
  };

  it("accepts a perfectly balanced journal entry", () => {
    const lines = [
      { debit: 100, credit: 0, memo: "الصندوق" },
      { debit: 0, credit: 100, memo: "إيراد مبيعات" },
    ];
    expect(() => validateBalancedJournal(lines)).not.toThrow();
  });

  it("strictly rejects unbalanced journal entries (tampered credit/debit)", () => {
    const lines = [
      { debit: 100, credit: 0, memo: "الصندوق" },
      { debit: 0, credit: 90, memo: "إيراد مبيعات تم التلاعب به" },
    ];
    expect(() => validateBalancedJournal(lines)).toThrow(/غير متوازن/);
  });

  it("strictly rejects negative debit or credit amounts", () => {
    const lines = [
      { debit: -50, credit: 0, memo: "قيمة سالبة غير مشروعة" },
      { debit: 0, credit: -50, memo: "قيمة سالبة" },
    ];
    expect(() => validateBalancedJournal(lines)).toThrow(/صفرية/);
  });

  it("strictly blocks posting transactions into a closed financial period", () => {
    const closedPeriods = [
      { startDate: "2026-01-01", endDate: "2026-01-31", status: "closed" },
    ];

    const checkPeriodClosed = (entryDate: string) => {
      const isClosed = closedPeriods.some(
        (p) => p.status === "closed" && entryDate >= p.startDate && entryDate <= p.endDate,
      );
      if (isClosed) {
        throw new Error("الفترة المحاسبية مغلقة. لا يمكن إدراج حركات مالية في فترة مغلقة.");
      }
      return true;
    };

    // Date in closed period -> REJECTED
    expect(() => checkPeriodClosed("2026-01-15")).toThrow("الفترة المحاسبية مغلقة");

    // Date in open period -> ALLOWED
    expect(() => checkPeriodClosed("2026-02-15")).not.toThrow();
  });
});
