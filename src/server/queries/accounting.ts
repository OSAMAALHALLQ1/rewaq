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
  { id: "acc-cash", code: "1010", name: "الصندوق", accountType: "asset", normalBalance: "debit", systemKey: "cash_on_hand" },
  { id: "acc-bank", code: "1020", name: "البنك / بطاقات", accountType: "asset", normalBalance: "debit", systemKey: "bank_card" },
  { id: "acc-inventory", code: "1300", name: "المخزون", accountType: "asset", normalBalance: "debit", systemKey: "inventory" },
  { id: "acc-tax", code: "2100", name: "ضريبة مبيعات مستحقة", accountType: "liability", normalBalance: "credit", systemKey: "output_tax_payable" },
  { id: "acc-sales", code: "4100", name: "مبيعات المطعم", accountType: "revenue", normalBalance: "credit", systemKey: "sales_revenue" },
  { id: "acc-cogs", code: "5100", name: "تكلفة البضاعة المباعة", accountType: "cogs", normalBalance: "debit", systemKey: "cogs" },
  { id: "acc-cash-diff", code: "5900", name: "فروقات الصندوق", accountType: "expense", normalBalance: "debit", systemKey: "cash_over_short" },
];

export const demoEntries: LedgerEntry[] = [
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

export type FinancialReportItem = {
  code: string;
  name: string;
  balance: number;
};

export type ProfitAndLossData = {
  revenues: FinancialReportItem[];
  cogs: FinancialReportItem[];
  expenses: FinancialReportItem[];
  revenueTotal: number;
  cogsTotal: number;
  grossProfit: number;
  expenseTotal: number;
  netProfit: number;
};

export type BalanceSheetData = {
  assets: FinancialReportItem[];
  liabilities: FinancialReportItem[];
  equity: FinancialReportItem[];
  assetsTotal: number;
  liabilitiesTotal: number;
  equityTotal: number;
  retainedEarnings: number;
  balanced: boolean;
};

const demoProfitAndLoss: ProfitAndLossData = {
  revenues: [
    { code: "4100", name: "مبيعات المطعم", balance: 12500 },
    { code: "4200", name: "إيرادات توصيل", balance: 1200 },
  ],
  cogs: [
    { code: "5100", name: "تكلفة البضاعة المباعة", balance: 4100 },
  ],
  expenses: [
    { code: "5200", name: "رواتب وأجور", balance: 2500 },
    { code: "5300", name: "إيجار المحل", balance: 1500 },
    { code: "5400", name: "كهرباء ومياه", balance: 450 },
    { code: "5900", name: "فروقات الصندوق", balance: 50 },
  ],
  revenueTotal: 13700,
  cogsTotal: 4100,
  grossProfit: 9600,
  expenseTotal: 4500,
  netProfit: 5100,
};

const demoBalanceSheet: BalanceSheetData = {
  assets: [
    { code: "1010", name: "الصندوق", balance: 5400 },
    { code: "1020", name: "البنك / بطاقات", balance: 3500 },
    { code: "1300", name: "المخزون", balance: 2400 },
  ],
  liabilities: [
    { code: "2100", name: "ضريبة مبيعات مستحقة", balance: 1200 },
    { code: "2200", name: "ذمم الموردين", balance: 1500 },
  ],
  equity: [
    { code: "3100", name: "رأس المال", balance: 3500 },
  ],
  assetsTotal: 11300,
  liabilitiesTotal: 2700,
  equityTotal: 8600,
  retainedEarnings: 5100,
  balanced: true,
};

export async function getProfitAndLossData(): Promise<ProfitAndLossData> {
  if (isDemoMode()) {
    return demoProfitAndLoss;
  }

  return withAdminScope<ProfitAndLossData>(
    demoProfitAndLoss,
    async (admin, scope) => {
      const [accountRows, lineRows] = await Promise.all([
        (admin as any).from("chart_of_accounts").select("id, code, name, account_type").eq("organization_id", scope.organizationId),
        (admin as any).from("journal_lines").select("account_id, debit, credit").eq("organization_id", scope.organizationId),
      ]);

      const accounts = accountRows.data ?? [];
      const lines = lineRows.data ?? [];

      const balancesMap = new Map<string, { debit: number; credit: number }>();
      for (const line of lines) {
        const current = balancesMap.get(line.account_id) ?? { debit: 0, credit: 0 };
        balancesMap.set(line.account_id, {
          debit: current.debit + numberValue(line.debit),
          credit: current.credit + numberValue(line.credit),
        });
      }

      const reportItems = accounts.map((acc: any) => {
        const accum = balancesMap.get(acc.id) ?? { debit: 0, credit: 0 };
        let balance = 0;
        if (acc.account_type === "revenue") {
          balance = accum.credit - accum.debit;
        } else {
          balance = accum.debit - accum.credit; // expense, cogs
        }
        return {
          code: acc.code,
          name: acc.name,
          accountType: acc.account_type,
          balance,
        };
      }).filter((item: any) => item.balance !== 0);

      const revenues = reportItems.filter((i: any) => i.accountType === "revenue").map((i: any) => ({ code: i.code, name: i.name, balance: i.balance }));
      const cogs = reportItems.filter((i: any) => i.accountType === "cogs").map((i: any) => ({ code: i.code, name: i.name, balance: i.balance }));
      const expenses = reportItems.filter((i: any) => i.accountType === "expense").map((i: any) => ({ code: i.code, name: i.name, balance: i.balance }));

      const revenueTotal = revenues.reduce((sum: number, i: any) => sum + i.balance, 0);
      const cogsTotal = cogs.reduce((sum: number, i: any) => sum + i.balance, 0);
      const grossProfit = revenueTotal - cogsTotal;
      const expenseTotal = expenses.reduce((sum: number, i: any) => sum + i.balance, 0);
      const netProfit = grossProfit - expenseTotal;

      return {
        revenues,
        cogs,
        expenses,
        revenueTotal,
        cogsTotal,
        grossProfit,
        expenseTotal,
        netProfit,
      };
    }
  );
}

export async function getBalanceSheetData(): Promise<BalanceSheetData> {
  if (isDemoMode()) {
    return demoBalanceSheet;
  }

  // Use getProfitAndLossData to calculate current period net profit
  const plData = await getProfitAndLossData();
  const retainedEarnings = plData.netProfit;

  return withAdminScope<BalanceSheetData>(
    demoBalanceSheet,
    async (admin, scope) => {
      const [accountRows, lineRows] = await Promise.all([
        (admin as any).from("chart_of_accounts").select("id, code, name, account_type").eq("organization_id", scope.organizationId),
        (admin as any).from("journal_lines").select("account_id, debit, credit").eq("organization_id", scope.organizationId),
      ]);

      const accounts = accountRows.data ?? [];
      const lines = lineRows.data ?? [];

      const balancesMap = new Map<string, { debit: number; credit: number }>();
      for (const line of lines) {
        const current = balancesMap.get(line.account_id) ?? { debit: 0, credit: 0 };
        balancesMap.set(line.account_id, {
          debit: current.debit + numberValue(line.debit),
          credit: current.credit + numberValue(line.credit),
        });
      }

      const reportItems = accounts.map((acc: any) => {
        const accum = balancesMap.get(acc.id) ?? { debit: 0, credit: 0 };
        let balance = 0;
        if (acc.account_type === "asset") {
          balance = accum.debit - accum.credit;
        } else {
          balance = accum.credit - accum.debit; // liability, equity
        }
        return {
          code: acc.code,
          name: acc.name,
          accountType: acc.account_type,
          balance,
        };
      }).filter((item: any) => item.balance !== 0);

      const assets = reportItems.filter((i: any) => i.accountType === "asset").map((i: any) => ({ code: i.code, name: i.name, balance: i.balance }));
      const liabilities = reportItems.filter((i: any) => i.accountType === "liability").map((i: any) => ({ code: i.code, name: i.name, balance: i.balance }));
      const equity = reportItems.filter((i: any) => i.accountType === "equity").map((i: any) => ({ code: i.code, name: i.name, balance: i.balance }));

      const assetsTotal = assets.reduce((sum: number, i: any) => sum + i.balance, 0);
      const liabilitiesTotal = liabilities.reduce((sum: number, i: any) => sum + i.balance, 0);
      const baseEquityTotal = equity.reduce((sum: number, i: any) => sum + i.balance, 0);
      const equityTotal = baseEquityTotal + retainedEarnings;

      const balanced = Math.abs(assetsTotal - (liabilitiesTotal + equityTotal)) < 0.01;

      return {
        assets,
        liabilities,
        equity,
        assetsTotal,
        liabilitiesTotal,
        equityTotal,
        retainedEarnings,
        balanced,
      };
    }
  );
}
