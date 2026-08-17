import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CostCenter,
  CostTrackingData,
  CostTrackingSection,
  FinancialCalendarDay,
  FinancialCalendarExpense,
} from "@/types/domain";
import {
  isDemoMode,
  numberValue,
  withAdminScope,
  type AdminClient,
  type AppScope,
} from "@/server/queries/_shared/utils";

type InsightFilter = { from: string; to: string; branchId?: string };

type AccountRow = {
  id: string;
  code: string;
  name: string;
  account_type: string;
  system_key: string | null;
};

type EntryRow = {
  id: string;
  branch_id: string | null;
  entry_date: string;
  source_doc_type: string | null;
};

type LineRow = {
  journal_entry_id: string;
  account_id: string;
  branch_id: string | null;
  cost_center_id: string | null;
  debit: number | string;
  credit: number | string;
  memo: string | null;
};

type BranchRow = { id: string; name: string };

type LedgerSlice = {
  accounts: AccountRow[];
  entries: EntryRow[];
  lines: LineRow[];
  branches: BranchRow[];
  costCenters: Array<{ id: string; name: string }>;
  effectiveBranchId?: string;
};

const emptyCostTracking: CostTrackingData = {
  date: "",
  branchName: "كل الأقسام",
  channelBreakdown: [],
  salesTotal: 0,
  expensesTotal: 0,
  netProfit: 0,
  profitMarginPercent: 0,
  sections: [],
  costCenters: [],
  smartInsights: [],
};

function assertBranchScope(scope: AppScope, requestedBranchId?: string) {
  if (scope.branchId && requestedBranchId && requestedBranchId !== scope.branchId) {
    throw new Error("لا يمكنك عرض بيانات قسم خارج نطاقك.");
  }
  return scope.branchId ?? requestedBranchId;
}

async function loadLedgerSlice(admin: AdminClient, scope: AppScope, filter: InsightFilter): Promise<LedgerSlice> {
  const effectiveBranchId = assertBranchScope(scope, filter.branchId);
  const db = admin as unknown as SupabaseClient;
  const [accountResult, entryResult, branchResult, centerResult] = await Promise.all([
    db
      .from("chart_of_accounts")
      .select("id, code, name, account_type, system_key")
      .eq("organization_id", scope.organizationId)
      .in("account_type", ["revenue", "cogs", "expense"]),
    db
      .from("journal_entries")
      .select("id, branch_id, entry_date, source_doc_type")
      .eq("organization_id", scope.organizationId)
      .eq("status", "posted")
      .gte("entry_date", filter.from)
      .lte("entry_date", filter.to)
      .or("source_doc_type.is.null,source_doc_type.neq.year_end_closing"),
    admin.from("branches").select("id, name").eq("organization_id", scope.organizationId).order("name"),
    db.from("cost_centers").select("id, name").eq("organization_id", scope.organizationId),
  ]);

  const firstError = [accountResult.error, entryResult.error, branchResult.error, centerResult.error].find(Boolean);
  if (firstError) throw new Error(firstError.message);

  const entries = (entryResult.data ?? []) as EntryRow[];
  if (entries.length === 0) {
    return {
      accounts: (accountResult.data ?? []) as AccountRow[],
      entries: [],
      lines: [],
      branches: (branchResult.data ?? []) as BranchRow[],
      costCenters: (centerResult.data ?? []) as Array<{ id: string; name: string }>,
      effectiveBranchId,
    };
  }

  const lineResult = await db
    .from("journal_lines")
    .select("journal_entry_id, account_id, branch_id, cost_center_id, debit, credit, memo")
    .eq("organization_id", scope.organizationId)
    .in("journal_entry_id", entries.map((entry) => entry.id));
  if (lineResult.error) throw new Error(lineResult.error.message);

  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
  const lines = ((lineResult.data ?? []) as LineRow[]).filter((line) => {
    if (!effectiveBranchId) return true;
    const entry = entryMap.get(line.journal_entry_id);
    return (line.branch_id ?? entry?.branch_id) === effectiveBranchId;
  });
  const usedEntryIds = new Set(lines.map((line) => line.journal_entry_id));

  return {
    accounts: (accountResult.data ?? []) as AccountRow[],
    entries: entries.filter((entry) => usedEntryIds.has(entry.id)),
    lines,
    branches: (branchResult.data ?? []) as BranchRow[],
    costCenters: (centerResult.data ?? []) as Array<{ id: string; name: string }>,
    effectiveBranchId,
  };
}

