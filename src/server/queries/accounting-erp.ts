/**
 * ERP accounting queries: accounting dashboard, chart of accounts, trial balance,
 * general ledger, cost centers, expenses, accounting periods, and settings.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { isDemoMode, withAdminScope, numberValue, type AdminClient } from "./_shared/utils";

// ============================================================================
// Shared balance loading
// ============================================================================

export type AccountWithBalance = {
  id: string;
  code: string;
  name: string;
  accountType: string;
  normalBalance: "debit" | "credit";
  systemKey?: string;
  parentId?: string;
  isActive: boolean;
  debitTotal: number;
  creditTotal: number;
  /** Signed balance by the account's normal direction (positive = normal side). */
  balance: number;
};

type BalanceFilter = { from?: string; to?: string };

async function loadAccountsWithBalances(
  admin: AdminClient,
  organizationId: string,
  filter?: BalanceFilter,
): Promise<AccountWithBalance[]> {
  await (admin as any).rpc("ensure_default_chart_accounts", { target_org_id: organizationId });

  let linesQuery = (admin as any)
    .from("journal_lines")
    .select("account_id, debit, credit, journal_entries!inner(entry_date, status)")
    .eq("organization_id", organizationId)
    .eq("journal_entries.status", "posted");

  if (filter?.from) linesQuery = linesQuery.gte("journal_entries.entry_date", filter.from);
  if (filter?.to) linesQuery = linesQuery.lte("journal_entries.entry_date", filter.to);

  const [accountResult, lineResult] = await Promise.all([
    (admin as any)
      .from("chart_of_accounts")
      .select("id, code, name, account_type, normal_balance, system_key, parent_id, is_active")
      .eq("organization_id", organizationId)
      .order("code"),
    linesQuery,
  ]);

  if (accountResult.error) throw new Error(accountResult.error.message);
  if (lineResult.error) throw new Error(lineResult.error.message);

  const totals = new Map<string, { debit: number; credit: number }>();
  for (const line of lineResult.data ?? []) {
    const current = totals.get(line.account_id) ?? { debit: 0, credit: 0 };
    totals.set(line.account_id, {
      debit: current.debit + numberValue(line.debit),
      credit: current.credit + numberValue(line.credit),
    });
  }

  return (accountResult.data ?? []).map((account: any) => {
    const accum = totals.get(account.id) ?? { debit: 0, credit: 0 };
    const normalBalance: "debit" | "credit" = account.normal_balance === "credit" ? "credit" : "debit";
    const balance = normalBalance === "debit" ? accum.debit - accum.credit : accum.credit - accum.debit;

    return {
      id: account.id,
      code: account.code,
      name: account.name,
      accountType: account.account_type,
      normalBalance,
      systemKey: account.system_key ?? undefined,
      parentId: account.parent_id ?? undefined,
      isActive: Boolean(account.is_active),
      debitTotal: accum.debit,
      creditTotal: accum.credit,
      balance,
    };
  });
}

function systemBalance(accounts: AccountWithBalance[], systemKey: string): number {
  return accounts.find((account) => account.systemKey === systemKey)?.balance ?? 0;
}

function sumByType(accounts: AccountWithBalance[], accountType: string): number {
  return accounts
    .filter((account) => account.accountType === accountType)
    .reduce((sum, account) => sum + account.balance, 0);
}

// ============================================================================
// 1) Accounting dashboard
// ============================================================================

export type AccountingDashboardData = {
  todaySales: number;
  monthSales: number;
  monthExpenses: number;
  monthCogs: number;
  monthNetProfit: number;
  cashBalance: number;
  bankBalance: number;
  supplierPayable: number;
  customerReceivable: number;
  inventoryValue: number;
  monthRefunds: number;
  openShifts: number;
  draftEntries: number;
  unpaidSupplierInvoicesTotal: number;
  unpaidSupplierInvoices: Array<{
    id: string;
    invoiceNumber: string;
    supplierName: string;
    total: number;
    issuedAt: string;
    status: string;
  }>;
  recentEntries: Array<{
    id: string;
    entryNumber: string;
    entryDate: string;
    memo?: string;
    total: number;
    status: string;
  }>;
};

const demoAccountingDashboard: AccountingDashboardData = {
  todaySales: 1450,
  monthSales: 23800,
  monthExpenses: 5200,
  monthCogs: 8100,
  monthNetProfit: 10500,
  cashBalance: 6400,
  bankBalance: 4300,
  supplierPayable: 2750,
  customerReceivable: 0,
  inventoryValue: 5100,
  monthRefunds: 180,
  openShifts: 1,
  draftEntries: 0,
  unpaidSupplierInvoicesTotal: 2750,
  unpaidSupplierInvoices: [
    { id: "inv-demo-1", invoiceNumber: "SUP-2026-0031", supplierName: "شركة الخليج للمواد الغذائية", total: 1850, issuedAt: "2026-07-01", status: "matched" },
    { id: "inv-demo-2", invoiceNumber: "SUP-2026-0034", supplierName: "مزارع البركة", total: 900, issuedAt: "2026-07-04", status: "draft" },
  ],
  recentEntries: [
    { id: "je-demo-1", entryNumber: "JE-20260705-0003", entryDate: "2026-07-05", memo: "قيد تلقائي لفاتورة كاشير", total: 245, status: "posted" },
    { id: "je-demo-2", entryNumber: "JE-20260705-0002", entryDate: "2026-07-05", memo: "قيد مصروف: كهرباء", total: 320, status: "posted" },
  ],
};

