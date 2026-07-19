export const REWAQ_MODULES = [
  "dashboard",
  "pos",
  "shifts",
  "tables",
  "kitchen",
  "expo",
  "restaurant_workflow",
  "digital_presence",
  "sales",
  "customers",
  "inventory",
  "recipes",
  "waste",
  "purchasing",
  "suppliers",
  "transfers",
  "production",
  "reports",
  "accounting",
  "financial_services",
  "marketing",
  "automation",
  "administration",
] as const;

export type RewaqModule = (typeof REWAQ_MODULES)[number];
export type RewaqPlanCode = "starter" | "growth" | "scale";

export type RewaqPlanLimits = {
  maxBranches: number | null;
  maxUsers: number | null;
  maxDevices: number | null;
};

export type RewaqPlanDefinition = {
  code: RewaqPlanCode;
  name: string;
  shortName: string;
  monthlyPriceUsd: number;
  description: string;
  modules: readonly RewaqModule[];
  limits: RewaqPlanLimits;
  highlights: readonly string[];
  recommended?: boolean;
};

const OPERATIONS_MODULES = [
  "dashboard",
  "pos",
  "shifts",
  "sales",
  "customers",
  "reports",
  "administration",
] as const satisfies readonly RewaqModule[];

const MANAGEMENT_MODULES = [
  ...OPERATIONS_MODULES,
  "tables",
  "kitchen",
  "expo",
  "restaurant_workflow",
  "digital_presence",
  "inventory",
  "recipes",
  "waste",
  "purchasing",
  "suppliers",
  "transfers",
  "production",
] as const satisfies readonly RewaqModule[];

export const REWAQ_PLANS: Record<RewaqPlanCode, RewaqPlanDefinition> = {
  starter: {
    code: "starter",
    name: "رواق للمطعم الصغير",
    shortName: "المطعم الصغير",
    monthlyPriceUsd: 150,
    description: "للمطعم الصغير الذي يحتاج الكاشير والمبيعات والورديات والتقارير الأساسية.",
    modules: OPERATIONS_MODULES,
    limits: { maxBranches: 1, maxUsers: 8, maxDevices: 4 },
    highlights: [
      "فرع واحد",
      "حتى 8 مستخدمين و4 أجهزة",
      "نقطة بيع وورديات",
      "عملاء وفواتير مبيعات",
      "تقارير تشغيل أساسية",
    ],
  },
  growth: {
    code: "growth",
    name: "رواق للمطعم المتوسط",
    shortName: "المطعم المتوسط",
    monthlyPriceUsd: 250,
    description:
      "للمطعم المتوسط الذي يريد دورة النادل والطاولات والمطبخ مع المخزون والحضور الرقمي.",
    modules: MANAGEMENT_MODULES,
    limits: { maxBranches: 3, maxUsers: 25, maxDevices: 12 },
    highlights: [
      "حتى 3 فروع",
      "حتى 25 مستخدمًا و12 جهازًا",
      "كل مزايا المطعم الصغير",
      "سير تكة الآمن: نادل وطاولات وKDS وExpo",
      "منيو إلكتروني وموقع مترابطان",
      "مخزون ووصفات وتكلفة طبق وهدر",
      "موردون ومشتريات وتحويلات وإنتاج",
    ],
    recommended: true,
  },
  scale: {
    code: "scale",
    name: "رواق للمطعم الكبير",
    shortName: "المطعم الكبير",
    monthlyPriceUsd: 350,
    description: "للمطعم الكبير والمتعدد الفروع مع المحاسبة المتقدمة والتسويق والأتمتة.",
    modules: REWAQ_MODULES,
    limits: { maxBranches: null, maxUsers: null, maxDevices: null },
    highlights: [
      "كل وحدات رواق مفتوحة",
      "محاسبة مزدوجة ومراكز تكلفة وإقفال",
      "خدمات مالية وتقارير متقدمة",
      "تسويق ونشر وأتمتة",
      "حدود تشغيل تعاقدية غير مقيدة داخل النظام",
    ],
  },
};

export const REWAQ_PLAN_LIST = [
  REWAQ_PLANS.starter,
  REWAQ_PLANS.growth,
  REWAQ_PLANS.scale,
] as const;

export function normalizePlanCode(value: unknown): RewaqPlanCode {
  return value === "growth" || value === "scale" ? value : "starter";
}

