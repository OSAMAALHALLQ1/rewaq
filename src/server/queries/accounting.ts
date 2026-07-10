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
          .eq("status", "posted")
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
  accountId?: string;
  code: string;
  name: string;
  balance: number;
  /** Share of total revenue for the same period (P&L only). */
  pctOfRevenue?: number;
};

export type ProfitAndLossTotals = {
  revenueTotal: number;
  cogsTotal: number;
  grossProfit: number;
  expenseTotal: number;
  netProfit: number;
};

export type ProfitAndLossData = ProfitAndLossTotals & {
  revenues: FinancialReportItem[];
  cogs: FinancialReportItem[];
  expenses: FinancialReportItem[];
  grossMarginPct: number;
  netMarginPct: number;
  from: string;
  to: string;
  /** Same-length period immediately before [from, to] for comparison. */
  previous: (ProfitAndLossTotals & { from: string; to: string }) | null;
};

export type BalanceSheetSection = {
  items: FinancialReportItem[];
  total: number;
};

export type BalanceSheetData = {
  asOf: string;
  currentAssets: BalanceSheetSection;
  nonCurrentAssets: BalanceSheetSection;
  currentLiabilities: BalanceSheetSection;
  nonCurrentLiabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  assetsTotal: number;
  liabilitiesTotal: number;
  equityTotal: number;
  /** Cumulative net income up to asOf that is not yet moved to an equity account by a year-end closing entry. */
  retainedEarnings: number;
  balanced: boolean;
  /** Same structure totals at a previous date for comparison (optional). */
  previous: { asOf: string; assetsTotal: number; liabilitiesTotal: number; equityTotal: number } | null;
};

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function monthStartOf(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Previous period of the same length; snaps to the previous calendar month when [from,to] is a calendar month. */
function previousPeriodOf(from: string, to: string): { from: string; to: string } {
  const isMonthStart = from.endsWith("-01");
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  if (isMonthStart && sameMonth) {
    const prevEnd = shiftDate(from, -1);
    return { from: monthStartOf(prevEnd), to: prevEnd };
  }
  const lengthDays = Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000) + 1;
  const prevTo = shiftDate(from, -1);
  return { from: shiftDate(prevTo, -(lengthDays - 1)), to: prevTo };
}

type TypedBalance = {
  accountId: string;
  code: string;
  name: string;
  accountType: string;
  debit: number;
  credit: number;
};

/**
 * Loads per-account debit/credit totals for POSTED entries in [from, to],
 * excluding year-end closing entries so income accounts are not double
 * counted against retained earnings.
 */
async function loadTypedBalances(
  admin: any,
  organizationId: string,
  filter: { from?: string; to?: string },
): Promise<TypedBalance[]> {
  let linesQuery = (admin as any)
    .from("journal_lines")
    .select("account_id, debit, credit, journal_entries!inner(status, entry_date, source_doc_type)")
    .eq("organization_id", organizationId)
    .eq("journal_entries.status", "posted");

  if (filter.from) linesQuery = linesQuery.gte("journal_entries.entry_date", filter.from);
  if (filter.to) linesQuery = linesQuery.lte("journal_entries.entry_date", filter.to);

  const [accountRows, lineRows] = await Promise.all([
    (admin as any)
      .from("chart_of_accounts")
      .select("id, code, name, account_type")
      .eq("organization_id", organizationId)
      .order("code"),
    linesQuery,
  ]);

  if (accountRows.error) throw new Error(accountRows.error.message);
  if (lineRows.error) throw new Error(lineRows.error.message);

  const totals = new Map<string, { debit: number; credit: number }>();
  for (const line of lineRows.data ?? []) {
    if (line.journal_entries?.source_doc_type === "year_end_closing") continue;
    const current = totals.get(line.account_id) ?? { debit: 0, credit: 0 };
    totals.set(line.account_id, {
      debit: current.debit + numberValue(line.debit),
      credit: current.credit + numberValue(line.credit),
    });
  }

  return (accountRows.data ?? []).map((acc: any) => {
    const accum = totals.get(acc.id) ?? { debit: 0, credit: 0 };
    return {
      accountId: acc.id,
      code: acc.code,
      name: acc.name,
      accountType: acc.account_type,
      debit: accum.debit,
      credit: accum.credit,
    };
  });
}

