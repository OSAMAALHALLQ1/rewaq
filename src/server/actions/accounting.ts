"use server";

/**
 * ERP accounting server actions: chart of accounts, cost centers, expenses,
 * journal reversals, period closing, and advanced accounting settings.
 *
 * Rules enforced here (per the ERP strategy):
 * - Cashiers can never reach these actions (sensitive capability checks).
 * - Financial records are never deleted — corrections use reversal entries.
 * - Posting into a closed accounting period is blocked.
 * - Every sensitive action writes an audit log record.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClientWithContext, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { requireAuth, requireSensitiveActionCapability } from "@/lib/auth/require-auth";
import { logAuditEvent } from "@/lib/audit/log";
import { postExpenseJournal, reverseJournalEntry } from "@/lib/accounting/posting";
import { EXPENSE_CATEGORIES } from "@/lib/accounting/constants";
import type { ActionState } from "./auth";

function ok(message: string): ActionState {
  return { ok: true, message };
}

function invalid(message: string): ActionState {
  return { ok: false, message };
}

async function resolveAccountingScope() {
  const auth = await requireAuth();
  const admin = createAdminClientWithContext("accounting.ts/resolveAccountingScope");

  if (auth.organizationId) {
    return { admin, organizationId: auth.organizationId, userId: auth.id, auth };
  }

  const { data: membership } = await (admin as any)
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", auth.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.organization_id) {
    throw new Error("تعذر تحديد المؤسسة للمستخدم الحالي.");
  }

  return { admin, organizationId: membership.organization_id, userId: auth.id, auth };
}

async function assertPeriodOpen(admin: any, organizationId: string, date: string) {
  const { data: closed } = await admin.rpc("is_accounting_period_closed", {
    target_org_id: organizationId,
    target_date: date,
  });

  if (closed === true) {
    throw new Error("هذه الفترة المحاسبية مقفلة. أعد فتح الفترة من صفحة الإقفال الشهري قبل التسجيل فيها.");
  }
}

// ============================================================================
// 1) Chart of accounts (دليل الحسابات)
// ============================================================================

const accountSchema = z.object({
  code: z.string().trim().min(1, "كود الحساب مطلوب").max(20),
  name: z.string().trim().min(2, "اسم الحساب مطلوب"),
  accountType: z.enum(["asset", "liability", "equity", "revenue", "expense", "cogs"]),
  normalBalance: z.enum(["debit", "credit"]),
  parentId: z.string().uuid().optional().or(z.literal("")),
  openingBalance: z.coerce.number().min(0).default(0),
});

export async function saveAccountAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  if (!hasSupabaseAdminEnv()) return invalid("مفتاح Supabase الإداري غير موجود.");

  const parsed = accountSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    accountType: formData.get("accountType"),
    normalBalance: formData.get("normalBalance"),
    parentId: formData.get("parentId") ?? "",
    openingBalance: formData.get("openingBalance") ?? 0,
  });

  if (!parsed.success) {
    return invalid(parsed.error.issues[0]?.message ?? "بيانات الحساب غير صالحة.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveAccountingScope();
    requireSensitiveActionCapability(auth, "accounting_write");

    const { data: account, error } = await (admin as any)
      .from("chart_of_accounts")
      .insert({
        organization_id: organizationId,
        code: parsed.data.code,
        name: parsed.data.name,
        account_type: parsed.data.accountType,
        normal_balance: parsed.data.normalBalance,
        parent_id: parsed.data.parentId || null,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") return invalid("يوجد حساب بنفس الكود مسبقاً.");
      return invalid(error.message);
    }

    // Opening balance is posted as a balanced journal entry against owner equity —
    // never as a raw balance edit, so the trial balance stays balanced.
    if (parsed.data.openingBalance > 0) {
      const { data: equityAccount } = await (admin as any)
        .from("chart_of_accounts")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("system_key", "owner_equity")
        .maybeSingle();

      if (equityAccount?.id) {
        const today = new Date().toISOString().slice(0, 10);
        await assertPeriodOpen(admin, organizationId, today);

        const compactDate = today.replaceAll("-", "");
        const { count } = await (admin as any)
          .from("journal_entries")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .gte("created_at", `${today}T00:00:00.000Z`);

        const { data: entry, error: entryError } = await (admin as any)
          .from("journal_entries")
          .insert({
            organization_id: organizationId,
            entry_number: `JE-${compactDate}-${String((count ?? 0) + 1).padStart(4, "0")}`,
            entry_date: today,
            source_doc_type: "opening_balance",
            source_doc_id: account.id,
            memo: `رصيد افتتاحي لحساب ${parsed.data.code} - ${parsed.data.name}`,
            status: "posted",
            created_by: userId,
          })
          .select("id")
          .single();

        if (!entryError && entry) {
          const amount = parsed.data.openingBalance;
          const debitSide = parsed.data.normalBalance === "debit";
          await (admin as any).from("journal_lines").insert([
            {
              organization_id: organizationId,
              journal_entry_id: entry.id,
              account_id: account.id,
              debit: debitSide ? amount : 0,
              credit: debitSide ? 0 : amount,
              memo: "رصيد افتتاحي",
            },
            {
              organization_id: organizationId,
              journal_entry_id: entry.id,
              account_id: equityAccount.id,
              debit: debitSide ? 0 : amount,
              credit: debitSide ? amount : 0,
              memo: `مقابل رصيد افتتاحي ${parsed.data.name}`,
            },
          ]);
        }
      }
    }

    await logAuditEvent({
      organizationId,
      userId,
      action: "account_created",
      entityType: "chart_of_accounts",
      entityId: account.id,
      newData: parsed.data,
    });
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ الحساب.");
  }

  revalidatePath("/dashboard/accounting/accounts");
  revalidatePath("/dashboard/accounting");
  return ok("تم إضافة الحساب إلى دليل الحسابات.");
}

export async function toggleAccountActiveAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const accountId = String(formData.get("accountId") ?? "");
  const nextActive = String(formData.get("nextActive") ?? "") === "true";

  if (!accountId) return invalid("الحساب غير محدد.");

  try {
    const { admin, organizationId, userId, auth } = await resolveAccountingScope();
    requireSensitiveActionCapability(auth, "accounting_write");

    const { data: account } = await (admin as any)
      .from("chart_of_accounts")
      .select("id, system_key, is_active")
      .eq("organization_id", organizationId)
      .eq("id", accountId)
      .maybeSingle();

    if (!account) return invalid("الحساب غير موجود.");
    if (account.system_key && !nextActive) {
      return invalid("لا يمكن تعطيل حساب نظامي مرتبط بالترحيل التلقائي.");
    }

    const { error } = await (admin as any)
      .from("chart_of_accounts")
      .update({ is_active: nextActive, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", accountId);

    if (error) return invalid(error.message);

    await logAuditEvent({
      organizationId,
      userId,
      action: nextActive ? "account_activated" : "account_deactivated",
      entityType: "chart_of_accounts",
      entityId: accountId,
      oldData: { is_active: account.is_active },
      newData: { is_active: nextActive },
    });
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر تحديث الحساب.");
  }

  revalidatePath("/dashboard/accounting/accounts");
  return ok(nextActive ? "تم تفعيل الحساب." : "تم تعطيل الحساب.");
}

// ============================================================================
// 2) Cost centers (مراكز التكلفة)
// ============================================================================

const costCenterSchema = z.object({
  code: z.string().trim().min(1, "كود مركز التكلفة مطلوب").max(20),
  name: z.string().trim().min(2, "اسم مركز التكلفة مطلوب"),
  description: z.string().trim().optional(),
});

export async function saveCostCenterAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  if (!hasSupabaseAdminEnv()) return invalid("مفتاح Supabase الإداري غير موجود.");

  const parsed = costCenterSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.issues[0]?.message ?? "بيانات مركز التكلفة غير صالحة.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveAccountingScope();
    requireSensitiveActionCapability(auth, "accounting_write");

    const { data: center, error } = await (admin as any)
      .from("cost_centers")
      .insert({
        organization_id: organizationId,
        code: parsed.data.code,
        name: parsed.data.name,
        description: parsed.data.description || null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") return invalid("يوجد مركز تكلفة بنفس الكود مسبقاً.");
      return invalid(error.message);
    }

    await logAuditEvent({
      organizationId,
      userId,
      action: "cost_center_created",
      entityType: "cost_centers",
      entityId: center.id,
      newData: parsed.data,
    });
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ مركز التكلفة.");
  }

  revalidatePath("/dashboard/accounting/cost-centers");
  return ok("تم إضافة مركز التكلفة.");
}

// ============================================================================
// 3) Expenses (المصروفات) — auto-posts: مدين مصروفات / دائن صندوق أو بنك
// ============================================================================

const expenseSchema = z.object({
  category: z.string().trim().min(1, "تصنيف المصروف مطلوب"),
  description: z.string().trim().optional(),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  expenseDate: z.string().min(10, "تاريخ المصروف مطلوب"),
  paymentMethod: z.enum(["cash", "bank"]),
  branchId: z.string().uuid().optional().or(z.literal("")),
  costCenterId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().optional(),
});

export async function saveExpenseAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  if (!hasSupabaseAdminEnv()) return invalid("مفتاح Supabase الإداري غير موجود.");

  const parsed = expenseSchema.safeParse({
    category: formData.get("category"),
    description: formData.get("description") ?? undefined,
    amount: formData.get("amount"),
    expenseDate: formData.get("expenseDate"),
    paymentMethod: formData.get("paymentMethod"),
    branchId: formData.get("branchId") ?? "",
    costCenterId: formData.get("costCenterId") ?? "",
    notes: formData.get("notes") ?? undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.issues[0]?.message ?? "بيانات المصروف غير صالحة.");
  }

  const knownCategory = (EXPENSE_CATEGORIES as readonly string[]).includes(parsed.data.category);
  if (!knownCategory && parsed.data.category.length < 2) {
    return invalid("تصنيف المصروف غير صالح.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveAccountingScope();
    requireSensitiveActionCapability(auth, "expense_write");
    await assertPeriodOpen(admin, organizationId, parsed.data.expenseDate);

    const { data: expense, error } = await (admin as any)
      .from("expenses")
      .insert({
        organization_id: organizationId,
        branch_id: parsed.data.branchId || null,
        cost_center_id: parsed.data.costCenterId || null,
        category: parsed.data.category,
        description: parsed.data.description || null,
        amount: parsed.data.amount,
        expense_date: parsed.data.expenseDate,
        payment_method: parsed.data.paymentMethod,
        notes: parsed.data.notes || null,
        status: "posted",
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) return invalid(error.message);

    const journalEntryId = await postExpenseJournal(admin, {
      organizationId,
      branchId: parsed.data.branchId || null,
      expenseId: expense.id,
      category: parsed.data.category,
      amount: parsed.data.amount,
      paymentMethod: parsed.data.paymentMethod,
      costCenterId: parsed.data.costCenterId || null,
      createdBy: userId,
    });

    if (journalEntryId) {
      await (admin as any)
        .from("expenses")
        .update({ journal_entry_id: journalEntryId })
        .eq("id", expense.id)
        .eq("organization_id", organizationId);
    }

    await logAuditEvent({
      organizationId,
      branchId: parsed.data.branchId || null,
      userId,
      action: "expense_created",
      entityType: "expenses",
      entityId: expense.id,
      newData: { ...parsed.data, journal_entry_id: journalEntryId },
    });
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ المصروف.");
  }

  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/accounting/ledger");
  return ok("تم تسجيل المصروف وترحيله محاسبياً (مدين مصروفات / دائن صندوق أو بنك).");
}

// ============================================================================
// 4) Journal reversal (القيد العكسي) — never delete, always reverse
// ============================================================================

export async function reverseJournalEntryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const entryId = String(formData.get("entryId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!entryId) return invalid("القيد غير محدد.");
  if (reason.length < 3) return invalid("سبب العكس مطلوب (3 أحرف على الأقل).");

  try {
    const { admin, organizationId, userId, auth } = await resolveAccountingScope();
    requireSensitiveActionCapability(auth, "accounting_write");
    await assertPeriodOpen(admin, organizationId, new Date().toISOString().slice(0, 10));

    const reversalId = await reverseJournalEntry(admin, {
      organizationId,
      entryId,
      reason,
      createdBy: userId,
    });

    await logAuditEvent({
      organizationId,
      userId,
      action: "journal_entry_reversed",
      entityType: "journal_entries",
      entityId: entryId,
      newData: { reversal_entry_id: reversalId, reason },
    });
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر عكس القيد.");
  }

  revalidatePath("/dashboard/accounting/ledger");
  revalidatePath("/dashboard/accounting");
  return ok("تم إنشاء قيد عكسي. القيد الأصلي محفوظ في سجل التدقيق.");
}

// ============================================================================
// 5) Period closing (الإقفال الشهري)
// ============================================================================

const periodSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  notes: z.string().trim().optional(),
});

export async function closePeriodAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = periodSchema.safeParse({
    year: formData.get("year"),
    month: formData.get("month"),
    notes: formData.get("notes") ?? undefined,
  });

  if (!parsed.success) return invalid("الفترة المحددة غير صالحة.");

  try {
    const { admin, organizationId, userId, auth } = await resolveAccountingScope();
    requireSensitiveActionCapability(auth, "period_close");

    const now = new Date();
    if (
      parsed.data.year > now.getFullYear() ||
      (parsed.data.year === now.getFullYear() && parsed.data.month >= now.getMonth() + 1)
    ) {
      return invalid("لا يمكن إقفال الشهر الحالي أو شهر مستقبلي.");
    }

    // Warn-level guard: block closing while draft entries exist in the period.
    const from = `${parsed.data.year}-${String(parsed.data.month).padStart(2, "0")}-01`;
    const to = new Date(parsed.data.year, parsed.data.month, 0).toISOString().slice(0, 10);
    const { count: draftCount } = await (admin as any)
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "draft")
      .gte("entry_date", from)
      .lte("entry_date", to);

    if ((draftCount ?? 0) > 0) {
      return invalid(`يوجد ${draftCount} قيد غير مرحّل في هذه الفترة. رحّل القيود أو ألغِها قبل الإقفال.`);
    }

    const { error } = await (admin as any)
      .from("accounting_periods")
      .upsert(
        {
          organization_id: organizationId,
          period_year: parsed.data.year,
          period_month: parsed.data.month,
          status: "closed",
          closed_at: new Date().toISOString(),
          closed_by: userId,
          notes: parsed.data.notes || null,
        },
        { onConflict: "organization_id,period_year,period_month" },
      );

    if (error) return invalid(error.message);

    await logAuditEvent({
      organizationId,
      userId,
      action: "accounting_period_closed",
      entityType: "accounting_periods",
      newData: parsed.data,
    });
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر إقفال الفترة.");
  }

  revalidatePath("/dashboard/accounting/closing");
  return ok("تم إقفال الفترة المحاسبية. لن يُقبل أي قيد جديد داخلها حتى يعاد فتحها.");
}

export async function reopenPeriodAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = periodSchema.safeParse({
    year: formData.get("year"),
    month: formData.get("month"),
    notes: formData.get("notes") ?? undefined,
  });

  if (!parsed.success) return invalid("الفترة المحددة غير صالحة.");

  try {
    const { admin, organizationId, userId, auth } = await resolveAccountingScope();
    requireSensitiveActionCapability(auth, "period_close");

    const { error } = await (admin as any)
      .from("accounting_periods")
      .update({
        status: "open",
        reopened_at: new Date().toISOString(),
        reopened_by: userId,
        notes: parsed.data.notes || null,
      })
      .eq("organization_id", organizationId)
      .eq("period_year", parsed.data.year)
      .eq("period_month", parsed.data.month);

    if (error) return invalid(error.message);

    await logAuditEvent({
      organizationId,
      userId,
      action: "accounting_period_reopened",
      entityType: "accounting_periods",
      newData: parsed.data,
    });
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر إعادة فتح الفترة.");
  }

  revalidatePath("/dashboard/accounting/closing");
  return ok("تمت إعادة فتح الفترة. أعد إقفالها بعد إتمام التسويات.");
}

// ============================================================================
// 6) Advanced accounting settings (owner/admin only)
// ============================================================================

const settingsSchema = z.object({
  currencyCode: z.string().trim().min(2).max(5),
  taxEnabled: z.boolean(),
  taxRate: z.coerce.number().min(0).max(100),
  allowNegativeStock: z.boolean(),
  requireShiftBeforeSale: z.boolean(),
  requireManagerApprovalRefund: z.boolean(),
  discountApprovalLimit: z.coerce.number().min(0),
  lockPostedInvoices: z.boolean(),
  enableBranches: z.boolean(),
  enableCostCenters: z.boolean(),
  enableAdvancedAccounting: z.boolean(),
});

function checkbox(formData: FormData, name: string) {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

export async function saveAccountingSettingsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  if (!hasSupabaseAdminEnv()) return invalid("مفتاح Supabase الإداري غير موجود.");

  const parsed = settingsSchema.safeParse({
    currencyCode: formData.get("currencyCode"),
    taxEnabled: checkbox(formData, "taxEnabled"),
    taxRate: formData.get("taxRate") ?? 0,
    allowNegativeStock: checkbox(formData, "allowNegativeStock"),
    requireShiftBeforeSale: checkbox(formData, "requireShiftBeforeSale"),
    requireManagerApprovalRefund: checkbox(formData, "requireManagerApprovalRefund"),
    discountApprovalLimit: formData.get("discountApprovalLimit") ?? 0,
    lockPostedInvoices: checkbox(formData, "lockPostedInvoices"),
    enableBranches: checkbox(formData, "enableBranches"),
    enableCostCenters: checkbox(formData, "enableCostCenters"),
    enableAdvancedAccounting: checkbox(formData, "enableAdvancedAccounting"),
  });

  if (!parsed.success) {
    return invalid(parsed.error.issues[0]?.message ?? "الإعدادات غير صالحة.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveAccountingScope();
    requireSensitiveActionCapability(auth, "accounting_settings_write");

    const { error } = await (admin as any)
      .from("accounting_settings")
      .upsert(
        {
          organization_id: organizationId,
          currency_code: parsed.data.currencyCode,
          tax_enabled: parsed.data.taxEnabled,
          tax_rate: parsed.data.taxRate,
          allow_negative_stock: parsed.data.allowNegativeStock,
          require_shift_before_sale: parsed.data.requireShiftBeforeSale,
          require_manager_approval_refund: parsed.data.requireManagerApprovalRefund,
          discount_approval_limit: parsed.data.discountApprovalLimit,
          lock_posted_invoices: parsed.data.lockPostedInvoices,
          enable_branches: parsed.data.enableBranches,
          enable_cost_centers: parsed.data.enableCostCenters,
          enable_advanced_accounting: parsed.data.enableAdvancedAccounting,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        },
        { onConflict: "organization_id" },
      );

    if (error) return invalid(error.message);

    await logAuditEvent({
      organizationId,
      userId,
      action: "accounting_settings_updated",
      entityType: "accounting_settings",
      entityId: organizationId,
      newData: parsed.data,
    });
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ الإعدادات.");
  }

  revalidatePath("/dashboard/accounting/settings");
  revalidatePath("/dashboard/accounting");
  return ok("تم حفظ إعدادات المحاسبة المتقدمة.");
}
