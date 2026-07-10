/**
 * Treasury & statutory reports queries:
 *  - Receipt / Payment vouchers (سند قبض / سند صرف)
 *  - Accounts receivable aging & customer statements (أعمار الذمم المدينة)
 *  - Cash flow statement (تقرير التدفق النقدي)
 *  - Tax / VAT report (تقرير الضرائب)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { isDemoMode, withAdminScope, numberValue } from "./_shared/utils";

// ============================================================================
// 1) Voucher data (receipt & payment)
// ============================================================================

export type VoucherCashAccount = { id: string; code: string; name: string; systemKey?: string };
export type VoucherParty = { id: string; name: string };
export type VoucherInvoice = {
  id: string;
  number: string;
  partyName: string;
  total: number;
  balanceDue: number;
  issuedAt: string;
};
export type VoucherRecent = {
  id: string;
  entryNumber: string;
  entryDate: string;
  memo?: string;
  amount: number;
  kind: "receipt" | "payment";
};

export type VoucherAccount = { id: string; code: string; name: string; accountType: string };
export type VoucherData = {
  cashAccounts: VoucherCashAccount[];
  accounts: VoucherAccount[];
  suppliers: VoucherParty[];
  customers: VoucherParty[];
  payableInvoices: VoucherInvoice[];
  receivableInvoices: VoucherInvoice[];
  recentVouchers: VoucherRecent[];
};

const demoVoucherData: VoucherData = {
  cashAccounts: [
    { id: "acc-cash", code: "1000", name: "الصندوق", systemKey: "cash_on_hand" },
    { id: "acc-bank", code: "1020", name: "البنك", systemKey: "bank_card" },
  ],
  accounts: [
    { id: "acc-sales", code: "4100", name: "مبيعات", accountType: "revenue" },
    { id: "acc-exp", code: "6100", name: "مصروفات تشغيلية", accountType: "expense" },
  ],
  suppliers: [{ id: "sup-demo", name: "شركة الخليج للمواد الغذائية" }],
  customers: [{ id: "cust-demo", name: "عميل نقدي - صالة" }],
  payableInvoices: [
    { id: "inv-demo-1", number: "SUP-2026-0031", partyName: "شركة الخليج للمواد الغذائية", total: 1850, balanceDue: 1850, issuedAt: "2026-07-01" },
  ],
  receivableInvoices: [],
  recentVouchers: [
    { id: "je-demo-3", entryNumber: "JE-20260705-0004", entryDate: "2026-07-05", memo: "سند صرف مورد", amount: 500, kind: "payment" },
  ],
};

export async function getVoucherData(): Promise<VoucherData> {
  if (isDemoMode()) return demoVoucherData;

  return withAdminScope<VoucherData>(demoVoucherData, async (admin, scope) => {
    const [cashResult, accountsResult, supplierResult, customerResult, payableResult, receivableResult, recentResult] = await Promise.all([
      (admin as any)
        .from("chart_of_accounts")
        .select("id, code, name, system_key")
        .eq("organization_id", scope.organizationId)
        .eq("is_active", true)
        .in("system_key", ["cash_on_hand", "bank_card"])
        .order("code"),
      (admin as any)
        .from("chart_of_accounts")
        .select("id, code, name, account_type")
        .eq("organization_id", scope.organizationId)
        .eq("is_active", true)
        .in("account_type", ["revenue", "expense", "cogs"])
        .order("code"),
      (admin as any)
        .from("suppliers")
        .select("id, name")
        .eq("organization_id", scope.organizationId)
        .eq("status", "active")
        .order("name"),
      (admin as any)
        .from("customer_invoices")
        .select("customer_name")
        .eq("organization_id", scope.organizationId)
        .not("customer_name", "is", null),
      (admin as any)
        .from("invoices")
        .select("id, invoice_number, total, paid_amount, balance_due, issued_at, status, suppliers(name)")
        .eq("organization_id", scope.organizationId)
        .in("status", ["posted", "partially_paid", "matched"])
        .gt("balance_due", 0)
        .order("issued_at", { ascending: false })
        .limit(50),
      (admin as any)
        .from("customer_invoices")
        .select("id, invoice_number, total, issued_at, status, customer_name")
        .eq("organization_id", scope.organizationId)
        .eq("status", "unpaid")
        .order("issued_at", { ascending: false })
        .limit(50),
      (admin as any)
        .from("journal_entries")
        .select("id, entry_number, entry_date, memo, source_doc_type, journal_lines(debit)")
        .eq("organization_id", scope.organizationId)
        .in("source_doc_type", ["receipt_voucher", "payment_voucher"])
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    const customersMap = new Map<string, string>();
    for (const row of customerResult.data ?? []) {
      if (row.customer_name) customersMap.set(row.customer_name, row.customer_name);
    }

    return {
      cashAccounts: (cashResult.data ?? []).map((a: any) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        systemKey: a.system_key ?? undefined,
      })),
      accounts: (accountsResult.data ?? []).map((a: any) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        accountType: a.account_type,
      })),
      suppliers: (supplierResult.data ?? []).map((s: any) => ({ id: s.id, name: s.name })),
      customers: Array.from(customersMap.values()).map((name) => ({ id: name, name })),
      payableInvoices: (payableResult.data ?? []).map((inv: any) => ({
        id: inv.id,
        number: inv.invoice_number ?? "بدون رقم",
        partyName: inv.suppliers?.name ?? "مورد غير معروف",
        total: numberValue(inv.total),
        balanceDue: numberValue(inv.balance_due),
        issuedAt: inv.issued_at ?? "",
      })),
      receivableInvoices: (receivableResult.data ?? []).map((inv: any) => ({
        id: inv.id,
        number: inv.invoice_number ?? "بدون رقم",
        partyName: inv.customer_name ?? "عميل غير معروف",
        total: numberValue(inv.total),
        balanceDue: numberValue(inv.total),
        issuedAt: inv.issued_at ?? "",
      })),
      recentVouchers: (recentResult.data ?? []).map((entry: any) => ({
        id: entry.id,
        entryNumber: entry.entry_number,
        entryDate: entry.entry_date,
        memo: entry.memo ?? undefined,
        amount: (entry.journal_lines ?? []).reduce((sum: number, l: any) => sum + numberValue(l.debit), 0),
        kind: entry.source_doc_type === "receipt_voucher" ? "receipt" : "payment",
      })),
    };
  });
}

// ============================================================================
// 2) Accounts receivable aging & customer statements
// ============================================================================

export type AgingBucketKey = "current" | "d1_30" | "d31_60" | "d61_90" | "d90plus";

export type ReceivableRow = {
  date: string;
  docNumber: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export type CustomerStatement = {
  id: string;
  name: string;
  rows: ReceivableRow[];
  balance: number;
};

export type ReceivablesData = {
  totalReceivable: number;
  agingTotals: Record<AgingBucketKey, number>;
  customers: Array<{ id: string; name: string; totalInvoiced: number; totalPaid: number; balance: number; openInvoices: number }>;
  openInvoices: Array<{ id: string; invoiceNumber: string; customerName: string; dueDate: string; balanceDue: number; bucket: AgingBucketKey }>;
  selectedCustomer?: CustomerStatement;
};

function ageBucket(issuedAt: string, asOf: string): AgingBucketKey {
  const issued = new Date(issuedAt).getTime();
  const now = new Date(asOf).getTime();
  const days = Math.floor((now - issued) / 86_400_000);
  if (days <= 30) return "current";
  if (days <= 60) return "d1_30";
  if (days <= 90) return "d31_60";
  if (days <= 120) return "d61_90";
  return "d90plus";
}

const demoReceivables: ReceivablesData = {
  totalReceivable: 0,
  agingTotals: { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 },
  customers: [],
  openInvoices: [],
};

export async function getReceivablesData(customerId?: string): Promise<ReceivablesData> {
  if (isDemoMode()) return demoReceivables;

  return withAdminScope<ReceivablesData>(demoReceivables, async (admin, scope) => {
    const asOf = new Date().toISOString().slice(0, 10);

    let query = (admin as any)
      .from("customer_invoices")
      .select("id, invoice_number, customer_name, total, issued_at, status")
      .eq("organization_id", scope.organizationId)
      .neq("status", "void")
      .neq("status", "cancelled")
      .neq("status", "paid");
    if (customerId) query = query.eq("customer_name", customerId);

    const { data: invoiceRows, error } = await query.order("issued_at", { ascending: false });
    if (error) throw new Error(error.message);

    const openInvoices: Array<{ id: string; invoiceNumber: string; customerName: string; dueDate: string; balanceDue: number; bucket: AgingBucketKey }> = (invoiceRows ?? []).map((inv: any) => {
      const bucket = ageBucket(inv.issued_at ?? asOf, asOf);
      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number ?? "بدون رقم",
        customerName: inv.customer_name ?? "عميل غير معروف",
        dueDate: inv.issued_at ?? "",
        balanceDue: numberValue(inv.total),
        bucket: bucket as AgingBucketKey,
      };
    });

    const agingTotals: Record<AgingBucketKey, number> = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
    const customerAgg = new Map<string, { totalInvoiced: number; totalPaid: number; balance: number; openInvoices: number }>();
    for (const inv of openInvoices) {
      agingTotals[inv.bucket as AgingBucketKey] += inv.balanceDue;
      const cur = customerAgg.get(inv.customerName) ?? { totalInvoiced: 0, totalPaid: 0, balance: 0, openInvoices: 0 };
      cur.totalInvoiced += inv.balanceDue;
      cur.balance += inv.balanceDue;
      cur.openInvoices += 1;
      customerAgg.set(inv.customerName, cur);
    }

    const customers = Array.from(customerAgg.entries()).map(([name, agg]) => ({
      id: name,
      name,
      ...agg,
    }));

    const totalReceivable = openInvoices.reduce((sum, inv) => sum + inv.balanceDue, 0);

    const selectedRows: ReceivableRow[] = customerId
      ? openInvoices
          .filter((inv) => inv.customerName === customerId)
          .map((inv) => ({
            date: inv.dueDate,
            docNumber: inv.invoiceNumber,
            description: "فاتورة مبيعات غير محصلة",
            debit: inv.balanceDue,
            credit: 0,
            balance: inv.balanceDue,
          }))
      : [];
    const selectedBalance = selectedRows.reduce((sum, row) => sum + row.debit, 0);

    return {
      totalReceivable,
      agingTotals,
      customers,
      openInvoices,
      selectedCustomer: customerId
        ? { id: customerId, name: customerId, rows: selectedRows, balance: selectedBalance }
        : undefined,
    };
  });
}

// ============================================================================
// 3) Cash flow statement
// ============================================================================

export type CashFlowData = {
  from: string;
  to: string;
  openingCash: number;
  closingCash: number;
  netChange: number;
  operatingIn: number;
  operatingOut: number;
  investingIn: number;
  investingOut: number;
  financingIn: number;
  financingOut: number;
};

const demoCashFlow: CashFlowData = {
  from: "",
  to: "",
  openingCash: 0,
  closingCash: 0,
  netChange: 0,
  operatingIn: 0,
  operatingOut: 0,
  investingIn: 0,
  investingOut: 0,
  financingIn: 0,
  financingOut: 0,
};

function classifyCounterpartFlow(systemKey: string | null, accountType: string): "operating" | "investing" | "financing" {
  // Current operating assets/liabilities
  if (systemKey && [
    "accounts_receivable", 
    "inventory", 
    "accounts_payable", 
    "tax_payable", 
    "output_tax_payable", 
    "input_tax_recoverable"
  ].includes(systemKey)) {
    return "operating";
  }
  if (accountType === "revenue" || accountType === "expense") {
    return "operating";
  }
  if (accountType === "asset") {
    return "investing";
  }
  if (accountType === "equity" || accountType === "liability") {
    return "financing";
  }
  return "operating";
}

export async function getCashFlowData(from?: string, to?: string): Promise<CashFlowData> {
  if (isDemoMode()) return demoCashFlow;

  return withAdminScope<CashFlowData>(demoCashFlow, async (admin, scope) => {
    const today = new Date().toISOString().slice(0, 10);
    const toDate = to || today;
    const fromDate = from || `${today.slice(0, 7)}-01`;

    // 1. Get all journal entry IDs that touch cash during this period
    const { data: cashEntries, error: entryError } = await (admin as any)
      .from("journal_lines")
      .select("journal_entry_id, journal_entries!inner(entry_date, status), chart_of_accounts!inner(system_key)")
      .eq("organization_id", scope.organizationId)
      .eq("journal_entries.status", "posted")
      .in("chart_of_accounts.system_key", ["cash_on_hand", "bank_card"])
      .gte("journal_entries.entry_date", fromDate)
      .lte("journal_entries.entry_date", toDate);

    if (entryError) throw new Error(entryError.message);

    const entryIds = Array.from(new Set((cashEntries ?? []).map((l: any) => l.journal_entry_id).filter(Boolean)));

    const data: CashFlowData = {
      from: fromDate,
      to: toDate,
      openingCash: 0,
      closingCash: 0,
      netChange: 0,
      operatingIn: 0,
      operatingOut: 0,
      investingIn: 0,
      investingOut: 0,
      financingIn: 0,
      financingOut: 0,
    };

    if (entryIds.length === 0) {
      return data;
    }

    // 2. Fetch all lines for these journal entries to determine counterparts
    const { data: allLines, error: linesError } = await (admin as any)
      .from("journal_lines")
      .select("journal_entry_id, debit, credit, chart_of_accounts(account_type, system_key)")
      .eq("organization_id", scope.organizationId)
      .in("journal_entry_id", entryIds);

    if (linesError) throw new Error(linesError.message);

    // Group lines by journal entry
    const linesByEntry = new Map<string, any[]>();
    for (const line of allLines ?? []) {
      const entryId = line.journal_entry_id;
      if (!linesByEntry.has(entryId)) {
        linesByEntry.set(entryId, []);
      }
      linesByEntry.get(entryId)!.push(line);
    }

    // Process each journal entry
    for (const [_, entryLines] of linesByEntry.entries()) {
      const cashLines = entryLines.filter(l => 
        l.chart_of_accounts && ["cash_on_hand", "bank_card"].includes(l.chart_of_accounts.system_key)
      );
      const counterpartLines = entryLines.filter(l => 
        !l.chart_of_accounts || !["cash_on_hand", "bank_card"].includes(l.chart_of_accounts.system_key)
      );

      const netCashChange = cashLines.reduce((sum, l) => sum + numberValue(l.debit) - numberValue(l.credit), 0);
      if (Math.abs(netCashChange) < 0.001) continue;

      data.netChange += netCashChange;

      if (netCashChange > 0) {
        // Cash entered: look at credit counterpart lines
        const totalCredits = counterpartLines.reduce((sum, l) => sum + numberValue(l.credit), 0);
        for (const line of counterpartLines) {
          const credit = numberValue(line.credit);
          if (credit > 0) {
            const systemKey = line.chart_of_accounts?.system_key || null;
            const accountType = line.chart_of_accounts?.account_type || "revenue";
            const flow = classifyCounterpartFlow(systemKey, accountType);
            const proportionalCash = (credit / (totalCredits || 1)) * netCashChange;

            if (flow === "operating") data.operatingIn += proportionalCash;
            else if (flow === "investing") data.investingIn += proportionalCash;
            else if (flow === "financing") data.financingIn += proportionalCash;
          }
        }
      } else {
        // Cash left: look at debit counterpart lines
        const totalDebits = counterpartLines.reduce((sum, l) => sum + numberValue(l.debit), 0);
        const absCashChange = Math.abs(netCashChange);
        for (const line of counterpartLines) {
          const debit = numberValue(line.debit);
          if (debit > 0) {
            const systemKey = line.chart_of_accounts?.system_key || null;
            const accountType = line.chart_of_accounts?.account_type || "expense";
            const flow = classifyCounterpartFlow(systemKey, accountType);
            const proportionalCash = (debit / (totalDebits || 1)) * absCashChange;

            if (flow === "operating") data.operatingOut += proportionalCash;
            else if (flow === "investing") data.investingOut += proportionalCash;
            else if (flow === "financing") data.financingOut += proportionalCash;
          }
        }
      }
    }

    // Round the results to 2 decimal places
    data.netChange = Math.round(data.netChange * 100) / 100;
    data.operatingIn = Math.round(data.operatingIn * 100) / 100;
    data.operatingOut = Math.round(data.operatingOut * 100) / 100;
    data.investingIn = Math.round(data.investingIn * 100) / 100;
    data.investingOut = Math.round(data.investingOut * 100) / 100;
    data.financingIn = Math.round(data.financingIn * 100) / 100;
    data.financingOut = Math.round(data.financingOut * 100) / 100;

    return data;
  });
}

// ============================================================================
// 4) Tax / VAT report
// ============================================================================

export type TaxReportData = {
  from: string;
  to: string;
  outputTax: number;
  inputTax: number;
  netTax: number;
  salesTotal: number;
  purchaseTotal: number;
};

const demoTax: TaxReportData = {
  from: "",
  to: "",
  outputTax: 0,
  inputTax: 0,
  netTax: 0,
  salesTotal: 0,
  purchaseTotal: 0,
};

export async function getTaxReportData(from?: string, to?: string): Promise<TaxReportData> {
  if (isDemoMode()) return demoTax;

  return withAdminScope<TaxReportData>(demoTax, async (admin, scope) => {
    const today = new Date().toISOString().slice(0, 10);
    const toDate = to || today;
    const fromDate = from || `${today.slice(0, 7)}-01`;

    const [outputResult, inputResult, salesResult, purchaseResult] = await Promise.all([
      (admin as any)
        .from("journal_lines")
        .select("credit")
        .eq("organization_id", scope.organizationId)
        .eq("journal_entries.status", "posted")
        .eq("chart_of_accounts.system_key", "output_tax_payable")
        .gte("journal_entries.entry_date", fromDate)
        .lte("journal_entries.entry_date", toDate),
      (admin as any)
        .from("journal_lines")
        .select("debit")
        .eq("organization_id", scope.organizationId)
        .eq("journal_entries.status", "posted")
        .eq("chart_of_accounts.system_key", "input_tax_recoverable")
        .gte("journal_entries.entry_date", fromDate)
        .lte("journal_entries.entry_date", toDate),
      (admin as any)
        .from("customer_invoices")
        .select("total, tax_total")
        .eq("organization_id", scope.organizationId)
        .eq("status", "paid")
        .gte("issued_at", `${fromDate}T00:00:00.000Z`)
        .lte("issued_at", `${toDate}T23:59:59.999Z`),
      (admin as any)
        .from("invoices")
        .select("total")
        .eq("organization_id", scope.organizationId)
        .in("status", ["posted", "partially_paid", "matched"])
        .gte("issued_at", `${fromDate}T00:00:00.000Z`)
        .lte("issued_at", `${toDate}T23:59:59.999Z`),
    ]);

    const outputTax = (outputResult.data ?? []).reduce((s: number, l: any) => s + numberValue(l.credit), 0);
    const inputTax = (inputResult.data ?? []).reduce((s: number, l: any) => s + numberValue(l.debit), 0);
    const salesTotal = (salesResult.data ?? []).reduce((s: number, inv: any) => s + numberValue(inv.tax_total ?? inv.total), 0);
    const purchaseTotal = (purchaseResult.data ?? []).reduce((s: number, inv: any) => s + numberValue(inv.total), 0);

    return {
      from: fromDate,
      to: toDate,
      outputTax,
      inputTax,
      netTax: outputTax - inputTax,
      salesTotal,
      purchaseTotal,
    };
  });
}
