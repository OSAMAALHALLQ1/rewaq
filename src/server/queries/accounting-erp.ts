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
    .neq("journal_entries.status", "void");

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
        .neq("status", "void")
        .gte("issued_at", `${today}T00:00:00.000Z`),
      (admin as any)
        .from("customer_invoices")
        .select("total")
        .eq("organization_id", scope.organizationId)
        .neq("status", "void")
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
        .in("status", ["draft", "matched"])
        .order("issued_at", { ascending: false })
        .limit(6),
      (admin as any)
        .from("journal_entries")
        .select("id, entry_number, entry_date, memo, status, journal_lines(debit)")
        .eq("organization_id", scope.organizationId)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

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
  code: string;
  name: string;
  accountType: string;
  debit: number;
  credit: number;
};

export type TrialBalanceData = {
  rows: TrialBalanceRow[];
  debitTotal: number;
  creditTotal: number;
  balanced: boolean;
  from?: string;
  to?: string;
};

const demoTrialBalance: TrialBalanceData = {
  rows: [
    { code: "1010", name: "الصندوق", accountType: "asset", debit: 6400, credit: 0 },
    { code: "1020", name: "البنك / بطاقات", accountType: "asset", debit: 4300, credit: 0 },
    { code: "1300", name: "المخزون", accountType: "asset", debit: 5100, credit: 0 },
    { code: "2200", name: "ذمم الموردين", accountType: "liability", debit: 0, credit: 2750 },
    { code: "4100", name: "مبيعات المطعم", accountType: "revenue", debit: 0, credit: 23800 },
    { code: "5100", name: "تكلفة البضاعة المباعة", accountType: "cogs", debit: 8100, credit: 0 },
    { code: "6100", name: "مصروفات تشغيلية", accountType: "expense", debit: 2650, credit: 0 },
  ],
  debitTotal: 26550,
  creditTotal: 26550,
  balanced: true,
};