function accountBalance(account: AccountRow, line: LineRow) {
  return account.account_type === "revenue"
    ? numberValue(line.credit) - numberValue(line.debit)
    : numberValue(line.debit) - numberValue(line.credit);
}

function sectionForAccount(account: AccountRow): Pick<CostTrackingSection, "id" | "title" | "description"> {
  const key = `${account.system_key ?? ""} ${account.name}`.toLowerCase();
  if (account.account_type === "cogs" || key.includes("cogs") || key.includes("مواد") || key.includes("بضاعة")) {
    return { id: "raw-materials", title: "المواد الخام وتكلفة المبيعات", description: "تكلفة المكونات والبضاعة المباعة من القيود المرحلة." };
  }
  if (key.includes("salary") || key.includes("wage") || key.includes("رواتب") || key.includes("أجور")) {
    return { id: "labor", title: "الرواتب والأجور", description: "مصروفات العاملين المرحلة محاسبيًا." };
  }
  if (key.includes("waste") || key.includes("هدر") || key.includes("تالف") || key.includes("cash_over_short")) {
    return { id: "waste", title: "الهدر والفروقات", description: "الهدر وفروقات الجرد والصندوق المرحلة." };
  }
  if (key.includes("rent") || key.includes("إيجار") || key.includes("depreci") || key.includes("إهلاك")) {
    return { id: "fixed", title: "المصاريف الثابتة", description: "الإيجار والإهلاك والمصاريف الثابتة المرحلة." };
  }
  return { id: "operations", title: "المصاريف التشغيلية", description: "الكهرباء والمياه والصيانة والعمولات وبقية التشغيل." };
}

function buildSections(slice: LedgerSlice): CostTrackingSection[] {
  const accountMap = new Map(slice.accounts.map((account) => [account.id, account]));
  const buckets = new Map<string, CostTrackingSection>();
  for (const line of slice.lines) {
    const account = accountMap.get(line.account_id);
    if (!account || !["cogs", "expense"].includes(account.account_type)) continue;
    const amount = accountBalance(account, line);
    if (Math.abs(amount) < 0.0001) continue;
    const meta = sectionForAccount(account);
    const bucket = buckets.get(meta.id) ?? { ...meta, total: 0, lines: [] };
    bucket.total += amount;
    const existing = bucket.lines.find((item) => item.name === account.name);
    if (existing) existing.amount += amount;
    else bucket.lines.push({ name: account.name, amount, notes: line.memo ?? undefined });
    buckets.set(meta.id, bucket);
  }
  return ["raw-materials", "labor", "operations", "fixed", "waste"]
    .map((id) => buckets.get(id))
    .filter((section): section is CostTrackingSection => Boolean(section))
    .map((section) => ({ ...section, total: Math.round(section.total * 10000) / 10000 }));
}

function financialExpenseCategory(account: AccountRow): FinancialCalendarExpense["category"] {
  const section = sectionForAccount(account).id;
  if (section === "raw-materials") return "مواد خام";
  if (section === "labor") return "أجور";
  if (section === "fixed") return account.name.includes("إيجار") ? "إيجار" : "مصروفات أخرى";
  const key = `${account.system_key ?? ""} ${account.name}`.toLowerCase();
  if (key.includes("utility") || key.includes("كهرباء") || key.includes("مياه")) return "كهرباء وماء";
  if (key.includes("delivery") || key.includes("توصيل") || key.includes("عمولة")) return "توصيل";
  return "مصروفات أخرى";
}

function buildCostCenters(slice: LedgerSlice, salesTotal: number): CostCenter[] {
  const centerNames = new Map(slice.costCenters.map((center) => [center.id, center.name]));
  const accountMap = new Map(slice.accounts.map((account) => [account.id, account]));
  const totals = new Map<string, number>();
  for (const line of slice.lines) {
    if (!line.cost_center_id) continue;
    const account = accountMap.get(line.account_id);
    if (!account || !["cogs", "expense"].includes(account.account_type)) continue;
    totals.set(line.cost_center_id, (totals.get(line.cost_center_id) ?? 0) + accountBalance(account, line));
  }
  return [...totals.entries()].map(([id, amount]) => {
    const percent = salesTotal > 0 ? (amount / salesTotal) * 100 : 0;
    return {
      name: centerNames.get(id) ?? "مركز تكلفة غير مسمى",
      amount,
      percent,
      status: percent > 35 ? "danger" : percent > 20 ? "watch" : "healthy",
      notes: "من بنود القيود المرحلة المرتبطة بمركز التكلفة.",
    };
  });
}