export function getRewaqPlan(value: unknown): RewaqPlanDefinition {
  return REWAQ_PLANS[normalizePlanCode(value)];
}

export function planHasModule(planCode: unknown, module: RewaqModule) {
  return getRewaqPlan(planCode).modules.includes(module);
}

export const MODULE_LABELS: Record<RewaqModule, string> = {
  dashboard: "لوحة التحكم",
  pos: "نقطة البيع",
  shifts: "الورديات والصندوق",
  tables: "الطاولات والجرسون",
  kitchen: "شاشة المطبخ",
  expo: "التجميع والتسليم",
  restaurant_workflow: "دورة النادل والطلب (تكة)",
  digital_presence: "المنيو الإلكتروني والموقع",
  sales: "المبيعات والفواتير",
  customers: "العملاء والذمم",
  inventory: "المخزون والمستودعات",
  recipes: "الوصفات وتكلفة الطبق",
  waste: "الهدر والتالف",
  purchasing: "المشتريات",
  suppliers: "الموردون",
  transfers: "التحويلات",
  production: "الإنتاج",
  reports: "التقارير",
  accounting: "المحاسبة الكاملة",
  financial_services: "الخدمات المالية",
  marketing: "التسويق والنشر",
  automation: "الأتمتة",
  administration: "الإعدادات والإدارة",
};

export type ModuleRouteRule = {
  prefix: string;
  module: RewaqModule;
};

export const MODULE_ROUTE_RULES: readonly ModuleRouteRule[] = [
  { prefix: "/dashboard/accounting", module: "accounting" },
  { prefix: "/dashboard/cost-accounting", module: "accounting" },
  { prefix: "/dashboard/amwali", module: "financial_services" },
  { prefix: "/dashboard/bill-payments", module: "financial_services" },
  { prefix: "/dashboard/direct-debit", module: "financial_services" },
  { prefix: "/dashboard/smart-savings", module: "financial_services" },
  { prefix: "/dashboard/financial-calendar", module: "financial_services" },
  { prefix: "/dashboard/marketing", module: "marketing" },
  { prefix: "/dashboard/social-publishing", module: "marketing" },
  { prefix: "/dashboard/purchase-orders", module: "purchasing" },
  { prefix: "/dashboard/invoices", module: "purchasing" },
  { prefix: "/dashboard/suppliers", module: "suppliers" },
  { prefix: "/dashboard/inventory", module: "inventory" },
  { prefix: "/dashboard/items", module: "inventory" },
  { prefix: "/dashboard/warehouses", module: "inventory" },
  { prefix: "/dashboard/stock-movements", module: "inventory" },
  { prefix: "/dashboard/stock-counts", module: "inventory" },
  { prefix: "/dashboard/transfers", module: "transfers" },
  { prefix: "/dashboard/waste", module: "waste" },
  { prefix: "/dashboard/recipes", module: "recipes" },
  { prefix: "/dashboard/menu-items", module: "recipes" },
  { prefix: "/dashboard/modifiers", module: "recipes" },
  { prefix: "/dashboard/food-cost", module: "recipes" },
  { prefix: "/dashboard/production", module: "production" },
  { prefix: "/dashboard/customer-invoices", module: "sales" },
  { prefix: "/dashboard/sales-returns", module: "sales" },
  { prefix: "/dashboard/customers", module: "customers" },
  { prefix: "/dashboard/shifts", module: "shifts" },
  { prefix: "/dashboard/tables", module: "tables" },
  { prefix: "/dashboard/orders", module: "restaurant_workflow" },
  { prefix: "/dashboard/digital-presence", module: "digital_presence" },
  { prefix: "/dashboard/reports", module: "reports" },
  { prefix: "/d/pos", module: "pos" },
  { prefix: "/d/kitchen", module: "kitchen" },
  { prefix: "/d/expo", module: "expo" },
  { prefix: "/d/waiter", module: "restaurant_workflow" },
  { prefix: "/d/inventory", module: "inventory" },
] as const;

export function moduleForPath(pathname: string): RewaqModule | null {
  return MODULE_ROUTE_RULES.find((rule) => pathname.startsWith(rule.prefix))?.module ?? null;
}

export function isRewaqModule(value: unknown): value is RewaqModule {
  return typeof value === "string" && (REWAQ_MODULES as readonly string[]).includes(value);
}

export function isRewaqPlanCode(value: unknown): value is RewaqPlanCode {
  return value === "starter" || value === "growth" || value === "scale";
}