export async function getTrialBalanceData(filter?: BalanceFilter): Promise<TrialBalanceData> {
  if (isDemoMode()) return demoTrialBalance;

  return withAdminScope<TrialBalanceData>(demoTrialBalance, async (admin, scope) => {
    const accounts = await loadAccountsWithBalances(admin, scope.organizationId, filter);

    const rows: TrialBalanceRow[] = accounts
      .filter((account) => account.debitTotal !== 0 || account.creditTotal !== 0)
      .map((account) => {
        const net = account.debitTotal - account.creditTotal;
        return {
          code: account.code,
          name: account.name,
          accountType: account.accountType,
          debit: net > 0 ? net : 0,
          credit: net < 0 ? -net : 0,
        };
      });

    const debitTotal = rows.reduce((sum, row) => sum + row.debit, 0);
    const creditTotal = rows.reduce((sum, row) => sum + row.credit, 0);

    return {
      rows,
      debitTotal,
      creditTotal,
      balanced: Math.abs(debitTotal - creditTotal) < 0.01,
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
  entryDate: string;
  entryNumber: string;
  memo?: string;
  debit: number;
  credit: number;
  runningBalance: number;
};

export type GeneralLedgerData = {
  accounts: Array<{ id: string; code: string; name: string; accountType: string }>;
  selectedAccount?: { id: string; code: string; name: string; accountType: string; normalBalance: "debit" | "credit" };
  lines: GeneralLedgerLine[];
  closingBalance: number;
};

const demoGeneralLedger: GeneralLedgerData = {
  accounts: demoChartAccounts.map((account) => ({ id: account.id, code: account.code, name: account.name, accountType: account.accountType })),
  selectedAccount: { id: "acc-cash", code: "1010", name: "الصندوق", accountType: "asset", normalBalance: "debit" },
  lines: [
    { id: "gl-1", entryDate: "2026-07-01", entryNumber: "JE-20260701-0001", memo: "تحصيل فاتورة INV-1001", debit: 350, credit: 0, runningBalance: 350 },
    { id: "gl-2", entryDate: "2026-07-02", entryNumber: "JE-20260702-0002", memo: "سداد مصروف كهرباء", debit: 0, credit: 320, runningBalance: 30 },
  ],
  closingBalance: 30,
};

export async function getGeneralLedgerData(accountId?: string): Promise<GeneralLedgerData> {
  if (isDemoMode()) return demoGeneralLedger;

  return withAdminScope<GeneralLedgerData>(demoGeneralLedger, async (admin, scope) => {
    const accounts = await loadAccountsWithBalances(admin, scope.organizationId);
    const accountOptions = accounts
      .filter((account) => account.isActive)
      .map((account) => ({ id: account.id, code: account.code, name: account.name, accountType: account.accountType }));

    const selected = accountId
      ? accounts.find((account) => account.id === accountId)
      : accounts.find((account) => account.systemKey === "cash_on_hand") ?? accounts[0];

    if (!selected) {
      return { accounts: accountOptions, lines: [], closingBalance: 0 };
    }

    const { data: lineRows, error } = await (admin as any)
      .from("journal_lines")
      .select("id, debit, credit, memo, journal_entries!inner(entry_number, entry_date, status, created_at)")
      .eq("organization_id", scope.organizationId)
      .eq("account_id", selected.id)
      .neq("journal_entries.status", "void")
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) throw new Error(error.message);

    const sorted = (lineRows ?? []).slice().sort((a: any, b: any) => {
      const dateCompare = String(a.journal_entries?.entry_date ?? "").localeCompare(String(b.journal_entries?.entry_date ?? ""));
      if (dateCompare !== 0) return dateCompare;
      return String(a.journal_entries?.created_at ?? "").localeCompare(String(b.journal_entries?.created_at ?? ""));
    });

    let running = 0;
    const lines: GeneralLedgerLine[] = sorted.map((line: any) => {
      const debit = numberValue(line.debit);
      const credit = numberValue(line.credit);
      running += selected.normalBalance === "debit" ? debit - credit : credit - debit;
      return {
        id: line.id,
        entryDate: line.journal_entries?.entry_date ?? "",
        entryNumber: line.journal_entries?.entry_number ?? "",
        memo: line.memo ?? undefined,
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
      lines,
      closingBalance: running,
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
  monthExpenses: number;
};

const demoCostCenters: CostCenter[] = [
  { id: "cc-1", code: "CC-100", name: "صالة (Dine-in)", description: "مبيعات ومصاريف الصالة الداخلية", isActive: true, monthExpenses: 1800 },
  { id: "cc-2", code: "CC-300", name: "توصيل (Delivery)", description: "طلبات وتكاليف التوصيل", isActive: true, monthExpenses: 950 },
];

export async function getCostCentersData(): Promise<{ costCenters: CostCenter[] }> {
  if (isDemoMode()) return { costCenters: demoCostCenters };

  return withAdminScope<{ costCenters: CostCenter[] }>({ costCenters: demoCostCenters }, async (admin, scope) => {
    await (admin as any).rpc("ensure_default_cost_centers", { target_org_id: scope.organizationId });

    const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;

    const [centersResult, expensesResult] = await Promise.all([
      (admin as any)
        .from("cost_centers")
        .select("id, code, name, description, is_active")
        .eq("organization_id", scope.organizationId)
        .order("code"),
      (admin as any)
        .from("expenses")
        .select("cost_center_id, amount")
        .eq("organization_id", scope.organizationId)
        .eq("status", "posted")
        .gte("expense_date", monthStart),
    ]);

    if (centersResult.error) throw new Error(centersResult.error.message);

    const expenseTotals = new Map<string, number>();
    for (const expense of expensesResult.data ?? []) {
      if (!expense.cost_center_id) continue;
      expenseTotals.set(expense.cost_center_id, (expenseTotals.get(expense.cost_center_id) ?? 0) + numberValue(expense.amount));
    }

    return {
      costCenters: (centersResult.data ?? []).map((center: any) => ({
        id: center.id,
        code: center.code,
        name: center.name,
        description: center.description ?? undefined,
        isActive: Boolean(center.is_active),
        monthExpenses: expenseTotals.get(center.id) ?? 0,
      })),
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
};

export type ExpensesData = {
  expenses: ExpenseRecord[];
  monthTotal: number;
  byCategory: Array<{ category: string; total: number }>;
  costCenters: Array<{ id: string; code: string; name: string }>;
  branches: Array<{ id: string; name: string }>;
};

const demoExpensesData: ExpensesData = {
  expenses: [
    { id: "exp-1", category: "كهرباء", description: "فاتورة شهر 6", amount: 320, expenseDate: "2026-07-02", paymentMethod: "cash", status: "posted" },
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
};

export async function getExpensesData(): Promise<ExpensesData> {
  if (isDemoMode()) return demoExpensesData;

  return withAdminScope<ExpensesData>(demoExpensesData, async (admin, scope) => {
    const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;

    const [expensesResult, centersResult, branchesResult] = await Promise.all([
      (admin as any)
        .from("expenses")
        .select("id, category, description, amount, expense_date, payment_method, status, notes, branches(name), cost_centers(name)")
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
        .neq("status", "void")
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
