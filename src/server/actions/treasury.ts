"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClientWithContext, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { requireAuth, requireSensitiveActionCapability } from "@/lib/auth/require-auth";
import { logAuditEvent } from "@/lib/audit/log";
import { postBalancedJournal } from "@/lib/accounting/posting";
import { numberValue } from "@/server/queries/_shared/utils";
import { requireOrganizationModule } from "@/server/billing/entitlements";
import type { ActionState } from "./auth";

function ok(message: string): ActionState {
  return { ok: true, message };
}

function invalid(message: string): ActionState {
  return { ok: false, message };
}

async function resolveScope() {
  const auth = await requireAuth();
  const admin = createAdminClientWithContext("treasury.ts/resolveScope");

  if (auth.organizationId) {
    await requireOrganizationModule(admin, auth.organizationId, "accounting", { write: true });
    return { admin, organizationId: auth.organizationId, userId: auth.id, auth };
  }

  throw new Error("لم يتم تحديد مؤسسة نشطة للجلسة. اختر المؤسسة صراحةً ثم أعد المحاولة.");
}

// ----------------------------------------------------------------------------
// Receipt voucher (سند قبض): debit cash/bank, credit receivable or income
// ----------------------------------------------------------------------------

const receiptSchema = z.object({
  voucherDate: z.string().min(1, "التاريخ مطلوب"),
  cashAccountId: z.string().uuid("اختر حساب الصندوق أو البنك"),
  creditSide: z.enum(["customer", "income"]),
  customerName: z.string().optional(),
  incomeAccountId: z.string().uuid().optional().or(z.literal("")),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  reference: z.string().optional(),
  memo: z.string().optional(),
});

