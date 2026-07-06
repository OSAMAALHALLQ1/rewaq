/**
 * Shared accounting constants and Arabic UX helper texts.
 * Safe for both server and client components (no server-only imports).
 */

export const EXPENSE_CATEGORIES = [
  "إيجار",
  "رواتب",
  "كهرباء",
  "غاز",
  "مياه",
  "تنظيف",
  "توصيل",
  "صيانة",
  "إنترنت",
  "تسويق",
  "مواد تغليف",
  "أخرى",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: "أصول",
  liability: "التزامات",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expense: "مصروفات",
  cogs: "تكلفة مبيعات",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقدي (الصندوق)",
  bank: "بنك / بطاقة",
};

/**
 * Arabic explanations of accounting terms for non-accountants.
 * Shown as helper text / info boxes across the ERP layer (progressive disclosure).
 */
export const ACCOUNTING_TERM_HELP: Record<string, string> = {
  cogs: "تكلفة البضاعة: تكلفة المواد أو المنتجات التي تم بيعها.",
  net_profit: "صافي الربح: المبيعات ناقص التكاليف والمصروفات.",
  accounts_payable: "ذمم الموردين: المبالغ المتبقية عليك للموردين.",
  accounts_receivable: "ذمم العملاء: المبالغ المتبقية لك عند العملاء.",
  trial_balance: "ميزان المراجعة: تقرير يساعد المحاسب على التأكد من توازن الحسابات (مجموع المدين = مجموع الدائن).",
  general_ledger: "دفتر الأستاذ: كشف حركة تفصيلي لكل حساب يوضح كل قيد أثّر عليه ورصيده الجاري.",
  journal_entry: "القيد اليومي: تسجيل محاسبي لكل عملية مالية بطرفين متساويين: مدين ودائن.",
  cost_center: "مركز التكلفة: تقسيم داخلي (صالة، توصيل، مطبخ...) يساعدك على معرفة ربحية كل قسم.",
  period_closing: "الإقفال الشهري: قفل شهر محاسبي بعد مراجعته لمنع التعديل على قيوده القديمة.",
  chart_of_accounts: "دليل الحسابات: قائمة الحسابات المنظمة التي تُسجَّل عليها كل العمليات المالية.",
  opening_balance: "الرصيد الافتتاحي: رصيد الحساب عند بداية استخدام النظام.",
  reversal: "القيد العكسي: بدلاً من حذف قيد خاطئ، يُنشأ قيد معاكس له يلغي أثره ويحفظ سجل التدقيق.",
};