async function loadChannelBreakdown(admin: AdminClient, scope: AppScope, filter: InsightFilter, effectiveBranchId?: string) {
  let invoiceQuery = admin
    .from("customer_invoices")
    .select("channel, total, cost_total, issued_at")
    .eq("organization_id", scope.organizationId)
    .neq("status", "draft")
    .neq("status", "void")
    .gte("issued_at", `${filter.from}T00:00:00`)
    .lte("issued_at", `${filter.to}T23:59:59.999`);
  if (effectiveBranchId) invoiceQuery = invoiceQuery.eq("branch_id", effectiveBranchId);
  const result = await invoiceQuery;
  if (result.error) throw new Error(result.error.message);
  const labels = { dine_in: "الصالة", delivery: "الدليفري", pickup: "الاستلام" } as const;
  const buckets = new Map<string, { orders: number; revenue: number; directCost: number }>();
  for (const invoice of result.data ?? []) {
    const channel = labels[invoice.channel as keyof typeof labels] ?? "الاستلام";
    const current = buckets.get(channel) ?? { orders: 0, revenue: 0, directCost: 0 };
    current.orders += 1;
    current.revenue += numberValue(invoice.total);
    current.directCost += numberValue(invoice.cost_total);
    buckets.set(channel, current);
  }
  return [...buckets.entries()].map(([channel, values]) => ({
    channel: channel as "الصالة" | "الدليفري" | "الاستلام",
    ...values,
    profit: values.revenue - values.directCost,
  }));
}

export async function getAmwaliInsights(filter: InsightFilter): Promise<{ costTracking: CostTrackingData; branches: BranchRow[] }> {
  if (isDemoMode()) return { costTracking: { ...emptyCostTracking, date: filter.to }, branches: [] };
  return withAdminScope<{ costTracking: CostTrackingData; branches: BranchRow[] }>({ costTracking: { ...emptyCostTracking, date: filter.to }, branches: [] }, async (admin, scope) => {
    const slice = await loadLedgerSlice(admin, scope, filter);
    const accountMap = new Map(slice.accounts.map((account) => [account.id, account]));
    let salesTotal = 0;
    let expensesTotal = 0;
    for (const line of slice.lines) {
      const account = accountMap.get(line.account_id);
      if (!account) continue;
      const amount = accountBalance(account, line);
      if (account.account_type === "revenue") salesTotal += amount;
      if (["cogs", "expense"].includes(account.account_type)) expensesTotal += amount;
    }
    const netProfit = salesTotal - expensesTotal;
    const sections = buildSections(slice);
    const channelBreakdown = await loadChannelBreakdown(admin, scope, filter, slice.effectiveBranchId);
    const branchName = slice.effectiveBranchId
      ? slice.branches.find((branch) => branch.id === slice.effectiveBranchId)?.name ?? "قسم غير معروف"
      : "كل الأقسام";
    const materials = sections.find((section) => section.id === "raw-materials")?.total ?? 0;
    const waste = sections.find((section) => section.id === "waste")?.total ?? 0;
    return {
      branches: scope.branchId ? slice.branches.filter((branch) => branch.id === scope.branchId) : slice.branches,
      costTracking: {
        date: filter.to,
        branchName,
        channelBreakdown,
        salesTotal,
        expensesTotal,
        netProfit,
        profitMarginPercent: salesTotal > 0 ? (netProfit / salesTotal) * 100 : 0,
        sections,
        costCenters: buildCostCenters(slice, salesTotal),
        smartInsights: [
          { title: "تكلفة المواد", value: salesTotal > 0 ? `${((materials / salesTotal) * 100).toFixed(1)}%` : "0%", notes: "من الإيراد المرحل للفترة المختارة.", tone: materials > salesTotal * 0.35 ? "danger" : "success" },
          { title: "الهدر والفروقات", value: waste.toFixed(2), notes: "من حسابات الهدر وفروقات الجرد والصندوق.", tone: waste > 0 ? "warning" : "success" },
          { title: "صافي الربح", value: netProfit.toFixed(2), notes: "الإيرادات ناقص تكلفة المبيعات والمصروفات من القيود المرحلة فقط.", tone: netProfit >= 0 ? "success" : "danger" },
        ],
      },
    };
  });
}

