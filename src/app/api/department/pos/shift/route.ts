import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateDepartmentDevice, requireDepartmentDeviceCapability } from "@/lib/department/auth";
import { canUseDemoFallback } from "@/lib/supabase/env";

// ورديات الكاشير تستخدم جدول sales_shifts (انظر migration 012_cashier_shifts.sql).
// الأعمدة: opening_cash, actual_cash, expected_cash, cash_sales, card_sales,
//          expenses, withdrawals, deposits, difference, status.

// ── محاكاة الورديات في Demo Mode ──
const demoShifts: any[] = [];

const openShiftSchema = z.object({
  action: z.literal("open"),
  openingCash: z.coerce.number().min(0).default(0),
  cashierName: z.string().optional(),
});

const closeShiftSchema = z.object({
  action: z.literal("close"),
  shiftId: z.string().min(1),
  actualCash: z.coerce.number().min(0),
  notes: z.string().optional(),
});

type ShiftRow = Record<string, any>;

function toShiftDTO(s: ShiftRow) {
  return {
    id: s.id,
    status: s.status,
    cashierName: s.cashierName ?? s.cashier_name ?? "",
    openingCash: Number(s.openingCash ?? s.opening_cash ?? 0),
    actualCash: s.actualCash != null || s.actual_cash != null ? Number(s.actualCash ?? s.actual_cash ?? 0) : null,
    expectedCash: Number(s.expectedCash ?? s.expected_cash ?? 0),
    cashSales: Number(s.cashSales ?? s.cash_sales ?? 0),
    cardSales: Number(s.cardSales ?? s.card_sales ?? 0),
    expenses: Number(s.expenses ?? 0),
    withdrawals: Number(s.withdrawals ?? 0),
    deposits: Number(s.deposits ?? 0),
    difference: Number(s.difference ?? 0),
    openedAt: s.openedAt ?? s.opened_at,
    closedAt: s.closedAt ?? s.closed_at ?? null,
    notes: s.notes ?? null,
  };
}