function plTotalsFromBalances(balances: TypedBalance[]): ProfitAndLossTotals & {
  revenues: FinancialReportItem[];
  cogs: FinancialReportItem[];
  expenses: FinancialReportItem[];
} {
  const items = balances
    .filter((b) => ["revenue", "cogs", "expense"].includes(b.accountType))
    .map((b) => ({
      accountId: b.accountId,
      code: b.code,
      name: b.name,
      accountType: b.accountType,
      balance: b.accountType === "revenue" ? b.credit - b.debit : b.debit - b.credit,
    }))
    .filter((item) => item.balance !== 0);

  const pick = (type: string) =>
    items.filter((i) => i.accountType === type).map(({ accountId, code, name, balance }) => ({ accountId, code, name, balance }));

  const revenues = pick("revenue");
  const cogs = pick("cogs");
  const expenses = pick("expense");
  const revenueTotal = revenues.reduce((s, i) => s + i.balance, 0);
  const cogsTotal = cogs.reduce((s, i) => s + i.balance, 0);
  const expenseTotal = expenses.reduce((s, i) => s + i.balance, 0);

  return {
    revenues,
    cogs,
    expenses,
    revenueTotal,
    cogsTotal,
    grossProfit: revenueTotal - cogsTotal,
    expenseTotal,
    netProfit: revenueTotal - cogsTotal - expenseTotal,
  };
}

const demoProfitAndLoss: ProfitAndLossData = {
  revenues: [
    { code: "4100", name: "مبيعات المطعم", balance: 12500, pctOfRevenue: 91.2 },
    { code: "4200", name: "إيرادات توصيل", balance: 1200, pctOfRevenue: 8.8 },
  ],
  cogs: [
    { code: "5100", name: "تكلفة البضاعة المباعة", balance: 4100, pctOfRevenue: 29.9 },
  ],
  expenses: [
    { code: "5200", name: "رواتب وأجور", balance: 2500, pctOfRevenue: 18.2 },
    { code: "5300", name: "إيجار المحل", balance: 1500, pctOfRevenue: 10.9 },
    { code: "5400", name: "كهرباء ومياه", balance: 450, pctOfRevenue: 3.3 },
    { code: "5900", name: "فروقات الصندوق", balance: 50, pctOfRevenue: 0.4 },
  ],
  revenueTotal: 13700,
  cogsTotal: 4100,
  grossProfit: 9600,
  grossMarginPct: 70.1,
  expenseTotal: 4500,
  netProfit: 5100,
  netMarginPct: 37.2,
  from: "2026-07-01",
  to: "2026-07-10",
  previous: { revenueTotal: 12100, cogsTotal: 3900, grossProfit: 8200, expenseTotal: 4300, netProfit: 3900, from: "2026-06-01", to: "2026-06-30" },
};

const demoBalanceSheet: BalanceSheetData = {
  asOf: "2026-07-10",
  currentAssets: {
    items: [
      { code: "1010", name: "الصندوق", balance: 5400 },
      { code: "1020", name: "البنك / بطاقات", balance: 3500 },
      { code: "1300", name: "المخزون", balance: 2400 },
    ],
    total: 11300,
  },
  nonCurrentAssets: { items: [], total: 0 },
  currentLiabilities: {
    items: [
      { code: "2100", name: "ضريبة مبيعات مستحقة", balance: 1200 },
      { code: "2200", name: "ذمم الموردين", balance: 1500 },
    ],
    total: 2700,
  },
  nonCurrentLiabilities: { items: [], total: 0 },
  equity: {
    items: [{ code: "3100", name: "رأس المال", balance: 3500 }],
    total: 8600,
  },
  assetsTotal: 11300,
  liabilitiesTotal: 2700,
  equityTotal: 8600,
  retainedEarnings: 5100,
  balanced: true,
  previous: null,
};

export async function getProfitAndLossData(filter?: { from?: string; to?: string }): Promise<ProfitAndLossData> {
  if (isDemoMode()) {
    return demoProfitAndLoss;
  }

  const to = filter?.to || localToday();
  const from = filter?.from || monthStartOf(to);
  const prev = previousPeriodOf(from, to);

  return withAdminScope<ProfitAndLossData>(
    demoProfitAndLoss,
    async (admin, scope) => {
      const [periodBalances, previousBalances] = await Promise.all([
        loadTypedBalances(admin, scope.organizationId, { from, to }),
        loadTypedBalances(admin, scope.organizationId, { from: prev.from, to: prev.to }),
      ]);

      const current = plTotalsFromBalances(periodBalances);
      const previous = plTotalsFromBalances(previousBalances);

      const withPct = (items: FinancialReportItem[]) =>
        items.map((item) => ({
          ...item,
          pctOfRevenue: current.revenueTotal > 0 ? Math.round((item.balance / current.revenueTotal) * 1000) / 10 : undefined,
        }));

      return {
        revenues: withPct(current.revenues),
        cogs: withPct(current.cogs),
        expenses: withPct(current.expenses),
        revenueTotal: current.revenueTotal,
        cogsTotal: current.cogsTotal,
        grossProfit: current.grossProfit,
        grossMarginPct: current.revenueTotal > 0 ? Math.round((current.grossProfit / current.revenueTotal) * 1000) / 10 : 0,
        expenseTotal: current.expenseTotal,
        netProfit: current.netProfit,
        netMarginPct: current.revenueTotal > 0 ? Math.round((current.netProfit / current.revenueTotal) * 1000) / 10 : 0,
        from,
        to,
        previous: {
          revenueTotal: previous.revenueTotal,
          cogsTotal: previous.cogsTotal,
          grossProfit: previous.grossProfit,
          expenseTotal: previous.expenseTotal,
          netProfit: previous.netProfit,
          from: prev.from,
          to: prev.to,
        },
      };
    },
  );
}

