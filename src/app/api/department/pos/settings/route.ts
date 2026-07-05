import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateDepartmentDevice } from "@/lib/department/auth";
import { canUseDemoFallback } from "@/lib/supabase/env";

const CURRENCY_MAP: Record<string, { symbol: string; name: string }> = {
  ILS: { symbol: "₪", name: "شيكل" },
  USD: { symbol: "$", name: "دولار" },
  JOD: { symbol: "د.أ", name: "دينار" },
  EGP: { symbol: "ج.م", name: "جنيه" },
  SAR: { symbol: "ر.س", name: "ريال" },
};

const DEFAULTS = {
  currency: "ILS",
  taxRate: 0,
  receiptHeader: null as string | null,
  receiptFooter: "شكراً لتعاملكم معنا",
  maxCashierDiscount: 0, // 0% للكاشير حسب سياسة رواق
  allowCashierRefund: false, // الإرجاع للمدير فقط
  requireShift: true, // لا بيع بدون وردية مفتوحة
  printOnCheckout: true,
  receiptWidth: "80mm",
};

function buildSettings(row: any) {
  const currency = row?.currency || DEFAULTS.currency;
  const currencyInfo = CURRENCY_MAP[currency] || CURRENCY_MAP.ILS;
  return {
    storeName: row?.storeName ?? row?.store_name ?? "رواق",
    storeAddress: row?.storeAddress ?? row?.store_address ?? "",
    taxNumber: row?.taxNumber ?? row?.tax_number ?? "",
    currency,
    currencySymbol: currencyInfo.symbol,
    currencyName: currencyInfo.name,
    taxRate: Number(row?.taxRate ?? row?.tax_rate ?? DEFAULTS.taxRate),
    receiptHeader: row?.receiptHeader ?? row?.receipt_header ?? DEFAULTS.receiptHeader,
    receiptFooter: row?.receiptFooter ?? row?.receipt_footer ?? DEFAULTS.receiptFooter,
    maxCashierDiscount: Number(row?.maxCashierDiscount ?? row?.max_cashier_discount ?? DEFAULTS.maxCashierDiscount),
    allowCashierRefund: row?.allowCashierRefund ?? row?.allow_cashier_refund ?? DEFAULTS.allowCashierRefund,
    requireShift: row?.requireShift ?? row?.require_shift ?? DEFAULTS.requireShift,
    printOnCheckout: row?.printOnCheckout ?? row?.print_on_checkout ?? DEFAULTS.printOnCheckout,
    receiptWidth: row?.receiptWidth ?? row?.receipt_width ?? DEFAULTS.receiptWidth,
  };
}

export async function GET(request: Request) {
  const auth = await authenticateDepartmentDevice(request, "pos");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  if (canUseDemoFallback()) {
    return NextResponse.json({
      success: true,
      settings: buildSettings({
        storeName: "رواق",
        storeAddress: "غزة، فلسطين",
        ...DEFAULTS,
      }),
    });
  }

  // بيانات المنظمة (الاسم/العنوان/الرقم الضريبي/العملة)
  const { data: org } = await auth.admin
    .from("organizations")
    .select("name, address, tax_number, currency")
    .eq("id", auth.device.organizationId)
    .maybeSingle();

  // إعدادات POS من الجدول المخصص
  const { data: posSettings } = await auth.admin
    .from("pos_settings")
    .select("*")
    .eq("organization_id", auth.device.organizationId)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    settings: buildSettings({
      ...org,
      storeName: org?.name,
      storeAddress: org?.address,
      taxNumber: org?.tax_number,
      currency: posSettings?.currency ?? org?.currency,
      ...posSettings,
    }),
  });
}

const updateSchema = z.object({
  currency: z.enum(["ILS", "USD", "JOD", "EGP", "SAR"]).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  receiptHeader: z.string().max(200).optional(),
  receiptFooter: z.string().max(200).optional(),
  maxCashierDiscount: z.coerce.number().min(0).max(100).optional(),
  allowCashierRefund: z.boolean().optional(),
  requireShift: z.boolean().optional(),
  printOnCheckout: z.boolean().optional(),
  receiptWidth: z.enum(["58mm", "80mm"]).optional(),
});

export async function POST(request: Request) {
  const auth = await authenticateDepartmentDevice(request, "pos");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  // تحديث الإعدادات = مدير فقط
  if (auth.device.role !== "manager") {
    return NextResponse.json(
      { success: false, error: "تحديث إعدادات نقطة البيع متاح للمدير فقط." },
      { status: 403 },
    );
  }

  if (canUseDemoFallback()) {
    return NextResponse.json({
      success: true,
      settings: buildSettings({ storeName: "رواق", ...DEFAULTS }),
      note: "وضع التجربة: لا يتم حفظ الإعدادات فعلياً.",
    });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "بيانات الإعدادات غير صحيحة" },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency;
  if (parsed.data.taxRate !== undefined) updates.tax_rate = parsed.data.taxRate;
  if (parsed.data.receiptHeader !== undefined) updates.receipt_header = parsed.data.receiptHeader;
  if (parsed.data.receiptFooter !== undefined) updates.receipt_footer = parsed.data.receiptFooter;
  if (parsed.data.maxCashierDiscount !== undefined) updates.max_cashier_discount = parsed.data.maxCashierDiscount;
  if (parsed.data.allowCashierRefund !== undefined) updates.allow_cashier_refund = parsed.data.allowCashierRefund;
  if (parsed.data.requireShift !== undefined) updates.require_shift = parsed.data.requireShift;
  if (parsed.data.printOnCheckout !== undefined) updates.print_on_checkout = parsed.data.printOnCheckout;
  if (parsed.data.receiptWidth !== undefined) updates.receipt_width = parsed.data.receiptWidth;

  // upsert: إن لم يوجد صف للمنظمة يُنشأ، وإلا يُحدّث
  const { data: updated, error } = await auth.admin
    .from("pos_settings")
    .upsert(
      { organization_id: auth.device.organizationId, ...updates },
      { onConflict: "organization_id" },
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // ندمج اسم المنظمة للرد
  const { data: org } = await auth.admin
    .from("organizations")
    .select("name, address, tax_number")
    .eq("id", auth.device.organizationId)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    settings: buildSettings({ ...org, storeName: org?.name, storeAddress: org?.address, taxNumber: org?.tax_number, ...updated }),
  });
}
