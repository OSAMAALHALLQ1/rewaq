/**
 * Accounting queries: chart of accounts and journal ledger
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { isDemoMode, withAdminScope, numberValue } from "./_shared/utils";

export type LedgerAccount = {
  id: string;
  code: string;
  name: string;
  accountType: string;
  normalBalance: "debit" | "credit";
  systemKey?: string;
};

export type LedgerEntryLine = {
  id: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo?: string;
};

export type LedgerEntry = {
  id: string;
  entryNumber: string;
  entryDate: string;
  sourceDocType?: string;
  sourceDocId?: string;
  memo?: string;
  debitTotal: number;
  creditTotal: number;
  lines: LedgerEntryLine[];
};

export type AccountingLedgerData = {
  accounts: LedgerAccount[];
  entries: LedgerEntry[];
};

const demoAccounts: LedgerAccount[] = [
  { id: "acc-cash", code: "1010", name: "الصندوق", accountType: "asset", normalBalance: "debit", systemKey: "cash" },
  { id: "acc-bank", code: "1020", name: "البنك / بطاقات", accountType: "asset", normalBalance: "debit", systemKey: "bank" },
  { id: "acc-inventory", code: "1300", name: "المخزون", accountType: "asset", normalBalance: "debit", systemKey: "inventory" },
  { id: "acc-tax", code: "2100", name: "ضريبة مبيعات مستحقة", accountType: "liability", normalBalance: "credit", systemKey: "sales_tax_payable" },
  { id: "acc-sales", code: "4100", name: "مبيعات المطعم", accountType: "revenue", normalBalance: "credit", systemKey: "sales_revenue" },
  { id: "acc-cogs", code: "5100", name: "تكلفة البضاعة المباعة", accountType: "cogs", normalBalance: "debit", systemKey: "cogs" },
  { id: "acc-cash-diff", code: "5900", name: "فروقات الصندوق", accountType: "expense", normalBalance: "debit", systemKey: "cash_over_short" },
];

const demoEntries: LedgerEntry[] = [
  {
    id: "je-demo-1",
    entryNumber: "JE-20260624-0001",
    entryDate: "2026-06-24",
    sourceDocType: "customer_invoice",
    memo: "قيد تلقائي لفاتورة كاشير تجريبية",
    debitTotal: 116,
    creditTotal: 116,
    lines: [
      { id: "line-1", accountCode: "1010", accountName: "الصندوق", debit: 116, credit: 0, memo: "تحصيل نقدي" },
      { id: "line-2", accountCode: "4100", accountName: "مبيعات المطعم", debit: 0, credit: 100, memo: "مبيعات" },
      { id: "line-3", accountCode: "2100", accountName: "ضريبة مبيعات مستحقة", debit: 0, credit: 16, memo: "ضريبة" },
    ],
  },
];

export async function getAccountingLedgerData(): Promise<AccountingLedgerData> {
  if (isDemoMode()) {
    return { accounts: demoAccounts, entries: demoEntries };
  }

  return withAdminScope<AccountingLedgerData>(
    { accounts: demoAccounts, entries: demoEntries },
    async (admin, scope) => {
      await (admin as any).rpc("ensure_default_chart_accounts", { target_org_id: scope.organizationId });

      const [accountResult, entryResult] = await Promise.all([
        (admin as any)
          .from("chart_of_accounts")
          .select("id, code, name, account_type, normal_balance, system_key")
          .eq("organization_id", scope.organizationId)
          .eq("is_active", true)
          .order("code"),
        (admin as any)
          .from("journal_entries")
          .select("id, entry_number, entry_date, source_doc_type, source_doc_id, memo, journal_lines(id, debit, credit, memo, chart_of_accounts(code, name))")
          .eq("organization_id", scope.organizationId)
          .order("entry_date", { ascending: false })
          .limit(50),
      ]);

      if (accountResult.error) throw new Error(accountResult.error.message);
      if (entryResult.error) throw new Error(entryResult.error.message);

      const accounts: LedgerAccount[] = (accountResult.data ?? []).map((account: any) => ({
        id: account.id,
        code: account.code,
        name: account.name,
        accountType: account.account_type,
        normalBalance: account.normal_balance === "credit" ? "credit" : "debit",
        systemKey: account.system_key ?? undefined,
      }));

      const entries: LedgerEntry[] = (entryResult.data ?? []).map((entry: any) => {
        const lines = (entry.journal_lines ?? []).map((line: any) => ({
          id: line.id,
          accountCode: line.chart_of_accounts?.code ?? "",
          accountName: line.chart_of_accounts?.name ?? "حساب غير معروف",
          debit: numberValue(line.debit),
          credit: numberValue(line.credit),
          memo: line.memo ?? undefined,
        }));

        return {
          id: entry.id,
          entryNumber: entry.entry_number,
          entryDate: entry.entry_date,
          sourceDocType: entry.source_doc_type ?? undefined,
          sourceDocId: entry.source_doc_id ?? undefined,
          memo: entry.memo ?? undefined,
          debitTotal: lines.reduce((sum: number, line: LedgerEntryLine) => sum + line.debit, 0),
          creditTotal: lines.reduce((sum: number, line: LedgerEntryLine) => sum + line.credit, 0),
          lines,
        };
      });

      return { accounts, entries };
    },
  );
}