/** Current vs non-current split by account code convention: assets ≥1500 and liabilities ≥2500 are long-term. */
function isNonCurrent(accountType: string, code: string): boolean {
  const numeric = Number.parseInt(code, 10);
  if (Number.isNaN(numeric)) return false;
  if (accountType === "asset") return numeric >= 1500 && numeric < 2000;
  if (accountType === "liability") return numeric >= 2500 && numeric < 3000;
  return false;
}

export async function getBalanceSheetData(params?: { asOf?: string; compareTo?: string }): Promise<BalanceSheetData> {
  if (isDemoMode()) {
    return demoBalanceSheet;
  }

  const asOf = params?.asOf || localToday();
  // Default comparison: end of the previous month relative to asOf.
  const compareTo = params?.compareTo || shiftDate(monthStartOf(asOf), -1);

  return withAdminScope<BalanceSheetData>(
    demoBalanceSheet,
    async (admin, scope) => {
      const buildSnapshot = (balances: TypedBalance[]) => {
        const items = balances
          .map((b) => ({
            accountId: b.accountId,
            code: b.code,
            name: b.name,
            accountType: b.accountType,
            balance: b.accountType === "asset" ? b.debit - b.credit : b.credit - b.debit,
          }))
          .filter((item) => ["asset", "liability", "equity"].includes(item.accountType) && item.balance !== 0);

        // Net income up to asOf that has not been moved into equity by a
        // year-end closing entry (closing entries are excluded from balances,
        // so income accounts keep their history and equity keeps the transfer).
        const retainedEarnings = balances.reduce((sum, b) => {
          if (b.accountType === "revenue") return sum + (b.credit - b.debit);
          if (b.accountType === "cogs" || b.accountType === "expense") return sum - (b.debit - b.credit);
          return sum;
        }, 0);

        const section = (predicate: (i: (typeof items)[number]) => boolean): BalanceSheetSection => {
          const sectionItems = items
            .filter(predicate)
            .map(({ accountId, code, name, balance }) => ({ accountId, code, name, balance }));
          return { items: sectionItems, total: sectionItems.reduce((s, i) => s + i.balance, 0) };
        };

        const currentAssets = section((i) => i.accountType === "asset" && !isNonCurrent("asset", i.code));
        const nonCurrentAssets = section((i) => i.accountType === "asset" && isNonCurrent("asset", i.code));
        const currentLiabilities = section((i) => i.accountType === "liability" && !isNonCurrent("liability", i.code));
        const nonCurrentLiabilities = section((i) => i.accountType === "liability" && isNonCurrent("liability", i.code));
        const equity = section((i) => i.accountType === "equity");

        const assetsTotal = currentAssets.total + nonCurrentAssets.total;
        const liabilitiesTotal = currentLiabilities.total + nonCurrentLiabilities.total;
        const equityTotal = equity.total + retainedEarnings;

        return { currentAssets, nonCurrentAssets, currentLiabilities, nonCurrentLiabilities, equity, assetsTotal, liabilitiesTotal, equityTotal, retainedEarnings };
      };

      // Year-end closing entries are excluded on BOTH sides inside
      // loadTypedBalances: income accounts keep their full history and the
      // computed retained earnings figure carries all of it exactly once —
      // adding a closing entry later can never double count equity.
      const [nowBalances, prevBalances] = await Promise.all([
        loadTypedBalances(admin, scope.organizationId, { to: asOf }),
        compareTo < asOf ? loadTypedBalances(admin, scope.organizationId, { to: compareTo }) : Promise.resolve(null),
      ]);

      const snapshot = buildSnapshot(nowBalances);
      const previousSnapshot = prevBalances ? buildSnapshot(prevBalances) : null;

      return {
        asOf,
        ...snapshot,
        balanced: Math.abs(snapshot.assetsTotal - (snapshot.liabilitiesTotal + snapshot.equityTotal)) < 0.01,
        previous: previousSnapshot
          ? { asOf: compareTo, assetsTotal: previousSnapshot.assetsTotal, liabilitiesTotal: previousSnapshot.liabilitiesTotal, equityTotal: previousSnapshot.equityTotal }
          : null,
      };
    },
  );
}