export async function getAccountingDashboardData(): Promise<AccountingDashboardData> {
  if (isDemoMode()) return demoAccountingDashboard;

  return withAdminScope<AccountingDashboardData>(demoAccountingDashboard, async (admin, scope) => {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 7)}-01`;

    const [allAccounts, monthAccounts] = await Promise.all([
      loadAccountsWithBalances(admin, scope.organizationId),
      loadAccountsWithBalances(admin, scope.organizationId, { from: monthStart, to: today }),
    ]);

    const [todayInvoices, monthInvoices, openShiftsResult, draftEntriesResult, unpaidInvoicesResult, recentEntriesResult] = await Promise.all([
      (admin as any)
        .from("customer_invoices")
        .select("total")
        .eq("organization_id", scope.organizationId)
        .eq("status", "paid")
        .gte("issued_at", `${today}T00:00:00.000Z`),
      (admin as any)
        .from("customer_invoices")
        .select("total")
        .eq("organization_id", scope.organizationId)
        .eq("status", "paid")
        .gte("issued_at", `${monthStart}T00:00:00.000Z`),
      (admin as any)
        .from("sales_shifts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", scope.organizationId)
        .eq("status", "open"),
      (admin as any)
        .from("journal_entries")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", scope.organizationId)
        .eq("status", "draft"),
      (admin as any)
        .from("invoices")
        .select("id, invoice_number, total, issued_at, status, suppliers(name)")
        .eq("organization_id", scope.organizationId)
        .in("status", ["draft", "matched", "posted", "partially_paid"])
        .order("issued_at", { ascending: false })
        .limit(6),
      (admin as any)
        .from("journal_entries")
        .select("id, entry_number, entry_date, memo, status, journal_lines(debit)")
        .eq("organization_id", scope.organizationId)
        .eq("status", "posted")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

    if (todayInvoices.error) throw new Error(todayInvoices.error.message);
    if (monthInvoices.error) throw new Error(monthInvoices.error.message);
    if (openShiftsResult.error) throw new Error(openShiftsResult.error.message);
    if (draftEntriesResult.error) throw new Error(draftEntriesResult.error.message);
    if (unpaidInvoicesResult.error) throw new Error(unpaidInvoicesResult.error.message);
    if (recentEntriesResult.error) throw new Error(recentEntriesResult.error.message);

    const sumTotals = (rows: Array<{ total: number | string | null }> | null) =>
      (rows ?? []).reduce((sum, row) => sum + numberValue(row.total), 0);

    const monthRevenue = monthAccounts
      .filter((account) => account.accountType === "revenue")
      .reduce((sum, account) => sum + (account.normalBalance === "credit" ? account.balance : -account.balance), 0);
    const monthCogs = sumByType(monthAccounts, "cogs");
    const monthExpenses = sumByType(monthAccounts, "expense");

    const unpaidSupplierInvoices = (unpaidInvoicesResult.data ?? []).map((invoice: any) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoice_number ?? "بدون رقم",
      supplierName: invoice.suppliers?.name ?? "مورد غير معروف",
      total: numberValue(invoice.total),
      issuedAt: invoice.issued_at ?? "",
      status: invoice.status ?? "draft",
    }));

    return {
      todaySales: sumTotals(todayInvoices.data),
      monthSales: sumTotals(monthInvoices.data),
      monthExpenses,
      monthCogs,
      monthNetProfit: monthRevenue - monthCogs - monthExpenses,
      cashBalance: systemBalance(allAccounts, "cash_on_hand"),
      bankBalance: systemBalance(allAccounts, "bank_card"),
      supplierPayable: systemBalance(allAccounts, "accounts_payable"),
      customerReceivable: systemBalance(allAccounts, "accounts_receivable"),
      inventoryValue: systemBalance(allAccounts, "inventory"),
      monthRefunds: monthAccounts.find((account) => account.systemKey === "sales_returns")?.balance ?? 0,
      openShifts: openShiftsResult.count ?? 0,
      draftEntries: draftEntriesResult.count ?? 0,
      unpaidSupplierInvoicesTotal: unpaidSupplierInvoices.reduce((sum: number, invoice: any) => sum + invoice.total, 0),
      unpaidSupplierInvoices,
      recentEntries: (recentEntriesResult.data ?? []).map((entry: any) => ({
        id: entry.id,
        entryNumber: entry.entry_number,
        entryDate: entry.entry_date,
        memo: entry.memo ?? undefined,
        total: (entry.journal_lines ?? []).reduce((sum: number, line: any) => sum + numberValue(line.debit), 0),
        status: entry.status ?? "posted",
      })),
    };
  });
}

// ============================================================================
// 2) Chart of accounts
// ============================================================================

export type ChartOfAccountsData = {
  accounts: AccountWithBalance[];
};

const demoChartAccounts: AccountWithBalance[] = [
  { id: "acc-cash", code: "1010", name: "الصندوق", accountType: "asset", normalBalance: "debit", systemKey: "cash_on_hand", isActive: true, debitTotal: 8200, creditTotal: 1800, balance: 6400 },
  { id: "acc-bank", code: "1020", name: "البنك / بطاقات", accountType: "asset", normalBalance: "debit", systemKey: "bank_card", isActive: true, debitTotal: 4300, creditTotal: 0, balance: 4300 },
  { id: "acc-inventory", code: "1300", name: "المخزون", accountType: "asset", normalBalance: "debit", systemKey: "inventory", isActive: true, debitTotal: 9100, creditTotal: 4000, balance: 5100 },
  { id: "acc-ap", code: "2200", name: "ذمم الموردين", accountType: "liability", normalBalance: "credit", systemKey: "accounts_payable", isActive: true, debitTotal: 0, creditTotal: 2750, balance: 2750 },
  { id: "acc-sales", code: "4100", name: "مبيعات المطعم", accountType: "revenue", normalBalance: "credit", systemKey: "sales_revenue", isActive: true, debitTotal: 0, creditTotal: 23800, balance: 23800 },
  { id: "acc-cogs", code: "5100", name: "تكلفة البضاعة المباعة", accountType: "cogs", normalBalance: "debit", systemKey: "cogs", isActive: true, debitTotal: 8100, creditTotal: 0, balance: 8100 },
];

export async function getChartOfAccountsData(): Promise<ChartOfAccountsData> {
  if (isDemoMode()) return { accounts: demoChartAccounts };

  return withAdminScope<ChartOfAccountsData>({ accounts: demoChartAccounts }, async (admin, scope) => ({
    accounts: await loadAccountsWithBalances(admin, scope.organizationId),
  }));
}

// ============================================================================
// 3) Trial balance (ميزان المراجعة)
// ============================================================================

export type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  accountType: string;
  /** Opening balance before the period start (signed into debit/credit columns). */
  openingDebit: number;
  openingCredit: number;
  /** Movement inside the period (gross totals). */
  periodDebit: number;
  periodCredit: number;
  /** Closing balance = opening + period movement. */
  closingDebit: number;
  closingCredit: number;
};

export type TrialBalanceData = {
  rows: TrialBalanceRow[];
  totals: {
    openingDebit: number;
    openingCredit: number;
    periodDebit: number;
    periodCredit: number;
    closingDebit: number;
    closingCredit: number;
  };
  balanced: boolean;
  from?: string;
  to?: string;
};

const demoTrialBalance: TrialBalanceData = {
  rows: [
    { accountId: "acc-cash", code: "1010", name: "الصندوق", accountType: "asset", openingDebit: 2000, openingCredit: 0, periodDebit: 6200, periodCredit: 1800, closingDebit: 6400, closingCredit: 0 },
    { accountId: "acc-bank", code: "1020", name: "البنك / بطاقات", accountType: "asset", openingDebit: 1000, openingCredit: 0, periodDebit: 3300, periodCredit: 0, closingDebit: 4300, closingCredit: 0 },
    { accountId: "acc-inventory", code: "1300", name: "المخزون", accountType: "asset", openingDebit: 3000, openingCredit: 0, periodDebit: 6100, periodCredit: 4000, closingDebit: 5100, closingCredit: 0 },
    { accountId: "acc-ap", code: "2200", name: "ذمم الموردين", accountType: "liability", openingDebit: 0, openingCredit: 1000, periodDebit: 0, periodCredit: 1750, closingDebit: 0, closingCredit: 2750 },
    { accountId: "acc-sales", code: "4100", name: "مبيعات المطعم", accountType: "revenue", openingDebit: 0, openingCredit: 5000, periodDebit: 0, periodCredit: 18800, closingDebit: 0, closingCredit: 23800 },
    { accountId: "acc-cogs", code: "5100", name: "تكلفة البضاعة المباعة", accountType: "cogs", openingDebit: 0, openingCredit: 0, periodDebit: 8100, periodCredit: 0, closingDebit: 8100, closingCredit: 0 },
  ],
  totals: { openingDebit: 6000, openingCredit: 6000, periodDebit: 23700, periodCredit: 26350, closingDebit: 23900, closingCredit: 26550 },
  balanced: true,
};

export async function getTrialBalanceData(filter?: BalanceFilter): Promise<TrialBalanceData> {
  if (isDemoMode()) return demoTrialBalance;

  return withAdminScope<TrialBalanceData>(demoTrialBalance, async (admin, scope) => {
    // Opening balances = everything strictly before the period start.
    const dayBeforeFrom = filter?.from
      ? (() => {
          const d = new Date(`${filter.from}T00:00:00`);
          d.setDate(d.getDate() - 1);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        })()
      : undefined;

    const [periodAccounts, openingAccounts] = await Promise.all([
      loadAccountsWithBalances(admin, scope.organizationId, filter),
      dayBeforeFrom
        ? loadAccountsWithBalances(admin, scope.organizationId, { to: dayBeforeFrom })
        : Promise.resolve(null),
    ]);

    const openingByAccount = new Map<string, { debit: number; credit: number }>();
    for (const account of openingAccounts ?? []) {
      openingByAccount.set(account.id, { debit: account.debitTotal, credit: account.creditTotal });
    }

    const rows: TrialBalanceRow[] = periodAccounts
      .map((account) => {
        const opening = openingByAccount.get(account.id) ?? { debit: 0, credit: 0 };
        const openingNet = opening.debit - opening.credit;
        const closingNet = openingNet + account.debitTotal - account.creditTotal;

        return {
          accountId: account.id,
          code: account.code,
          name: account.name,
          accountType: account.accountType,
          openingDebit: openingNet > 0 ? openingNet : 0,
          openingCredit: openingNet < 0 ? -openingNet : 0,
          periodDebit: account.debitTotal,
          periodCredit: account.creditTotal,
          closingDebit: closingNet > 0 ? closingNet : 0,
          closingCredit: closingNet < 0 ? -closingNet : 0,
        };
      })
      .filter(
        (row) =>
          row.openingDebit !== 0 ||
          row.openingCredit !== 0 ||
          row.periodDebit !== 0 ||
          row.periodCredit !== 0,
      );

    const totals = rows.reduce(
      (acc, row) => ({
        openingDebit: acc.openingDebit + row.openingDebit,
        openingCredit: acc.openingCredit + row.openingCredit,
        periodDebit: acc.periodDebit + row.periodDebit,
        periodCredit: acc.periodCredit + row.periodCredit,
        closingDebit: acc.closingDebit + row.closingDebit,
        closingCredit: acc.closingCredit + row.closingCredit,
      }),
      { openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0, closingDebit: 0, closingCredit: 0 },
    );

    return {
      rows,
      totals,
      balanced:
        Math.abs(totals.periodDebit - totals.periodCredit) < 0.01 &&
        Math.abs(totals.closingDebit - totals.closingCredit) < 0.01,
      from: filter?.from,
      to: filter?.to,
    };
  });
}

// ============================================================================
// 4) General ledger / account statement (دفتر الأستاذ)
// ============================================================================

export type GeneralLedgerLine = {
  id: string;
  journalEntryId: string;
  entryDate: string;
  entryNumber: string;
  memo?: string;
  sourceDocType?: string;
  branchName?: string;
  costCenterName?: string;
  debit: number;
  credit: number;
  runningBalance: number;
};

export type GeneralLedgerFilter = {
  accountId?: string;
  from?: string;
  to?: string;
};

export type GeneralLedgerData = {
  accounts: Array<{ id: string; code: string; name: string; accountType: string }>;
  selectedAccount?: { id: string; code: string; name: string; accountType: string; normalBalance: "debit" | "credit" };
  /** Balance carried from before the period start (0 when no from-date). */
  openingBalance: number;
  lines: GeneralLedgerLine[];
  periodDebit: number;
  periodCredit: number;
  closingBalance: number;
  from?: string;
  to?: string;
  /** True when the row limit was hit and the list may be incomplete. */
  truncated: boolean;
};

const demoGeneralLedger: GeneralLedgerData = {
  accounts: demoChartAccounts.map((account) => ({ id: account.id, code: account.code, name: account.name, accountType: account.accountType })),
  selectedAccount: { id: "acc-cash", code: "1010", name: "الصندوق", accountType: "asset", normalBalance: "debit" },
  openingBalance: 0,
  lines: [
    { id: "gl-1", journalEntryId: "je-demo-1", entryDate: "2026-07-01", entryNumber: "JE-20260701-0001", memo: "تحصيل فاتورة INV-1001", sourceDocType: "customer_invoice", debit: 350, credit: 0, runningBalance: 350 },
    { id: "gl-2", journalEntryId: "je-demo-2", entryDate: "2026-07-02", entryNumber: "JE-20260702-0002", memo: "سداد مصروف كهرباء", sourceDocType: "expense", debit: 0, credit: 320, runningBalance: 30 },
  ],
  periodDebit: 350,
  periodCredit: 320,
  closingBalance: 30,
  truncated: false,
};

const GL_LINE_LIMIT = 1000;

export async function getGeneralLedgerData(filter?: GeneralLedgerFilter): Promise<GeneralLedgerData> {
  if (isDemoMode()) return demoGeneralLedger;

  return withAdminScope<GeneralLedgerData>(demoGeneralLedger, async (admin, scope) => {
    const accounts = await loadAccountsWithBalances(admin, scope.organizationId);
    const accountOptions = accounts
      .filter((account) => account.isActive)
      .map((account) => ({ id: account.id, code: account.code, name: account.name, accountType: account.accountType }));

    const selected = filter?.accountId
      ? accounts.find((account) => account.id === filter.accountId)
      : accounts.find((account) => account.systemKey === "cash_on_hand") ?? accounts[0];

    if (!selected) {
      return { accounts: accountOptions, lines: [], openingBalance: 0, periodDebit: 0, periodCredit: 0, closingBalance: 0, truncated: false };
    }

    const direction = (debit: number, credit: number) =>
      selected.normalBalance === "debit" ? debit - credit : credit - debit;

    // Opening balance: everything strictly before the from-date, aggregated —
    // so the running balance is correct even for accounts with long history.
    let openingBalance = 0;
    if (filter?.from) {
      const { data: openingRows, error: openingError } = await (admin as any)
        .from("journal_lines")
        .select("debit, credit, journal_entries!inner(entry_date, status)")
        .eq("organization_id", scope.organizationId)
        .eq("account_id", selected.id)
        .eq("journal_entries.status", "posted")
        .lt("journal_entries.entry_date", filter.from)
        .limit(100000);

      if (openingError) throw new Error(openingError.message);
      for (const row of openingRows ?? []) {
        openingBalance += direction(numberValue(row.debit), numberValue(row.credit));
      }
    }

    let linesQuery = (admin as any)
      .from("journal_lines")
      .select(
        "id, debit, credit, memo, cost_centers(name), journal_entries!inner(id, entry_number, entry_date, status, created_at, source_doc_type, branches(name))",
      )
      .eq("organization_id", scope.organizationId)
      .eq("account_id", selected.id)
      .eq("journal_entries.status", "posted");

    if (filter?.from) linesQuery = linesQuery.gte("journal_entries.entry_date", filter.from);
    if (filter?.to) linesQuery = linesQuery.lte("journal_entries.entry_date", filter.to);

    const { data: lineRows, error } = await linesQuery.order("created_at", { ascending: true }).limit(GL_LINE_LIMIT);

    if (error) throw new Error(error.message);

    const sorted = (lineRows ?? []).slice().sort((a: any, b: any) => {
      const dateCompare = String(a.journal_entries?.entry_date ?? "").localeCompare(String(b.journal_entries?.entry_date ?? ""));
      if (dateCompare !== 0) return dateCompare;
      return String(a.journal_entries?.created_at ?? "").localeCompare(String(b.journal_entries?.created_at ?? ""));
    });

    let running = openingBalance;
    let periodDebit = 0;
    let periodCredit = 0;
    const lines: GeneralLedgerLine[] = sorted.map((line: any) => {
      const debit = numberValue(line.debit);
      const credit = numberValue(line.credit);
      periodDebit += debit;
      periodCredit += credit;
      running += direction(debit, credit);
      return {
        id: line.id,
        journalEntryId: line.journal_entries?.id ?? "",
        entryDate: line.journal_entries?.entry_date ?? "",
        entryNumber: line.journal_entries?.entry_number ?? "",
        memo: line.memo ?? undefined,
        sourceDocType: line.journal_entries?.source_doc_type ?? undefined,
        branchName: line.journal_entries?.branches?.name ?? undefined,
        costCenterName: line.cost_centers?.name ?? undefined,
        debit,
        credit,
        runningBalance: running,
      };
    });

    return {
      accounts: accountOptions,
      selectedAccount: {
        id: selected.id,
        code: selected.code,
        name: selected.name,
        accountType: selected.accountType,
        normalBalance: selected.normalBalance,
      },
      openingBalance,
      lines,
      periodDebit,
      periodCredit,
      closingBalance: running,
      from: filter?.from,
      to: filter?.to,
      truncated: (lineRows ?? []).length >= GL_LINE_LIMIT,
    };
  });
}

// ============================================================================
// 4b) General journal browser (دفتر اليومية العامة)
// ============================================================================

export type JournalBrowserLine = {
  id: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo?: string;
  costCenterName?: string;
};

export type JournalBrowserEntry = {
  id: string;
  entryNumber: string;
  entryDate: string;
  memo?: string;
  status: string;
  sourceDocType?: string;
  sourceDocId?: string;
  branchName?: string;
  reversalOfEntryId?: string;
  debitTotal: number;
  creditTotal: number;
  balanced: boolean;
  lines: JournalBrowserLine[];
};

export type JournalBrowserFilter = {
  from?: string;
  to?: string;
  q?: string;
  status?: "posted" | "draft";
  sourceType?: string;
};

export type JournalBrowserData = {
  entries: JournalBrowserEntry[];
  totalDebit: number;
  totalCredit: number;
  truncated: boolean;
  filter: JournalBrowserFilter;
  sourceTypes: string[];
};

const demoJournalBrowser: JournalBrowserData = {
  entries: [
    {
      id: "je-demo-1",
      entryNumber: "JE-20260705-0003",
      entryDate: "2026-07-05",
      memo: "قيد تلقائي لفاتورة كاشير",
      status: "posted",
      sourceDocType: "customer_invoice",
      debitTotal: 245,
      creditTotal: 245,
      balanced: true,
      lines: [
        { id: "l1", accountCode: "1010", accountName: "الصندوق", debit: 245, credit: 0, memo: "تحصيل نقدي" },
        { id: "l2", accountCode: "4100", accountName: "مبيعات المطعم", debit: 0, credit: 245, memo: "مبيعات" },
      ],
    },
  ],
  totalDebit: 245,
  totalCredit: 245,
  truncated: false,
  filter: {},
  sourceTypes: ["customer_invoice", "expense"],
};

const JOURNAL_BROWSER_LIMIT = 200;

export async function getJournalBrowserData(filter?: JournalBrowserFilter): Promise<JournalBrowserData> {
  if (isDemoMode()) return demoJournalBrowser;

  return withAdminScope<JournalBrowserData>(demoJournalBrowser, async (admin, scope) => {
    let query = (admin as any)
      .from("journal_entries")
      .select(
        "id, entry_number, entry_date, memo, status, source_doc_type, source_doc_id, reversal_of_entry_id, created_at, branches(name), journal_lines(id, debit, credit, memo, cost_centers(name), chart_of_accounts(code, name))",
      )
      .eq("organization_id", scope.organizationId);

    if (filter?.from) query = query.gte("entry_date", filter.from);
    if (filter?.to) query = query.lte("entry_date", filter.to);
    if (filter?.status) query = query.eq("status", filter.status);
    if (filter?.sourceType) query = query.eq("source_doc_type", filter.sourceType);

    const { data: entryRows, error } = await query
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(JOURNAL_BROWSER_LIMIT);

    if (error) throw new Error(error.message);

    const q = (filter?.q ?? "").trim();

    let entries: JournalBrowserEntry[] = (entryRows ?? []).map((entry: any) => {
      const lines: JournalBrowserLine[] = (entry.journal_lines ?? []).map((line: any) => ({
        id: line.id,
        accountCode: line.chart_of_accounts?.code ?? "",
        accountName: line.chart_of_accounts?.name ?? "حساب غير معروف",
        debit: numberValue(line.debit),
        credit: numberValue(line.credit),
        memo: line.memo ?? undefined,
        costCenterName: line.cost_centers?.name ?? undefined,
      }));

      const debitTotal = lines.reduce((sum, line) => sum + line.debit, 0);
      const creditTotal = lines.reduce((sum, line) => sum + line.credit, 0);

      return {
        id: entry.id,
        entryNumber: entry.entry_number ?? "",
        entryDate: entry.entry_date ?? "",
        memo: entry.memo ?? undefined,
        status: entry.status ?? "posted",
        sourceDocType: entry.source_doc_type ?? undefined,
        sourceDocId: entry.source_doc_id ?? undefined,
        branchName: entry.branches?.name ?? undefined,
        reversalOfEntryId: entry.reversal_of_entry_id ?? undefined,
        debitTotal,
        creditTotal,
        balanced: Math.abs(debitTotal - creditTotal) < 0.01,
        lines,
      };
    });

    if (q) {
      entries = entries.filter(
        (entry) =>
          entry.entryNumber.includes(q) ||
          (entry.memo ?? "").includes(q) ||
          entry.lines.some((line) => line.accountName.includes(q) || line.accountCode.includes(q) || (line.memo ?? "").includes(q)),
      );
    }

    const sourceTypes = Array.from(
      new Set((entryRows ?? []).map((entry: any) => entry.source_doc_type).filter(Boolean)),
    ) as string[];

    return {
      entries,
      totalDebit: entries.reduce((sum, entry) => sum + entry.debitTotal, 0),
      totalCredit: entries.reduce((sum, entry) => sum + entry.creditTotal, 0),
      truncated: (entryRows ?? []).length >= JOURNAL_BROWSER_LIMIT,
      filter: filter ?? {},
      sourceTypes,
    };
  });
}

// ============================================================================
// 5) Cost centers (مراكز التكلفة)
// ============================================================================

export type CostCenter = {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  /** Period P&L from journal lines tagged with this cost center. */
  revenue: number;
  cogs: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
};

export type CostCentersData = {
  costCenters: CostCenter[];
  /** Journal-line activity in the period with NO cost center (unallocated). */
  unallocated: { revenue: number; cogs: number; expenses: number };
  from: string;
  to: string;
};

const demoCostCenters: CostCenter[] = [
  { id: "cc-1", code: "CC-100", name: "صالة (Dine-in)", description: "مبيعات ومصاريف الصالة الداخلية", isActive: true, revenue: 9500, cogs: 3100, expenses: 1800, grossProfit: 6400, netProfit: 4600 },
  { id: "cc-2", code: "CC-300", name: "توصيل (Delivery)", description: "طلبات وتكاليف التوصيل", isActive: true, revenue: 4200, cogs: 1600, expenses: 950, grossProfit: 2600, netProfit: 1650 },
];

const demoCostCentersData: CostCentersData = {
  costCenters: demoCostCenters,
  unallocated: { revenue: 10100, cogs: 3400, expenses: 2450 },
  from: "2026-07-01",
  to: "2026-07-10",
};

export async function getCostCentersData(filter?: BalanceFilter): Promise<CostCentersData> {
  if (isDemoMode()) return demoCostCentersData;

  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const to = filter?.to || localToday;
  const from = filter?.from || `${to.slice(0, 7)}-01`;

  return withAdminScope<CostCentersData>(demoCostCentersData, async (admin, scope) => {
    await (admin as any).rpc("ensure_default_cost_centers", { target_org_id: scope.organizationId });

    const [centersResult, linesResult] = await Promise.all([
      (admin as any)
        .from("cost_centers")
        .select("id, code, name, description, is_active")
        .eq("organization_id", scope.organizationId)
        .order("code"),
      (admin as any)
        .from("journal_lines")
        .select("cost_center_id, debit, credit, chart_of_accounts!inner(account_type), journal_entries!inner(status, entry_date)")
        .eq("organization_id", scope.organizationId)
        .eq("journal_entries.status", "posted")
        .gte("journal_entries.entry_date", from)
        .lte("journal_entries.entry_date", to)
        .in("chart_of_accounts.account_type", ["revenue", "cogs", "expense"])
        .limit(50000),
    ]);

    if (centersResult.error) throw new Error(centersResult.error.message);
    if (linesResult.error) throw new Error(linesResult.error.message);

    type Bucket = { revenue: number; cogs: number; expenses: number };
    const buckets = new Map<string, Bucket>();
    const unallocated: Bucket = { revenue: 0, cogs: 0, expenses: 0 };

    for (const line of linesResult.data ?? []) {
      const accountType = line.chart_of_accounts?.account_type;
      const debit = numberValue(line.debit);
      const credit = numberValue(line.credit);
      const target: Bucket = line.cost_center_id
        ? buckets.get(line.cost_center_id) ?? { revenue: 0, cogs: 0, expenses: 0 }
        : unallocated;

      if (accountType === "revenue") target.revenue += credit - debit;
      if (accountType === "cogs") target.cogs += debit - credit;
      if (accountType === "expense") target.expenses += debit - credit;

      if (line.cost_center_id) buckets.set(line.cost_center_id, target);
    }

    return {
      costCenters: (centersResult.data ?? []).map((center: any) => {
        const bucket = buckets.get(center.id) ?? { revenue: 0, cogs: 0, expenses: 0 };
        return {
          id: center.id,
          code: center.code,
          name: center.name,
          description: center.description ?? undefined,
          isActive: Boolean(center.is_active),
          revenue: bucket.revenue,
          cogs: bucket.cogs,
          expenses: bucket.expenses,
          grossProfit: bucket.revenue - bucket.cogs,
          netProfit: bucket.revenue - bucket.cogs - bucket.expenses,
        };
      }),
      unallocated,
      from,
      to,
    };
  });
}

// ============================================================================
// 5b) Manual journal form lookups (cost centers + branches)
// ============================================================================

export type JournalFormLookups = {
  costCenters: Array<{ id: string; code: string; name: string }>;
  branches: Array<{ id: string; name: string }>;
};

const demoJournalFormLookups: JournalFormLookups = {
  costCenters: [
    { id: "cc-1", code: "CC-100", name: "صالة (Dine-in)" },
    { id: "cc-2", code: "CC-300", name: "توصيل (Delivery)" },
  ],
  branches: [{ id: "branch-demo", name: "الفرع الرئيسي" }],
};

export async function getJournalFormLookups(): Promise<JournalFormLookups> {
  if (isDemoMode()) return demoJournalFormLookups;

  return withAdminScope<JournalFormLookups>(demoJournalFormLookups, async (admin, scope) => {
    const [centersResult, branchesResult] = await Promise.all([
      (admin as any)
        .from("cost_centers")
        .select("id, code, name")
        .eq("organization_id", scope.organizationId)
        .eq("is_active", true)
        .order("code"),
      (admin as any)
        .from("branches")
        .select("id, name")
        .eq("organization_id", scope.organizationId)
        .order("created_at"),
    ]);

    return {
      costCenters: centersResult.data ?? [],
      branches: branchesResult.data ?? [],
    };
  });
}

// ============================================================================
// 6) Expenses (المصروفات)
// ============================================================================

export type ExpenseRecord = {
  id: string;
  category: string;
  description?: string;
  amount: number;
  expenseDate: string;
  paymentMethod: "cash" | "bank";
  branchName?: string;
  costCenterName?: string;
  status: string;
  notes?: string;
  payee?: string;
  referenceNo?: string;
  expenseAccountLabel?: string;
};

export type ExpensesData = {
  expenses: ExpenseRecord[];
  monthTotal: number;
  byCategory: Array<{ category: string; total: number }>;
  costCenters: Array<{ id: string; code: string; name: string }>;
  branches: Array<{ id: string; name: string }>;
  /** Active expense/COGS accounts for explicit posting selection. */
  expenseAccounts: Array<{ id: string; code: string; name: string }>;
};

const demoExpensesData: ExpensesData = {
  expenses: [
    { id: "exp-1", category: "كهرباء", description: "فاتورة شهر 6", amount: 320, expenseDate: "2026-07-02", paymentMethod: "cash", status: "posted", payee: "شركة الكهرباء", referenceNo: "EL-556" },
    { id: "exp-2", category: "رواتب", description: "راتب عامل مطبخ", amount: 1500, expenseDate: "2026-07-01", paymentMethod: "bank", status: "posted" },
  ],
  monthTotal: 1820,
  byCategory: [
    { category: "رواتب", total: 1500 },
    { category: "كهرباء", total: 320 },
  ],
  costCenters: [
    { id: "cc-1", code: "CC-100", name: "صالة (Dine-in)" },
    { id: "cc-2", code: "CC-300", name: "توصيل (Delivery)" },
  ],
  branches: [{ id: "branch-demo", name: "الفرع الرئيسي" }],
  expenseAccounts: [
    { id: "acc-exp", code: "6100", name: "مصروفات تشغيلية" },
  ],
};

export async function getExpensesData(): Promise<ExpensesData> {
  if (isDemoMode()) return demoExpensesData;

  return withAdminScope<ExpensesData>(demoExpensesData, async (admin, scope) => {
    const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;

    const [expensesResult, centersResult, branchesResult, accountsResult] = await Promise.all([
      (admin as any)
        .from("expenses")
        .select("id, category, description, amount, expense_date, payment_method, status, notes, payee, reference_no, branches(name), cost_centers(name), chart_of_accounts(code, name)")
        .eq("organization_id", scope.organizationId)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
      (admin as any)
        .from("cost_centers")
        .select("id, code, name")
        .eq("organization_id", scope.organizationId)
        .eq("is_active", true)
        .order("code"),
      (admin as any)
        .from("branches")
        .select("id, name")
        .eq("organization_id", scope.organizationId)
        .order("created_at"),
      (admin as any)
        .from("chart_of_accounts")
        .select("id, code, name")
        .eq("organization_id", scope.organizationId)
        .eq("is_active", true)
        .in("account_type", ["expense", "cogs"])
        .order("code"),
    ]);

    if (expensesResult.error) throw new Error(expensesResult.error.message);

    const expenses: ExpenseRecord[] = (expensesResult.data ?? []).map((expense: any) => ({
      id: expense.id,
      category: expense.category,
      description: expense.description ?? undefined,
      amount: numberValue(expense.amount),
      expenseDate: expense.expense_date,
      paymentMethod: expense.payment_method === "bank" ? "bank" : "cash",
      branchName: expense.branches?.name ?? undefined,
      costCenterName: expense.cost_centers?.name ?? undefined,
      status: expense.status ?? "posted",
      notes: expense.notes ?? undefined,
      payee: expense.payee ?? undefined,
      referenceNo: expense.reference_no ?? undefined,
      expenseAccountLabel: expense.chart_of_accounts
        ? `${expense.chart_of_accounts.code} - ${expense.chart_of_accounts.name}`
        : undefined,
    }));

    const monthExpenses = expenses.filter((expense) => expense.expenseDate >= monthStart && expense.status === "posted");
    const categoryTotals = new Map<string, number>();
    for (const expense of monthExpenses) {
      categoryTotals.set(expense.category, (categoryTotals.get(expense.category) ?? 0) + expense.amount);
    }

    return {
      expenses,
      monthTotal: monthExpenses.reduce((sum, expense) => sum + expense.amount, 0),
      byCategory: Array.from(categoryTotals.entries())
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total),
      costCenters: centersResult.data ?? [],
      branches: branchesResult.data ?? [],
      expenseAccounts: accountsResult.data ?? [],
    };
  });
}

// ============================================================================
// 6b) Accounts payable: aging + supplier statement (الذمم الدائنة)
// ============================================================================

export type AgingBucketKey = "current" | "d1_30" | "d31_60" | "d61_90" | "d90plus";

export type PayableInvoice = {
  id: string;
  invoiceNumber: string;
  supplierId?: string;
  supplierName: string;
  issuedAt: string;
  dueDate?: string;
  total: number;
  paidAmount: number;
  balanceDue: number;
  status: string;
  daysOverdue: number;
  bucket: AgingBucketKey;
};

export type SupplierStatementRow = {
  date: string;
  docType: "invoice" | "payment";
  docNumber: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export type SupplierSummary = {
  id: string;
  name: string;
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  openInvoices: number;
};

export type PayablesData = {
  openInvoices: PayableInvoice[];
  agingTotals: Record<AgingBucketKey, number>;
  totalPayable: number;
  suppliers: SupplierSummary[];
  selectedSupplier?: { id: string; name: string; rows: SupplierStatementRow[]; balance: number };
};

const demoPayables: PayablesData = {
  openInvoices: [
    { id: "inv-demo-1", invoiceNumber: "SUP-2026-0031", supplierName: "شركة الخليج للمواد الغذائية", issuedAt: "2026-06-15", dueDate: "2026-07-15", total: 1850, paidAmount: 500, balanceDue: 1350, status: "partially_paid", daysOverdue: 0, bucket: "current" },
    { id: "inv-demo-2", invoiceNumber: "SUP-2026-0034", supplierName: "مزارع البركة", issuedAt: "2026-05-20", dueDate: "2026-06-20", total: 900, paidAmount: 0, balanceDue: 900, status: "posted", daysOverdue: 20, bucket: "d1_30" },
  ],
  agingTotals: { current: 1350, d1_30: 900, d31_60: 0, d61_90: 0, d90plus: 0 },
  totalPayable: 2250,
  suppliers: [
    { id: "sup-1", name: "شركة الخليج للمواد الغذائية", totalInvoiced: 5850, totalPaid: 4500, balance: 1350, openInvoices: 1 },
    { id: "sup-2", name: "مزارع البركة", totalInvoiced: 2900, totalPaid: 2000, balance: 900, openInvoices: 1 },
  ],
};

function agingBucket(daysOverdue: number): AgingBucketKey {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "d1_30";
  if (daysOverdue <= 60) return "d31_60";
  if (daysOverdue <= 90) return "d61_90";
  return "d90plus";
}

export async function getPayablesData(supplierId?: string): Promise<PayablesData> {
  if (isDemoMode()) return demoPayables;

  return withAdminScope<PayablesData>(demoPayables, async (admin, scope) => {
    const [invoicesResult, paymentsResult] = await Promise.all([
      (admin as any)
        .from("invoices")
        .select("id, invoice_number, supplier_id, issued_at, due_date, total, paid_amount, balance_due, status, payment_status, suppliers(name)")
        .eq("organization_id", scope.organizationId)
        .neq("status", "void")
        .order("issued_at", { ascending: false })
        .limit(2000),
      (admin as any)
        .from("supplier_payments")
        .select("id, invoice_id, supplier_id, amount, payment_method, payment_date, reference")
        .eq("organization_id", scope.organizationId)
        .order("payment_date", { ascending: true })
        .limit(5000),
    ]);

    if (invoicesResult.error) throw new Error(invoicesResult.error.message);

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const agingTotals: Record<AgingBucketKey, number> = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
    const openInvoices: PayableInvoice[] = [];
    const supplierMap = new Map<string, SupplierSummary>();

    for (const invoice of invoicesResult.data ?? []) {
      const total = numberValue(invoice.total);
      // Legacy rows created before the lifecycle migration have status 'paid'
      // with no payment tracking — treat them as fully paid.
      const isLegacyPaid = invoice.status === "paid" && invoice.paid_amount == null;
      const paidAmount = isLegacyPaid ? total : numberValue(invoice.paid_amount);
      const balanceDue = isLegacyPaid ? 0 : invoice.balance_due != null ? numberValue(invoice.balance_due) : total - paidAmount;
      const supplierName = invoice.suppliers?.name ?? "مورد غير معروف";
      const supplierKey = invoice.supplier_id ?? "unknown";

      const summary = supplierMap.get(supplierKey) ?? {
        id: supplierKey,
        name: supplierName,
        totalInvoiced: 0,
        totalPaid: 0,
        balance: 0,
        openInvoices: 0,
      };
      summary.totalInvoiced += total;
      summary.totalPaid += paidAmount;
      summary.balance += balanceDue;
      if (balanceDue > 0.001) summary.openInvoices += 1;
      supplierMap.set(supplierKey, summary);

      if (balanceDue > 0.001) {
        const dueDate = invoice.due_date ?? invoice.issued_at ?? today;
        const daysOverdue = Math.max(
          0,
          Math.floor((new Date(`${today}T00:00:00`).getTime() - new Date(`${String(dueDate).slice(0, 10)}T00:00:00`).getTime()) / 86400000),
        );
        const bucket = agingBucket(daysOverdue);
        agingTotals[bucket] += balanceDue;

        openInvoices.push({
          id: invoice.id,
          invoiceNumber: invoice.invoice_number ?? "بدون رقم",
          supplierId: invoice.supplier_id ?? undefined,
          supplierName,
          issuedAt: String(invoice.issued_at ?? "").slice(0, 10),
          dueDate: invoice.due_date ?? undefined,
          total,
          paidAmount,
          balanceDue,
          status: invoice.payment_status ?? invoice.status ?? "posted",
          daysOverdue,
          bucket,
        });
      }
    }

    // Supplier statement: invoices (credit) + payments (debit) merged by date.
    let selectedSupplier: PayablesData["selectedSupplier"];
    if (supplierId && supplierMap.has(supplierId)) {
      const supplierInvoices = (invoicesResult.data ?? []).filter((invoice: any) => invoice.supplier_id === supplierId);
      const supplierPayments = (paymentsResult.data ?? []).filter((payment: any) => payment.supplier_id === supplierId);

      type RawRow = Omit<SupplierStatementRow, "balance">;
      const rawRows: RawRow[] = [
        ...supplierInvoices.map((invoice: any): RawRow => ({
          date: String(invoice.issued_at ?? "").slice(0, 10),
          docType: "invoice",
          docNumber: invoice.invoice_number ?? invoice.id.slice(0, 8),
          description: `فاتورة توريد${invoice.due_date ? ` — استحقاق ${invoice.due_date}` : ""}`,
          debit: 0,
          credit: numberValue(invoice.total),
        })),
        ...supplierPayments.map((payment: any): RawRow => ({
          date: String(payment.payment_date ?? "").slice(0, 10),
          docType: "payment",
          docNumber: payment.reference || payment.id.slice(0, 8),
          description: `سند دفع (${payment.payment_method === "cash" ? "نقدي" : "بنك"})`,
          debit: numberValue(payment.amount),
          credit: 0,
        })),
      ].sort((a, b) => a.date.localeCompare(b.date));

      let running = 0;
      const rows: SupplierStatementRow[] = rawRows.map((row) => {
        running += row.credit - row.debit;
        return { ...row, balance: running };
      });

      selectedSupplier = {
        id: supplierId,
        name: supplierMap.get(supplierId)!.name,
        rows,
        balance: running,
      };
    }

    return {
      openInvoices: openInvoices.sort((a, b) => b.daysOverdue - a.daysOverdue),
      agingTotals,
      totalPayable: Object.values(agingTotals).reduce((sum, value) => sum + value, 0),
      suppliers: Array.from(supplierMap.values()).sort((a, b) => b.balance - a.balance),
      selectedSupplier,
    };
  });
}

// ============================================================================
// 7) Accounting periods (الإقفال الشهري)
// ============================================================================

export type AccountingPeriod = {
  year: number;
  month: number;
  status: "open" | "closed";
  closedAt?: string;
  entryCount: number;
  draftCount: number;
  debitTotal: number;
  creditTotal: number;
  balanced: boolean;
};

const demoPeriods: AccountingPeriod[] = [
  { year: 2026, month: 7, status: "open", entryCount: 42, draftCount: 0, debitTotal: 26550, creditTotal: 26550, balanced: true },
  { year: 2026, month: 6, status: "closed", closedAt: "2026-07-01", entryCount: 118, draftCount: 0, debitTotal: 84200, creditTotal: 84200, balanced: true },
];

export async function getAccountingPeriodsData(): Promise<{ periods: AccountingPeriod[] }> {
  if (isDemoMode()) return { periods: demoPeriods };

  return withAdminScope<{ periods: AccountingPeriod[] }>({ periods: demoPeriods }, async (admin, scope) => {
    const [periodsResult, entriesResult] = await Promise.all([
      (admin as any)
        .from("accounting_periods")
        .select("period_year, period_month, status, closed_at")
        .eq("organization_id", scope.organizationId),
      (admin as any)
        .from("journal_entries")
        .select("entry_date, status, journal_lines(debit, credit)")
        .eq("organization_id", scope.organizationId)
        .eq("status", "posted")
        .limit(5000),
    ]);

    if (periodsResult.error) throw new Error(periodsResult.error.message);

    const closedMap = new Map<string, { status: string; closedAt?: string }>();
    for (const period of periodsResult.data ?? []) {
      closedMap.set(`${period.period_year}-${period.period_month}`, {
        status: period.status,
        closedAt: period.closed_at ?? undefined,
      });
    }

    type PeriodAccumulator = { entryCount: number; draftCount: number; debitTotal: number; creditTotal: number };
    const activity = new Map<string, PeriodAccumulator>();
    for (const entry of entriesResult.data ?? []) {
      const entryDate = String(entry.entry_date ?? "");
      if (!entryDate) continue;
      const key = `${Number(entryDate.slice(0, 4))}-${Number(entryDate.slice(5, 7))}`;
      const current = activity.get(key) ?? { entryCount: 0, draftCount: 0, debitTotal: 0, creditTotal: 0 };
      current.entryCount += 1;
      if (entry.status === "draft") current.draftCount += 1;
      for (const line of entry.journal_lines ?? []) {
        current.debitTotal += numberValue(line.debit);
        current.creditTotal += numberValue(line.credit);
      }
      activity.set(key, current);
    }

    // Last 12 months, newest first.
    const periods: AccountingPeriod[] = [];
    const now = new Date();
    for (let index = 0; index < 12; index += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;
      const accumulated = activity.get(key) ?? { entryCount: 0, draftCount: 0, debitTotal: 0, creditTotal: 0 };
      const closed = closedMap.get(key);

      periods.push({
        year,
        month,
        status: closed?.status === "closed" ? "closed" : "open",
        closedAt: closed?.closedAt,
        entryCount: accumulated.entryCount,
        draftCount: accumulated.draftCount,
        debitTotal: accumulated.debitTotal,
        creditTotal: accumulated.creditTotal,
        balanced: Math.abs(accumulated.debitTotal - accumulated.creditTotal) < 0.01,
      });
    }

    return { periods };
  });
}

// ============================================================================
// 8) Accounting settings (إعدادات المحاسبة المتقدمة)
// ============================================================================

export type AccountingSettings = {
  currencyCode: string;
  taxEnabled: boolean;
  taxRate: number;
  allowNegativeStock: boolean;
  requireShiftBeforeSale: boolean;
  requireManagerApprovalRefund: boolean;
  discountApprovalLimit: number;
  lockPostedInvoices: boolean;
  enableBranches: boolean;
  enableCostCenters: boolean;
  enableAdvancedAccounting: boolean;
};

export const defaultAccountingSettings: AccountingSettings = {
  currencyCode: "ILS",
  taxEnabled: false,
  taxRate: 0,
  allowNegativeStock: false,
  requireShiftBeforeSale: true,
  requireManagerApprovalRefund: true,
  discountApprovalLimit: 0,
  lockPostedInvoices: true,
  enableBranches: false,
  enableCostCenters: false,
  enableAdvancedAccounting: true,
};

export async function getAccountingSettingsData(): Promise<AccountingSettings> {
  if (isDemoMode()) return defaultAccountingSettings;

  return withAdminScope<AccountingSettings>(defaultAccountingSettings, async (admin, scope) => {
    const { data, error } = await (admin as any)
      .from("accounting_settings")
      .select("*")
      .eq("organization_id", scope.organizationId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return defaultAccountingSettings;

    return {
      currencyCode: data.currency_code ?? "ILS",
      taxEnabled: Boolean(data.tax_enabled),
      taxRate: numberValue(data.tax_rate),
      allowNegativeStock: Boolean(data.allow_negative_stock),
      requireShiftBeforeSale: Boolean(data.require_shift_before_sale),
      requireManagerApprovalRefund: Boolean(data.require_manager_approval_refund),
      discountApprovalLimit: numberValue(data.discount_approval_limit),
      lockPostedInvoices: Boolean(data.lock_posted_invoices),
      enableBranches: Boolean(data.enable_branches),
      enableCostCenters: Boolean(data.enable_cost_centers),
      enableAdvancedAccounting: Boolean(data.enable_advanced_accounting),
    };
  });
}
