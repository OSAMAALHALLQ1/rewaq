import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

type PaymentMethod = "cash" | "card" | "bank_transfer" | "delivery_app" | "receivable" | "wallet" | "gift_card";

type CustomerInvoicePostingInput = {
  organizationId: string;
  branchId: string;
  invoiceId: string;
  invoiceNumber: string;
  paymentMethod?: PaymentMethod;
  payments?: Array<{ method: string; amount: number }>;
  subtotal: number;
  taxTotal: number;
  total: number;
  costTotal: number;
  discount?: number;
  serviceFee?: number;
  deliveryFee?: number;
  entryDate: string;
  createdBy?: string | null;
};

type CashVariancePostingInput = {
  organizationId: string;
  branchId: string;
  shiftId: string;
  shiftLabel: string;
  difference: number;
  entryDate: string;
  createdBy?: string | null;
};

type SupplierInvoicePostingInput = {
  organizationId: string;
  branchId: string;
  invoiceId: string;
  invoiceNumber: string;
  total: number;
  entryDate: string;
  /** When the invoice settles a previously received PO, clear the GRNI balance
   *  instead of re-increasing inventory. */
  linkedToReceipt?: boolean;
  createdBy?: string | null;
};

type PurchaseReceiptPostingInput = {
  organizationId: string;
  branchId: string;
  purchaseOrderId: string;
  orderLabel: string;
  total: number;
  entryDate: string;
  createdBy?: string | null;
};

type InventoryWriteOffPostingInput = {
  organizationId: string;
  branchId: string;
  sourceDocType: "waste_log" | "inventory_adjustment";
  sourceDocId: string;
  label: string;
  totalCost: number;
  entryDate: string;
  createdBy?: string | null;
};

type JournalLineDraft = {
  /** Post to the account carrying this system key… */
  systemKey?: string;
  /** …or to an explicit chart-of-accounts id (wins over systemKey). */
  accountId?: string;
  debit?: number;
  credit?: number;
  memo: string;
  costCenterId?: string | null;
};

type BalancedJournalInput = {
  organizationId: string;
  branchId: string | null;
  sourceDocType: string;
  sourceDocId: string;
  memo: string;
  createdBy?: string | null;
  entryDate: string;
  lines: JournalLineDraft[];
};

function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 10000) / 10000;
}

/**
 * Local (tenant timezone) date as YYYY-MM-DD. We deliberately avoid
 * `new Date().toISOString()` which is UTC and can shift the entry to the
 * previous/next calendar day for restaurants east/west of UTC.
 */
export function todayLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Throws if the accounting period containing `date` is closed for the org. */
async function assertPeriodOpen(admin: AdminClient, organizationId: string, date: string) {
  const { data: closed } = await (admin as any).rpc("is_accounting_period_closed", {
    target_org_id: organizationId,
    target_date: date,
  });

  if (closed === true) {
    throw new Error("هذه الفترة المحاسبية مقفلة. أعد فتح الفترة من صفحة الإقفال الشهري قبل التسجيل فيها.");
  }
}

function paymentMethodToSystemKey(method: string) {
  if (method === "cash") return "cash_on_hand";
  if (method === "receivable") return "accounts_receivable";
  return "bank_card";
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

export async function postBalancedJournal(admin: AdminClient, input: BalancedJournalInput) {
  const entryDate = input.entryDate || todayLocal();

  // Central guard: never post into a closed accounting period. Every caller is
  // protected here rather than relying on each document flow to check on its own.
  await assertPeriodOpen(admin, input.organizationId, entryDate);

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

  const systemKeys = Array.from(
    new Set(input.lines.filter((line) => !line.accountId && line.systemKey).map((line) => line.systemKey as string)),
  );
  const accounts = systemKeys.length > 0 ? await loadPostingAccounts(admin, input.organizationId, systemKeys) : new Map<string, string>();

  for (const line of input.lines) {
    if (!line.accountId && !line.systemKey) {
      throw new Error("سطر قيد بدون حساب محاسبي.");
    }
  }
  const entryNumber = await nextJournalNumber(admin, input.organizationId);

  const { data: entry, error: entryError } = await (admin as any)
    .from("journal_entries")
    .insert({
      organization_id: input.organizationId,
      branch_id: input.branchId || null,
      entry_number: entryNumber,
      entry_date: entryDate,
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
      account_id: line.accountId ?? accounts.get(line.systemKey as string),
      branch_id: input.branchId || null,
      debit: roundMoney(line.debit ?? 0),
      credit: roundMoney(line.credit ?? 0),
      memo: line.memo,
      cost_center_id: line.costCenterId ?? null,
    })),
  );

  if (lineError) throw new Error(lineError.message);

  return entry.id as string;
}