export async function GET(request: Request) {
  const auth = await authenticateDepartmentDevice(request, "pos");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  if (canUseDemoFallback()) {
    const activeShift = demoShifts.find(
      (s) => s.status === "open" && s.deviceId === auth.device.id,
    );
    const today = new Date().toISOString().slice(0, 10);
    return NextResponse.json({
      success: true,
      activeShift: activeShift ? toShiftDTO(activeShift) : null,
      todayShifts: demoShifts
        .filter((s) => (s.openedAt ?? "").slice(0, 10) === today)
        .map(toShiftDTO),
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: shifts, error } = await auth.admin
    .from("sales_shifts")
    .select(
      "id, status, cashier_name, opening_cash, actual_cash, expected_cash, cash_sales, card_sales, expenses, withdrawals, deposits, difference, opened_at, closed_at, notes",
    )
    .eq("organization_id", auth.device.organizationId)
    .eq("device_key_id", auth.device.id)
    .gte("opened_at", `${today}T00:00:00.000Z`)
    .order("opened_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const activeShift = (shifts ?? []).find((s: ShiftRow) => s.status === "open");

  return NextResponse.json({
    success: true,
    activeShift: activeShift ? toShiftDTO(activeShift) : null,
    todayShifts: (shifts ?? []).map(toShiftDTO),
  });
}

export async function POST(request: Request) {
  const auth = await authenticateDepartmentDevice(request, "pos");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const cap = requireDepartmentDeviceCapability(auth, "pos_shift");
  if (!cap.ok) {
    return NextResponse.json({ success: false, error: cap.error }, { status: cap.status });
  }

  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  // ── فتح وردية ──
  if (action === "open") {
    const parsed = openShiftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "بيانات الفتح غير صحيحة" },
        { status: 400 },
      );
    }

    if (canUseDemoFallback()) {
      const existing = demoShifts.find(
        (s) => s.status === "open" && s.deviceId === auth.device.id,
      );
      if (existing) {
        return NextResponse.json({ success: false, error: "توجد وردية مفتوحة بالفعل" }, { status: 400 });
      }
      const shift: ShiftRow = {
        id: `shift-${Date.now()}`,
        deviceId: auth.device.id,
        organizationId: auth.device.organizationId,
        branchId: auth.device.branchId,
        cashierName: parsed.data.cashierName || auth.device.deviceName,
        openingCash: parsed.data.openingCash,
        actualCash: null,
        expectedCash: parsed.data.openingCash,
        cashSales: 0,
        cardSales: 0,
        expenses: 0,
        withdrawals: 0,
        deposits: 0,
        difference: 0,
        status: "open",
        openedAt: new Date().toISOString(),
        closedAt: null,
        notes: null,
      };
      demoShifts.unshift(shift);
      return NextResponse.json({ success: true, shift: toShiftDTO(shift) });
    }

    // الإنتاج: التحقق من عدم وجود وردية مفتوحة
    const { data: existing } = await auth.admin
      .from("sales_shifts")
      .select("id")
      .eq("organization_id", auth.device.organizationId)
      .eq("device_key_id", auth.device.id)
      .eq("status", "open")
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: false, error: "توجد وردية مفتوحة بالفعل" }, { status: 400 });
    }

    const { data: shift, error } = await auth.admin
      .from("sales_shifts")
      .insert({
        organization_id: auth.device.organizationId,
        branch_id: auth.device.branchId,
        device_key_id: auth.device.id,
        cashier_name: parsed.data.cashierName || auth.device.deviceName,
        opening_cash: parsed.data.openingCash,
        expected_cash: parsed.data.openingCash,
        status: "open",
        opened_at: new Date().toISOString(),
      })
      .select(
        "id, status, cashier_name, opening_cash, actual_cash, expected_cash, cash_sales, card_sales, expenses, withdrawals, deposits, difference, opened_at, closed_at, notes",
      )
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // قيد درج النقدية (افتتاحي)
    await auth.admin.from("cash_drawer_entries").insert({
      organization_id: auth.device.organizationId,
      branch_id: auth.device.branchId,
      shift_id: shift.id,
      entry_type: "opening",
      amount: parsed.data.openingCash,
      memo: "رصيد افتتاحي للوردية",
    });

    return NextResponse.json({ success: true, shift: toShiftDTO(shift) });
  }

  // ── إغلاق وردية ──
  if (action === "close") {
    const parsed = closeShiftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "بيانات الإغلاق غير صحيحة" },
        { status: 400 },
      );
    }

    if (canUseDemoFallback()) {
      const shift = demoShifts.find(
        (s) => s.id === parsed.data.shiftId && s.status === "open",
      );
      if (!shift) {
        return NextResponse.json(
          { success: false, error: "الوردية غير موجودة أو مغلقة" },
          { status: 404 },
        );
      }
      shift.status = "closed";
      shift.actualCash = parsed.data.actualCash;
      shift.closedAt = new Date().toISOString();
      shift.notes = parsed.data.notes;
      shift.difference = parsed.data.actualCash - Number(shift.expectedCash ?? 0);
      return NextResponse.json({ success: true, shift: toShiftDTO(shift) });
    }

    const { data: shift, error } = await auth.admin
      .from("sales_shifts")
      .select("id, opening_cash, expected_cash, cash_sales, card_sales, expenses, withdrawals, deposits, status")
      .eq("id", parsed.data.shiftId)
      .eq("organization_id", auth.device.organizationId)
      .eq("device_key_id", auth.device.id)
      .eq("status", "open")
      .maybeSingle();

    if (error || !shift) {
      return NextResponse.json(
        { success: false, error: "الوردية غير موجودة أو مغلقة" },
        { status: 404 },
      );
    }

    const expectedCash = Number(shift.expected_cash ?? 0);
    const difference = parsed.data.actualCash - expectedCash;

    await auth.admin
      .from("sales_shifts")
      .update({
        status: "closed",
        actual_cash: parsed.data.actualCash,
        difference,
        closed_at: new Date().toISOString(),
        notes: parsed.data.notes,
      })
      .eq("id", shift.id);

    return NextResponse.json({
      success: true,
      shiftId: shift.id,
      openingCash: Number(shift.opening_cash),
      actualCash: parsed.data.actualCash,
      expectedCash,
      cashSales: Number(shift.cash_sales ?? 0),
      cardSales: Number(shift.card_sales ?? 0),
      expenses: Number(shift.expenses ?? 0),
      difference,
    });
  }

  return NextResponse.json(
    { success: false, error: "action مطلوب: open أو close" },
    { status: 400 },
  );
}
