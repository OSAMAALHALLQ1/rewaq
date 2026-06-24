import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

type PaymentMethod = "cash" | "card" | "bank_transfer" | "delivery_app";

type CustomerInvoicePostingInput = {
  organizationId: string;
  branchId: string;
  invoiceId: string;
  invoiceNumber: string;
  paymentMethod: PaymentMethod;
  subtotal: number;
  taxTotal: number;
  total: number;
  costTotal: number;
  createdBy?: string | null;
};

type CashVariancePostingInput = {
  organizationId: string;
  branchId: string;
  shiftId: string;
  shiftLabel: string;
  difference: number;
  createdBy?: string | null;
};

type JournalLineDraft = {
  systemKey: string;
  debit?: number;
  credit?: number;
  memo: string;
};

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 10000) / 10000;
}

function cashAccountKey(paymentMethod: PaymentMethod) {
  return paymentMethod === "cash" ? "cash" : "bank";
}

async function nextJournalNumber(admin: AdminClient, organizationId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const compactDate = today.replaceAll("-", "");
  const { count, error } = await (admin as any)
    .from("journal_entries")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", `${today}T00:00:00.000Z`)
    .lt("created_at", `${today}T23:59:59.999Z`);

  if (error) throw new Error(error.message);

  return `JE-${compactDate}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

async function loadPostingAccounts(admin: AdminClient, organizationId: string, systemKeys: string[]) {
  await (admin as any).rpc("ensure_default_chart_accounts", { target_org_id: organizationId });

  const { data, error } = await (admin as any)
    .from("chart_of_accounts")
    .select("id, system_key")
    .eq("organization_id", organizationId)
    .in("system_key", systemKeys);

  if (error) throw new Error(error.message);

  const accounts = new Map<string, string>();
  for (const account of data ?? []) {
    if (account.system_key) {
      accounts.set(account.system_key, account.id);
    }
  }

  for (const key of systemKeys) {
    if (!accounts.has(key)) {
      throw new Error(`الحساب المحاسبي غير موجود: ${key}`);
    }
  }

  return accounts;
}

export async function postCustomerInvoiceJournal(admin: AdminClient, input: CustomerInvoicePostingInput) {
  const { data: existing, error: existingError } = await (admin as any)
    .from("journal_entries")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("source_doc_type", "customer_invoice")
    .eq("source_doc_id", input.invoiceId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing?.id) return existing.id as string;

  const lines: JournalLineDraft[] = [
    {
      systemKey: cashAccountKey(input.paymentMethod),
      debit: roundMoney(input.total),
      memo: `تحصيل فاتورة ${input.invoiceNumber}`,
    },
    {
      systemKey: "sales_revenue",
      credit: roundMoney(input.subtotal),
      memo: `مبيعات فاتورة ${input.invoiceNumber}`,
    },
  ];

  if (roundMoney(input.taxTotal) > 0) {
    lines.push({
      systemKey: "sales_tax_payable",
      credit: roundMoney(input.taxTotal),
      memo: `ضريبة فاتورة ${input.invoiceNumber}`,
    });
  }

  if (roundMoney(input.costTotal) > 0) {
    lines.push(
      {
        systemKey: "cogs",
        debit: roundMoney(input.costTotal),
        memo: `تكلفة بضاعة فاتورة ${input.invoiceNumber}`,
      },
      {
        systemKey: "inventory",
        credit: roundMoney(input.costTotal),
        memo: `خصم مخزون فاتورة ${input.invoiceNumber}`,
      },
    );
  }

  const debitTotal = roundMoney(lines.reduce((sum, line) => sum + (line.debit ?? 0), 0));
  const creditTotal = roundMoney(lines.reduce((sum, line) => sum + (line.credit ?? 0), 0));

  if (debitTotal !== creditTotal) {
    throw new Error(`القيد غير متوازن: مدين ${debitTotal} / دائن ${creditTotal}`);
  }

  const accounts = await loadPostingAccounts(
    admin,
    input.organizationId,
    Array.from(new Set(lines.map((line) => line.systemKey))),
  );
  const entryNumber = await nextJournalNumber(admin, input.organizationId);

  const { data: entry, error: entryError } = await (admin as any)
    .from("journal_entries")
    .insert({
      organization_id: input.organizationId,
      branch_id: input.branchId,
      entry_number: entryNumber,
      entry_date: new Date().toISOString().slice(0, 10),
      source_doc_type: "customer_invoice",
      source_doc_id: input.invoiceId,
      memo: `قيد تلقائي لفاتورة كاشير ${input.invoiceNumber}`,
      status: "posted",
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (entryError || !entry) throw new Error(entryError?.message ?? "تعذر إنشاء القيد المحاسبي.");

  const { error: lineError } = await (admin as any).from("journal_lines").insert(
    lines.map((line) => ({
      organization_id: input.organizationId,
      journal_entry_id: entry.id,
      account_id: accounts.get(line.systemKey),
      branch_id: input.branchId,
      debit: roundMoney(line.debit ?? 0),
      credit: roundMoney(line.credit ?? 0),
      memo: line.memo,
    })),
  );

  if (lineError) throw new Error(lineError.message);

  return entry.id as string;
}

export async function postCashVarianceJournal(admin: AdminClient, input: CashVariancePostingInput) {
  const difference = roundMoney(input.difference);
  if (difference === 0) return null;

  const { data: existing, error: existingError } = await (admin as any)
    .from("journal_entries")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("source_doc_type", "sales_shift")
    .eq("source_doc_id", input.shiftId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing?.id) return existing.id as string;

  const amount = Math.abs(difference);
  const lines: JournalLineDraft[] =
    difference < 0
      ? [
          {
            systemKey: "cash_over_short",
            debit: amount,
            memo: `عجز صندوق وردية ${input.shiftLabel}`,
          },
          {
            systemKey: "cash",
            credit: amount,
            memo: `تسوية عجز صندوق وردية ${input.shiftLabel}`,
          },
        ]
      : [
          {
            systemKey: "cash",
            debit: amount,
            memo: `زيادة صندوق وردية ${input.shiftLabel}`,
          },
          {
            systemKey: "cash_over_short",
            credit: amount,
            memo: `تسوية زيادة صندوق وردية ${input.shiftLabel}`,
          },
        ];

  const accounts = await loadPostingAccounts(admin, input.organizationId, ["cash", "cash_over_short"]);
  const entryNumber = await nextJournalNumber(admin, input.organizationId);

  const { data: entry, error: entryError } = await (admin as any)
    .from("journal_entries")
    .insert({
      organization_id: input.organizationId,
      branch_id: input.branchId,
      entry_number: entryNumber,
      entry_date: new Date().toISOString().slice(0, 10),
      source_doc_type: "sales_shift",
      source_doc_id: input.shiftId,
      memo: `قيد فرق صندوق وردية ${input.shiftLabel}`,
      status: "posted",
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (entryError || !entry) throw new Error(entryError?.message ?? "تعذر إنشاء قيد فرق الصندوق.");

  const { error: lineError } = await (admin as any).from("journal_lines").insert(
    lines.map((line) => ({
      organization_id: input.organizationId,
      journal_entry_id: entry.id,
      account_id: accounts.get(line.systemKey),
      branch_id: input.branchId,
      debit: roundMoney(line.debit ?? 0),
      credit: roundMoney(line.credit ?? 0),
      memo: line.memo,
    })),
  );

  if (lineError) throw new Error(lineError.message);

  return entry.id as string;
}