export async function saveReceiptVoucherAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = receiptSchema.safeParse({
    voucherDate: formData.get("voucherDate"),
    cashAccountId: formData.get("cashAccountId"),
    creditSide: formData.get("creditSide"),
    customerName: formData.get("customerName") || undefined,
    incomeAccountId: formData.get("incomeAccountId") || undefined,
    amount: formData.get("amount"),
    reference: formData.get("reference") || undefined,
    memo: formData.get("memo") || undefined,
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات السند غير صحيحة");
  if (!hasSupabaseAdminEnv()) return invalid("مفتاح Supabase الإداري غير موجود.");
  if (parsed.data.creditSide === "customer" && !parsed.data.customerName) {
    return invalid("حدد اسم العميل عند ترحيل سند قبض لذمم العملاء.");
  }
  if (parsed.data.creditSide === "income" && !parsed.data.incomeAccountId) {
    return invalid("اختر حساب الإيراد عند ترحيل سند قبض لحساب دخل.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveScope();
    requireSensitiveActionCapability(auth, "accounting_write");

    const amount = Math.round(parsed.data.amount * 100) / 100;
    const lines: Array<{ accountId?: string; systemKey?: string; debit?: number; credit?: number; memo: string }> = [
      { accountId: parsed.data.cashAccountId, debit: amount, memo: parsed.data.memo || "سند قبض" },
    ];

    if (parsed.data.creditSide === "customer") {
      lines.push({ systemKey: "accounts_receivable", credit: amount, memo: `تحصيل من ${parsed.data.customerName}` });
    } else {
      lines.push({ accountId: parsed.data.incomeAccountId, credit: amount, memo: parsed.data.memo || "إيراد نقدي" });
    }

    await postBalancedJournal(admin, {
      organizationId,
      branchId: null,
      sourceDocType: "receipt_voucher",
      sourceDocId: `rv-${Date.now()}`,
      memo: parsed.data.memo || `سند قبض${parsed.data.reference ? ` — ${parsed.data.reference}` : ""}`,
      entryDate: parsed.data.voucherDate,
      createdBy: userId,
      lines,
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: "receipt_voucher",
      entityType: "journal_entry",
      entityId: "receipt_voucher",
      newData: { amount, reference: parsed.data.reference },
    });
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر تسجيل سند القبض.");
  }

  revalidatePath("/dashboard/accounting/vouchers");
  revalidatePath("/dashboard/accounting/ledger");
  revalidatePath("/dashboard/accounting/journal");
  return ok("تم ترحيل سند القبض بنجاح.");
}

// ----------------------------------------------------------------------------
// Payment voucher (سند صرف): debit payable/expense, credit cash/bank
// ----------------------------------------------------------------------------

const paymentSchema = z.object({
  voucherDate: z.string().min(1, "التاريخ مطلوب"),
  cashAccountId: z.string().uuid("اختر حساب الصندوق أو البنك"),
  debitSide: z.enum(["supplier", "expense"]),
  supplierId: z.string().uuid().optional().or(z.literal("")),
  expenseAccountId: z.string().uuid().optional().or(z.literal("")),
  applyInvoiceId: z.string().uuid().optional().or(z.literal("")),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  reference: z.string().optional(),
  memo: z.string().optional(),
});

export async function savePaymentVoucherAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = paymentSchema.safeParse({
    voucherDate: formData.get("voucherDate"),
    cashAccountId: formData.get("cashAccountId"),
    debitSide: formData.get("debitSide"),
    supplierId: formData.get("supplierId") || undefined,
    expenseAccountId: formData.get("expenseAccountId") || undefined,
    applyInvoiceId: formData.get("applyInvoiceId") || undefined,
    amount: formData.get("amount"),
    reference: formData.get("reference") || undefined,
    memo: formData.get("memo") || undefined,
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات السند غير صحيحة");
  if (!hasSupabaseAdminEnv()) return invalid("مفتاح Supabase الإداري غير موجود.");
  if (parsed.data.debitSide === "supplier" && !parsed.data.supplierId) {
    return invalid("حدد المورد عند ترحيل سند صرف على ذمم الموردين.");
  }
  if (parsed.data.debitSide === "expense" && !parsed.data.expenseAccountId) {
    return invalid("اختر حساب المصروف عند ترحيل سند صرف لمصروف.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveScope();
    requireSensitiveActionCapability(auth, "accounting_write");

    const amount = Math.round(parsed.data.amount * 100) / 100;

    // Optional application to a supplier invoice: verify it exists & balance.
    let invoice: any = null;
    if (parsed.data.applyInvoiceId) {
      const { data } = await (admin as any)
        .from("invoices")
        .select("id, invoice_number, supplier_id, branch_id, total, paid_amount, balance_due, status")
        .eq("id", parsed.data.applyInvoiceId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      invoice = data;
      if (!invoice) return invalid("فاتورة المورد غير موجودة.");
      const balanceDue = numberValue(invoice.balance_due ?? invoice.total ?? 0);
      if (amount > balanceDue + 0.001) return invalid(`المبلغ أكبر من الرصيد المستحق (${balanceDue}).`);
    }

    const lines: Array<{ accountId?: string; systemKey?: string; debit?: number; credit?: number; memo: string }> = [];
    if (parsed.data.debitSide === "supplier") {
      lines.push({ systemKey: "accounts_payable", debit: amount, memo: `سداد مورد` });
    } else {
      lines.push({ accountId: parsed.data.expenseAccountId, debit: amount, memo: parsed.data.memo || "سند صرف مصروف" });
    }
    lines.push({ accountId: parsed.data.cashAccountId, credit: amount, memo: parsed.data.memo || "سند صرف" });

    const journalEntryId = await postBalancedJournal(admin, {
      organizationId,
      branchId: invoice?.branch_id ?? null,
      sourceDocType: "payment_voucher",
      sourceDocId: `pv-${Date.now()}`,
      memo: parsed.data.memo || `سند صرف${parsed.data.reference ? ` — ${parsed.data.reference}` : ""}`,
      entryDate: parsed.data.voucherDate,
      createdBy: userId,
      lines,
    });

    if (invoice) {
      const newPaid = numberValue(invoice.paid_amount ?? 0) + amount;
      const newBalance = Math.max(0, numberValue(invoice.balance_due ?? invoice.total ?? 0) - amount);
      const newStatus = newBalance <= 0.001 ? "paid" : "partially_paid";

      await (admin as any).from("supplier_payments").insert({
        organization_id: organizationId,
        invoice_id: invoice.id,
        supplier_id: invoice.supplier_id,
        branch_id: invoice.branch_id,
        amount,
        payment_method: "voucher",
        payment_date: parsed.data.voucherDate,
        reference: parsed.data.reference ?? null,
        journal_entry_id: journalEntryId,
        created_by: userId,
      });

      await (admin as any)
        .from("invoices")
        .update({ paid_amount: newPaid, balance_due: newBalance, payment_status: newStatus, status: newStatus })
        .eq("id", invoice.id)
        .eq("organization_id", organizationId);
    }

    await logAuditEvent({
      organizationId,
      userId,
      action: "payment_voucher",
      entityType: "journal_entry",
      entityId: "payment_voucher",
      newData: { amount, reference: parsed.data.reference },
    });
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر تسجيل سند الصرف.");
  }

  revalidatePath("/dashboard/accounting/vouchers");
  revalidatePath("/dashboard/accounting/payables");
  revalidatePath("/dashboard/accounting/ledger");
  revalidatePath("/dashboard/accounting/journal");
  return ok("تم ترحيل سند الصرف بنجاح.");
}