export async function postCustomerInvoiceJournal(admin: AdminClient, input: CustomerInvoicePostingInput) {
  const lines: JournalLineDraft[] = [];

  // 1. Debits: Payments (Asset or Receivable)
  if (input.payments && input.payments.length > 0) {
    for (const pay of input.payments) {
      const amt = roundMoney(pay.amount);
      if (amt > 0) {
        lines.push({
          systemKey: paymentMethodToSystemKey(pay.method),
          debit: amt,
          memo: `تحصيل دفعة ${pay.method} فاتورة ${input.invoiceNumber}`,
        });
      }
    }
  } else {
    const method = input.paymentMethod || "cash";
    lines.push({
      systemKey: paymentMethodToSystemKey(method),
      debit: roundMoney(input.total),
      memo: `تحصيل فاتورة ${input.invoiceNumber}`,
    });
  }

  // 2. Debits: Discount (Contra-Revenue)
  const discount = roundMoney(input.discount ?? 0);
  if (discount > 0) {
    lines.push({
      systemKey: "sales_discounts",
      debit: discount,
      memo: `خصم فاتورة ${input.invoiceNumber}`,
    });
  }

  // 3. Credits: Sales Revenue
  lines.push({
    systemKey: "sales_revenue",
    credit: roundMoney(input.subtotal),
    memo: `مبيعات فاتورة ${input.invoiceNumber}`,
  });

  // 4. Credits: Sales Tax (Liability)
  const taxTotal = roundMoney(input.taxTotal);
  if (taxTotal > 0) {
    lines.push({
      systemKey: "output_tax_payable",
      credit: taxTotal,
      memo: `ضريبة فاتورة ${input.invoiceNumber}`,
    });
  }

  // 5. Credits: Service Fee Revenue
  const serviceFee = roundMoney(input.serviceFee ?? 0);
  if (serviceFee > 0) {
    lines.push({
      systemKey: "service_fee_revenue",
      credit: serviceFee,
      memo: `رسوم خدمة فاتورة ${input.invoiceNumber}`,
    });
  }

  // 6. Credits: Delivery Fee Revenue
  const deliveryFee = roundMoney(input.deliveryFee ?? 0);
  if (deliveryFee > 0) {
    lines.push({
      systemKey: "delivery_revenue",
      credit: deliveryFee,
      memo: `رسوم توصيل فاتورة ${input.invoiceNumber}`,
    });
  }

  // 7. COGS & Inventory (Asset adjustment)
  const costTotal = roundMoney(input.costTotal);
  if (costTotal > 0) {
    lines.push(
      {
        systemKey: "cogs",
        debit: costTotal,
        memo: `تكلفة بضاعة فاتورة ${input.invoiceNumber}`,
      },
      {
        systemKey: "inventory",
        credit: costTotal,
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
    entryDate: input.entryDate,
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
            systemKey: "cash_on_hand",
            credit: amount,
            memo: `تسوية عجز صندوق وردية ${input.shiftLabel}`,
          },
        ]
      : [
          {
            systemKey: "cash_on_hand",
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
    entryDate: input.entryDate,
    lines,
  });
}

export async function postSupplierInvoiceJournal(admin: AdminClient, input: SupplierInvoicePostingInput) {
  const total = roundMoney(input.total);
  if (total <= 0) return null;

  const lines: JournalLineDraft[] = input.linkedToReceipt
    ? [
        {
          systemKey: "goods_received_not_invoiced",
          debit: total,
          memo: `تسوية بضاعة مستلمة غير مفوترة فاتورة مورد ${input.invoiceNumber}`,
        },
        {
          systemKey: "accounts_payable",
          credit: total,
          memo: `ذمم موردين فاتورة ${input.invoiceNumber}`,
        },
      ]
    : [
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
      ];

  return postBalancedJournal(admin, {
    organizationId: input.organizationId,
    branchId: input.branchId,
    sourceDocType: "supplier_invoice",
    sourceDocId: input.invoiceId,
    memo: `قيد تلقائي لفاتورة مورد ${input.invoiceNumber}`,
    createdBy: input.createdBy,
    entryDate: input.entryDate,
    lines,
  });
}

type SupplierPaymentPostingInput = {
  organizationId: string;
  branchId: string | null;
  invoiceId: string;
  invoiceNumber: string;
  supplierName: string;
  amount: number;
  paymentMethod: string;
  entryDate: string;
  createdBy?: string | null;
};

/**
 * Posts a supplier payment: debits Accounts Payable and credits the cash/bank
 * account used for the payment. Recording the payment is separate from creating
 * the invoice — the invoice only records the payable.
 */
export async function postSupplierPaymentJournal(admin: AdminClient, input: SupplierPaymentPostingInput) {
  const amount = roundMoney(input.amount);
  if (amount <= 0) return null;

  const creditSystemKey = paymentMethodToSystemKey(input.paymentMethod);

  return postBalancedJournal(admin, {
    organizationId: input.organizationId,
    branchId: input.branchId,
    sourceDocType: "supplier_payment",
    sourceDocId: input.invoiceId,
    memo: `دفع فاتورة مورد ${input.invoiceNumber} - ${input.supplierName}`,
    createdBy: input.createdBy,
    entryDate: input.entryDate,
    lines: [
      {
        systemKey: "accounts_payable",
        debit: amount,
        memo: `سداد ذمم مورد ${input.supplierName}`,
      },
      {
        systemKey: creditSystemKey,
        credit: amount,
        memo: `دفع نقدي/بنكي فاتورة مورد ${input.invoiceNumber}`,
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
    entryDate: input.entryDate,
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

function expenseCategoryToSystemKey(category: string): string {
  const cat = category.toLowerCase().trim();
  if (cat.includes("rent") || cat.includes("إيجار") || cat.includes("ايجار")) return "rent_expense";
  if (cat.includes("salary") || cat.includes("salaries") || cat.includes("راتب") || cat.includes("رواتب") || cat.includes("أجور") || cat.includes("اجور")) return "salaries_expense";
  if (cat.includes("utility") || cat.includes("utilities") || cat.includes("كهرباء") || cat.includes("مياه") || cat.includes("هاتف") || cat.includes("اتصالات")) return "utilities_expense";
  if (cat.includes("maintenance") || cat.includes("صيانة") || cat.includes("اصلاح")) return "maintenance_expense";
  if (cat.includes("marketing") || cat.includes("advertising") || cat.includes("تسويق") || cat.includes("إعلان") || cat.includes("اعلان")) return "marketing_expense";
  if (cat.includes("commission") || cat.includes("delivery_platform") || cat.includes("عمولات") || cat.includes("عمولة")) return "delivery_platform_commission_expense";
  if (cat.includes("cleaning") || cat.includes("supplies") || cat.includes("تنظيف") || cat.includes("منظفات")) return "cleaning_supplies_expense";
  return "operating_expense_other";
}

type ExpensePostingInput = {
  organizationId: string;
  branchId: string | null;
  expenseId: string;
  category: string;
  amount: number;
  paymentMethod: "cash" | "bank";
  costCenterId?: string | null;
  /** Explicit debit account chosen by the accountant — overrides keyword matching. */
  expenseAccountId?: string | null;
  entryDate: string;
  createdBy?: string | null;
};

export async function postExpenseJournal(admin: AdminClient, input: ExpensePostingInput) {
  const amount = roundMoney(input.amount);
  if (amount <= 0) return null;

  const creditSystemKey = input.paymentMethod === "cash" ? "cash_on_hand" : "bank_card";
  const debitLine: JournalLineDraft = input.expenseAccountId
    ? {
        accountId: input.expenseAccountId,
        debit: amount,
        memo: `مصروف ${input.category}`,
        costCenterId: input.costCenterId ?? null,
      }
    : {
        systemKey: expenseCategoryToSystemKey(input.category),
        debit: amount,
        memo: `مصروف ${input.category}`,
        costCenterId: input.costCenterId ?? null,
      };

  return postBalancedJournal(admin, {
    organizationId: input.organizationId,
    branchId: input.branchId,
    sourceDocType: "expense",
    sourceDocId: input.expenseId,
    memo: `قيد مصروف: ${input.category}`,
    createdBy: input.createdBy,
    entryDate: input.entryDate,
    lines: [
      debitLine,
      {
        systemKey: creditSystemKey,
        credit: amount,
        memo: `سداد مصروف ${input.category}`,
      },
    ],
  });
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
    .select("id, entry_number, entry_date, branch_id, status, source_doc_type, reversal_of_entry_id, journal_lines(account_id, debit, credit, memo, cost_center_id)")
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

  // Reversing an entry is itself a posting into the original entry's period,
  // so the closed-period guard applies here too.
  const originalDate = original.entry_date || todayLocal();
  await assertPeriodOpen(admin, input.organizationId, originalDate);

  const lines = (original.journal_lines ?? []) as Array<{ account_id: string; debit: number; credit: number; memo: string | null; cost_center_id: string | null }>;
  if (lines.length === 0) throw new Error("القيد لا يحتوي على أسطر.");

  const entryNumber = await nextJournalNumber(admin, input.organizationId);

  const { data: reversal, error: reversalError } = await (admin as any)
    .from("journal_entries")
    .insert({
      organization_id: input.organizationId,
      branch_id: original.branch_id,
      entry_number: entryNumber,
      entry_date: originalDate,
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
    entryDate: input.entryDate,
    lines: [
      {
        systemKey: "operating_expense_other",
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
