import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;
type DrawerEntryType = "opening" | "cash_sale" | "card_sale" | "expense" | "withdrawal" | "deposit" | "closing_adjustment";
type PaymentMethod = "cash" | "card" | "bank_transfer" | "delivery_app";

type EnsureShiftInput = {
  organizationId: string;
  branchId: string;
  deviceKeyId?: string | null;
  cashierUserId?: string | null;
  cashierName: string;
  openingCash?: number;
};

type RegisterSaleInput = {
  organizationId: string;
  branchId: string;
  shiftId: string;
  invoiceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  createdBy?: string | null;
};

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function ensureOpenSalesShift(admin: AdminClient, input: EnsureShiftInput) {
  const baseQuery = (admin as any)
    .from("sales_shifts")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("branch_id", input.branchId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1);

  const { data: existing, error: existingError } = input.deviceKeyId
    ? await baseQuery.eq("device_key_id", input.deviceKeyId).maybeSingle()
    : await baseQuery.maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing?.id) return existing;

  const openingCash = numeric(input.openingCash);
  const { data: shift, error: shiftError } = await (admin as any)
    .from("sales_shifts")
    .insert({
      organization_id: input.organizationId,
      branch_id: input.branchId,
      device_key_id: input.deviceKeyId ?? null,
      cashier_user_id: input.cashierUserId ?? null,
      cashier_name: input.cashierName || "كاشير",
      opening_cash: openingCash,
      expected_cash: openingCash,
      created_by: input.cashierUserId ?? null,
    })
    .select("*")
    .single();

  if (shiftError || !shift) throw new Error(shiftError?.message ?? "تعذر فتح وردية الكاشير.");

  await addCashDrawerEntry(admin, {
    organizationId: input.organizationId,
    branchId: input.branchId,
    shiftId: shift.id,
    entryType: "opening",
    amount: openingCash,
    memo: "رصيد افتتاحي تلقائي للوردية",
    createdBy: input.cashierUserId ?? null,
  });

  return shift;
}

export async function addCashDrawerEntry(
  admin: AdminClient,
  input: {
    organizationId: string;
    branchId: string;
    shiftId: string;
    entryType: DrawerEntryType;
    amount: number;
    referenceDocType?: string;
    referenceDocId?: string;
    memo?: string;
    createdBy?: string | null;
  },
) {
  const { error } = await (admin as any).from("cash_drawer_entries").insert({
    organization_id: input.organizationId,
    branch_id: input.branchId,
    shift_id: input.shiftId,
    entry_type: input.entryType,
    amount: input.amount,
    reference_doc_type: input.referenceDocType ?? null,
    reference_doc_id: input.referenceDocId ?? null,
    memo: input.memo ?? null,
    created_by: input.createdBy ?? null,
  });

  if (error) throw new Error(error.message);
}

export async function registerShiftSale(admin: AdminClient, input: RegisterSaleInput) {
  const paymentEntryType = input.paymentMethod === "cash" ? "cash_sale" : "card_sale";
  const salesField = input.paymentMethod === "cash" ? "cash_sales" : "card_sales";
  const expectedCashDelta = input.paymentMethod === "cash" ? numeric(input.amount) : 0;

  await addCashDrawerEntry(admin, {
    organizationId: input.organizationId,
    branchId: input.branchId,
    shiftId: input.shiftId,
    entryType: paymentEntryType,
    amount: numeric(input.amount),
    referenceDocType: "customer_invoice",
    referenceDocId: input.invoiceId,
    memo: input.paymentMethod === "cash" ? "تحصيل نقدي من فاتورة كاشير" : "تحصيل بطاقة من فاتورة كاشير",
    createdBy: input.createdBy ?? null,
  });

  const { data: shift, error: shiftError } = await (admin as any)
    .from("sales_shifts")
    .select("cash_sales, card_sales, expected_cash")
    .eq("id", input.shiftId)
    .eq("organization_id", input.organizationId)
    .single();

  if (shiftError || !shift) throw new Error(shiftError?.message ?? "تعذر تحديث الوردية.");

  const { error: updateError } = await (admin as any)
    .from("sales_shifts")
    .update({
      [salesField]: numeric(shift[salesField]) + numeric(input.amount),
      expected_cash: numeric(shift.expected_cash) + expectedCashDelta,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.shiftId)
    .eq("organization_id", input.organizationId);

  if (updateError) throw new Error(updateError.message);
}