export async function getFinancialCalendarInsights(filter: InsightFilter): Promise<{ days: FinancialCalendarDay[]; branches: BranchRow[] }> {
  if (isDemoMode()) return { days: [], branches: [] };
  return withAdminScope<{ days: FinancialCalendarDay[]; branches: BranchRow[] }>({ days: [], branches: [] }, async (admin, scope) => {
    const slice = await loadLedgerSlice(admin, scope, filter);
    const accountMap = new Map(slice.accounts.map((account) => [account.id, account]));
    const entryMap = new Map(slice.entries.map((entry) => [entry.id, entry]));
    const branchMap = new Map(slice.branches.map((branch) => [branch.id, branch.name]));
    const dayMap = new Map<string, FinancialCalendarDay>();

    for (const line of slice.lines) {
      const entry = entryMap.get(line.journal_entry_id);
      const account = accountMap.get(line.account_id);
      if (!entry || !account) continue;
      const branchId = slice.effectiveBranchId ? (line.branch_id ?? entry.branch_id ?? slice.effectiveBranchId) : undefined;
      const key = `${entry.entry_date}:${branchId ?? "all"}`;
      const day = dayMap.get(key) ?? {
        date: entry.entry_date,
        branchId: branchId ?? undefined,
        branchName: branchId ? branchMap.get(branchId) ?? "قسم غير معروف" : "كل الأقسام",
        salesTotal: 0,
        expensesTotal: 0,
        netProfit: 0,
        cashSales: 0,
        cardSales: 0,
        sales: [],
        expenses: [],
        status: "balanced" as const,
      };
      const amount = accountBalance(account, line);
      if (account.account_type === "revenue") day.salesTotal += amount;
      if (["cogs", "expense"].includes(account.account_type)) {
        day.expensesTotal += amount;
        const category = financialExpenseCategory(account);
        const existing = day.expenses.find((expense) => expense.category === category);
        if (existing) existing.amount += amount;
        else day.expenses.push({ category, amount, notes: "من القيود المرحلة" });
      }
      dayMap.set(key, day);
    }

    let invoiceQuery = admin
      .from("customer_invoices")
      .select("id, branch_id, issued_at, payment_method, total")
      .eq("organization_id", scope.organizationId)
      .neq("status", "draft")
      .neq("status", "void")
      .gte("issued_at", `${filter.from}T00:00:00`)
      .lte("issued_at", `${filter.to}T23:59:59.999`);
    if (slice.effectiveBranchId) invoiceQuery = invoiceQuery.eq("branch_id", slice.effectiveBranchId);
    const invoiceResult = await invoiceQuery;
    if (invoiceResult.error) throw new Error(invoiceResult.error.message);
    const invoices = invoiceResult.data ?? [];
    for (const invoice of invoices) {
      const key = `${invoice.issued_at.slice(0, 10)}:${slice.effectiveBranchId ? (invoice.branch_id ?? "all") : "all"}`;
      const day = dayMap.get(key);
      if (!day) continue;
      if (invoice.payment_method === "cash") day.cashSales += numberValue(invoice.total);
      else day.cardSales += numberValue(invoice.total);
    }
    const invoiceIds = invoices.map((invoice) => invoice.id);
    const itemResult = invoiceIds.length > 0
      ? await admin.from("customer_invoice_items").select("customer_invoice_id, name, quantity, total").eq("organization_id", scope.organizationId).in("customer_invoice_id", invoiceIds)
      : { data: [], error: null };
    if (itemResult.error) throw new Error(itemResult.error.message);
    const invoiceMap = new Map(invoices.map((invoice) => [invoice.id, invoice]));
    for (const item of itemResult.data ?? []) {
      const invoice = invoiceMap.get(item.customer_invoice_id);
      if (!invoice) continue;
      const date = invoice.issued_at.slice(0, 10);
      const key = `${date}:${slice.effectiveBranchId ? (invoice.branch_id ?? "all") : "all"}`;
      const day = dayMap.get(key);
      if (!day) continue;
      const existing = day.sales.find((sale) => sale.itemName === item.name);
      if (existing) {
        existing.quantity += numberValue(item.quantity);
        existing.revenue += numberValue(item.total);
      } else {
        day.sales.push({ itemName: item.name, quantity: numberValue(item.quantity), revenue: numberValue(item.total) });
      }
    }

    const days = [...dayMap.values()].map((day) => {
      day.netProfit = day.salesTotal - day.expensesTotal;
      day.status = day.netProfit > 0.0001 ? "profit" : day.netProfit < -0.0001 ? "loss" : "balanced";
      return day;
    }).sort((a, b) => a.date.localeCompare(b.date));
    return {
      days,
      branches: scope.branchId ? slice.branches.filter((branch) => branch.id === scope.branchId) : slice.branches,
    };
  });
}
