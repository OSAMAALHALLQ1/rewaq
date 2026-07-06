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

type SupplierInvoicePostingInput = {
  organizationId: string;
  branchId: string;
  invoiceId: string;
  invoiceNumber: string;
  total: number;
  createdBy?: string | null;
};

type PurchaseReceiptPostingInput = {
  organizationId: string;
  branchId: string;
  purchaseOrderId: string;
  orderLabel: string;
  total: number;
  createdBy?: string | null;
};

type InventoryWriteOffPostingInput = {
  organizationId: string;
  branchId: string;
  sourceDocType: "waste_log" | "inventory_adjustment";
  sourceDocId: string;
  label: string;
  totalCost: number;
  createdBy?: string | null;
};

type JournalLineDraft = {
  systemKey: string;
  debit?: number;
  credit?: number;
  memo: string;
};

type BalancedJournalInput = {
  organizationId: string;
  branchId: string | null;
  sourceDocType: string;
  sourceDocId: string;
  memo: string;
  createdBy?: string | null;
  lines: JournalLineDraft[];
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

async function postBalancedJournal(admin: AdminClient, input: BalancedJournalInput) {
  const { data: existing, error: existingError } = await (admin as any)
    .from("journal_entries")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("source_doc_type", input.sourceDocType)
    .eq("source_doc_id", input.sourceDocId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing?.id) return existing.id as string;

  const debitTotal = roundMoney(input.lines.reduce((sum, line) => sum + (line.debit ?? 0), 0));
  const creditTotal = roundMoney(input.lines.reduce((sum, line) => sum + (line.credit ?? 0), 0));

  if (debitTotal <= 0 || creditTotal <= 0) {
    throw new Error("لا يمكن إنشاء قيد محاسبي بقيمة صفرية.");
  }

  if (debitTotal !== creditTotal) {
    throw new Error(`القيد غير متوازن: مدين ${debitTotal} / دائن ${creditTotal}`);
  }

  const accounts = await loadPostingAccounts(
    admin,
    input.organizationId,
    Array.from(new Set(input.lines.map((line) => line.systemKey))),
  );
  const entryNumber = await nextJournalNumber(admin, input.organizationId);

  const { data: entry, error: entryError } = await (admin as any)
    .from("journal_entries")
    .insert({
      organization_id: input.organizationId,
      branch_id: input.branchId || null,
      entry_number: entryNumber,
      entry_date: new Date().toISOString().slice(0, 10),
      source_doc_type: input.sourceDocType,
      source_doc_id: input.sourceDocId,
      memo: input.memo,
      status: "posted",
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (entryError || !entry) throw new Error(entryError?.message ?? "تعذر إنشاء القيد المحاسبي.");

  const { error: lineError } = await (admin as any).from("journal_lines").insert(
    input.lines.map((line) => ({
      organization_id: input.organizationId,
      journal_entry_id: entry.id,
      account_id: accounts.get(line.systemKey),
      branch_id: input.branchId || null,
      debit: roundMoney(line.debit ?? 0),
      credit: roundMoney(line.credit ?? 0),
      memo: line.memo,
    })),
  );

  if (lineError) throw new Error(lineError.message);

  return entry.id as string;
}

export async function postCustomerInvoiceJournal(admin: AdminClient, input: CustomerInvoicePostingInput) {
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

  return postBalancedJournal(admin, {
    organizationId: input.organizationId,
    branchId: input.branchId,
    sourceDocType: "customer_invoice",
    sourceDocId: input.invoiceId,
    memo: `قيد تلقائي لفاتورة كاشير ${input.invoiceNumber}`,
    createdBy: input.createdBy,
    lines,
  });
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

  return postBalancedJournal(admin, {
    organizationId: input.organizationId,
    branchId: input.branchId,
    sourceDocType: "sales_shift",
    sourceDocId: input.shiftId,
    memo: `قيد فرق صندوق وردية ${input.shiftLabel}`,
    createdBy: input.createdBy,
    lines,
  });
}

export async function postSupplierInvoiceJournal(admin: AdminClient, input: SupplierInvoicePostingInput) {
  const total = roundMoney(input.total);
  if (total <= 0) return null;

  return postBalancedJournal(admin, {
    organizationId: input.organizationId,
    branchId: input.branchId,
    sourceDocType: "supplier_invoice",
    sourceDocId: input.invoiceId,
    memo: `قيد تلقائي لفاتورة مورد ${input.invoiceNumber}`,
    createdBy: input.createdBy,
    lines: [
      {
        systemKey: "inventory",
        debit: total,
        memo: `إدخال مخزون فاتورة مورد ${input.invoiceNumber}`,
      },
      {
        systemKey: "accounts_payable",
        credit: total,
        memo: `ذمم موردين فاتورة ${input.invoiceNumber}`,
      },
    ],
  });
}

export async function postPurchaseReceiptJournal(admin: AdminClient, input: PurchaseReceiptPostingInput) {
  const total = roundMoney(input.total);
  if (total <= 0) return null;

  return postBalancedJournal(admin, {
    organizationId: input.organizationId,
    branchId: input.branchId,
    sourceDocType: "purchase_receipt",
    sourceDocId: input.purchaseOrderId,
    memo: `قيد استلام طلب شراء ${input.orderLabel}`,
    createdBy: input.createdBy,
    lines: [
      {
        systemKey: "inventory",
        debit: total,
        memo: `استلام مخزون طلب شراء ${input.orderLabel}`,
      },
      {
        systemKey: "goods_received_not_invoiced",
        credit: total,
        memo: `بضاعة مستلمة غير مفوترة ${input.orderLabel}`,
      },
    ],
  });
}

type ExpensePostingInput = {
  organizationId: string;
  branchId: string | null;
  expenseId: string;
  category: string;
  amount: number;
  paymentMethod: "cash" | "bank";
  costCenterId?: string | null;
  createdBy?: string | null;
};

export async function postExpenseJournal(admin: AdminClient, input: ExpensePostingInput) {
  const amount = roundMoney(input.amount);
  if (amount <= 0) return null;

  const entryId = await postBalancedJournal(admin, {
    organizationId: input.organizationId,
    branchId: input.branchId,
    sourceDocType: "expense",
    sourceDocId: input.expenseId,
    memo: `قيد مصروف: ${input.category}`,
    createdBy: input.createdBy,
    lines: [
      {
        systemKey: "operating_expense",
        debit: amount,
        memo: `مصروف ${input.category}`,
      },
      {
        systemKey: input.paymentMethod === "cash" ? "cash" : "bank",
        credit: amount,
        memo: `سداد مصروف ${input.category}`,
      },
    ],
  });

  if (input.costCenterId) {
    await (admin as any)
      .from("journal_lines")
      .update({ cost_center_id: input.costCenterId })
      .eq("journal_entry_id", entryId)
      .eq("organization_id", input.organizationId);
  }

  return entryId;
}

type ReverseJournalInput = {
  organizationId: string;
  entryId: string;
  reason: string;
  createdBy?: string | null;
};

/**
 * Creates a reversal entry (never deletes): each debit becomes a credit and
 * vice versa. Idempotent via the (source_doc_type, source_doc_id) uniqueness.
 */
export async function reverseJournalEntry(admin: AdminClient, input: ReverseJournalInput) {
  const { data: original, error: originalError } = await (admin as any)
    .from("journal_entries")
    .select("id, entry_number, branch_id, status, source_doc_type, reversal_of_entry_id, journal_lines(account_id, debit, credit, memo, cost_center_id)")
    .eq("organization_id", input.organizationId)
    .eq("id", input.entryId)
    .maybeSingle();

  if (originalError) throw new Error(originalError.message);
  if (!original) throw new Error("القيد المطلوب عكسه غير موجود.");
  if (original.reversal_of_entry_id) throw new Error("لا يمكن عكس قيد هو نفسه قيد عكسي.");
  if (original.source_doc_type === "journal_reversal") throw new Error("لا يمكن عكس قيد عكسي.");

  const { data: existingReversal } = await (admin as any)
    .from("journal_entries")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("source_doc_type", "journal_reversal")
    .eq("source_doc_id", input.entryId)
    .maybeSingle();

  if (existingReversal?.id) throw new Error("هذا القيد معكوس مسبقاً.");

  const lines = (original.journal_lines ?? []) as Array<{ account_id: string; debit: number; credit: number; memo: string | null; cost_center_id: string | null }>;
  if (lines.length === 0) throw new Error("القيد لا يحتوي على أسطر.");

  const entryNumber = await nextJournalNumber(admin, input.organizationId);

  const { data: reversal, error: reversalError } = await (admin as any)
    .from("journal_entries")
    .insert({
      organization_id: input.organizationId,
      branch_id: original.branch_id,
      entry_number: entryNumber,
      entry_date: new Date().toISOString().slice(0, 10),
      source_doc_type: "journal_reversal",
      source_doc_id: input.entryId,
      memo: `عكس قيد ${original.entry_number}: ${input.reason}`,
      status: "posted",
      reversal_of_entry_id: input.entryId,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (reversalError || !reversal) throw new Error(reversalError?.message ?? "تعذر إنشاء القيد العكسي.");

  const { error: lineError } = await (admin as any).from("journal_lines").insert(
    lines.map((line) => ({
      organization_id: input.organizationId,
      journal_entry_id: reversal.id,
      account_id: line.account_id,
      branch_id: original.branch_id,
      debit: roundMoney(Number(line.credit) || 0),
      credit: roundMoney(Number(line.debit) || 0),
      memo: line.memo ? `عكس: ${line.memo}` : `عكس قيد ${original.entry_number}`,
      cost_center_id: line.cost_center_id,
    })),
  );

  if (lineError) throw new Error(lineError.message);

  return reversal.id as string;
}

export async function postInventoryWriteOffJournal(admin: AdminClient, input: InventoryWriteOffPostingInput) {
  const totalCost = roundMoney(input.totalCost);
  if (totalCost <= 0) return null;

  return postBalancedJournal(admin, {
    organizationId: input.organizationId,
    branchId: input.branchId,
    sourceDocType: input.sourceDocType,
    sourceDocId: input.sourceDocId,
    memo: `قيد ${input.label}`,
    createdBy: input.createdBy,
    lines: [
      {
        systemKey: "operating_expense",
        debit: totalCost,
        memo: input.label,
      },
      {
        systemKey: "inventory",
        credit: totalCost,
        memo: `خفض مخزون - ${input.label}`,
      },
    ],
  });
}
