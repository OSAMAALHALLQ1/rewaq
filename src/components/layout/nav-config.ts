import {
  BarChart3,
  Barcode,
  BookOpen,
  Boxes,
  Building2,
  Calculator,
  Calendar,
  ClipboardCheck,
  Keyboard,
  ClipboardList,
  Coins,
  CreditCard,
  Factory,
  FileSpreadsheet,
  FileText,
  Gauge,
  ArrowLeftRight,
  Landmark,
  ListChecks,
  Megaphone,
  MonitorSmartphone,
  PackageMinus,
  Percent,
  PieChart,
  PiggyBank,
  ReceiptText,
  RotateCcw,
  Scale,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Tablet,
  TrendingUp,
  Truck,
  UserCheck,
  Utensils,
  ListPlus,
  Table,
  Users,
  WalletCards,
  Warehouse,
  Shield,
  BookOpenCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  roles?: string[];
  badge?: string;
};

export type NavGroup = {
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  items: NavItem[];
};

export const pinnedNav: NavItem[] = [
  { title: "لوحة التحكم", href: "/dashboard", icon: Gauge },
];

export const appNav: NavGroup[] = [
  {
    title: "نقاط البيع والتشغيل",
    icon: MonitorSmartphone,
    defaultOpen: true,
    items: [
      { title: "شاشة الكاشير POS", href: "/d/pos", icon: MonitorSmartphone, badge: "أساسي" },
      { title: "الورديات والصندوق", href: "/dashboard/shifts", icon: WalletCards },
      { title: "الطاولات", href: "/dashboard/tables", icon: Table },
    ],
  },
  {
    title: "المبيعات",
    icon: ShoppingCart,
    items: [
      { title: "فواتير العملاء", href: "/dashboard/customer-invoices", icon: ReceiptText },
      { title: "العملاء والذمم", href: "/dashboard/customers", icon: Users },
      { title: "مرتجعات المبيعات", href: "/dashboard/sales-returns", icon: RotateCcw },
    ],
  },
  {
    title: "المشتريات",
    icon: Truck,
    items: [
      { title: "الموردون", href: "/dashboard/suppliers", icon: Store },
      { title: "فواتير التوريد", href: "/dashboard/invoices", icon: ReceiptText },
      { title: "طلبيات الشراء", href: "/dashboard/purchase-orders", icon: ClipboardCheck },
    ],
  },
  {
    title: "المخزون والمستودعات",
    icon: Boxes,
    items: [
      { title: "لوحة تحكم المخزون", href: "/dashboard/inventory/dashboard", icon: Gauge },
      { title: "مخطط المخزن", href: "/dashboard/inventory", icon: Warehouse },
      { title: "دليل المستودعات", href: "/dashboard/warehouses", icon: Building2 },
      { title: "الأصناف والمواد", href: "/dashboard/items", icon: Barcode },
      { title: "حركات المخزن", href: "/dashboard/stock-movements", icon: FileText },
      { title: "الجرد", href: "/dashboard/stock-counts", icon: ListChecks },
      { title: "التحويلات الداخلية", href: "/dashboard/transfers", icon: Truck },
      { title: "التالف والمحاريق", href: "/dashboard/waste", icon: PackageMinus },
    ],
  },
  {
    title: "التصنيع والإنتاج",
    icon: Factory,
    items: [
      { title: "قوائم المواد (BOM)", href: "/dashboard/recipes", icon: ClipboardList },
      { title: "أوامر الإنتاج", href: "/dashboard/production", icon: Factory },
    ],
  },
  {
    title: "إدارة القائمة",
    icon: Utensils,
    items: [
      { title: "أطباق القائمة", href: "/dashboard/menu-items", icon: Utensils },
      { title: "مجموعات الإضافات", href: "/dashboard/modifiers", icon: ListPlus },
    ],
  },
  {
    title: "المحاسبة والمالية",
    icon: Calculator,
    defaultOpen: true,
    items: [
      { title: "لوحة المحاسبة", href: "/dashboard/accounting", icon: PieChart, roles: ["super_admin", "organization_owner", "accountant", "branch_manager"] },
      { title: "دليل الحسابات", href: "/dashboard/accounting/accounts", icon: BookOpenCheck, roles: ["super_admin", "organization_owner", "accountant"] },
      { title: "دفتر الأستاذ", href: "/dashboard/accounting/ledger", icon: Scale, roles: ["super_admin", "organization_owner", "accountant"] },
      { title: "ميزان المراجعة", href: "/dashboard/accounting/trial-balance", icon: FileSpreadsheet, roles: ["super_admin", "organization_owner", "accountant"] },
      { title: "دفتر اليومية العامة", href: "/dashboard/accounting/journal", icon: BookOpen, roles: ["super_admin", "organization_owner", "accountant"] },
      { title: "سند القبض والصرف", href: "/dashboard/accounting/vouchers", icon: Landmark, roles: ["super_admin", "organization_owner", "accountant"] },
      { title: "الذمم الدائنة", href: "/dashboard/accounting/payables", icon: Users, roles: ["super_admin", "organization_owner", "accountant"] },
      { title: "الذمم المدينة", href: "/dashboard/accounting/receivables", icon: UserCheck, roles: ["super_admin", "organization_owner", "accountant"] },
      { title: "قائمة الأرباح والخسائر", href: "/dashboard/accounting/p-and-l", icon: TrendingUp, roles: ["super_admin", "organization_owner", "accountant"] },
      { title: "المركز المالي", href: "/dashboard/accounting/balance-sheet", icon: Landmark, roles: ["super_admin", "organization_owner", "accountant"] },
      { title: "التدفق النقدي", href: "/dashboard/accounting/cash-flow", icon: ArrowLeftRight, roles: ["super_admin", "organization_owner", "accountant"] },
      { title: "تقرير الضرائب", href: "/dashboard/accounting/tax", icon: Percent, roles: ["super_admin", "organization_owner", "accountant"] },
      { title: "المصروفات", href: "/dashboard/accounting/expenses", icon: WalletCards, roles: ["super_admin", "organization_owner", "accountant", "branch_manager"] },
      { title: "مراكز التكلفة", href: "/dashboard/accounting/cost-centers", icon: Coins, roles: ["super_admin", "organization_owner", "accountant"] },
      { title: "الإقفال الشهري", href: "/dashboard/accounting/closing", icon: Calendar, roles: ["super_admin", "organization_owner", "accountant"] },
      { title: "إعدادات المحاسبة", href: "/dashboard/accounting/settings", icon: Settings, roles: ["super_admin", "organization_owner"] },
      { title: "محاسبة التكاليف", href: "/dashboard/cost-accounting", icon: Calculator },
      { title: "تحليل تكلفة الطعام", href: "/dashboard/food-cost", icon: WalletCards, roles: ["super_admin", "organization_owner", "accountant", "branch_manager"] },
    ],
  },
  {
    title: "التقارير",
    icon: BarChart3,
    items: [
      { title: "تقارير المخزن", href: "/dashboard/reports", icon: BarChart3 },
      { title: "تقرير تذبذب الأسعار", href: "/dashboard/reports?type=price_changes", icon: TrendingUp },
    ],
  },
  {
    title: "الخدمات المالية",
    icon: Landmark,
    items: [
      { title: "أموالي", href: "/dashboard/amwali", icon: Coins },
      { title: "دفع الفواتير", href: "/dashboard/bill-payments", icon: CreditCard },
      { title: "الخصم المباشر", href: "/dashboard/direct-debit", icon: Landmark },
      { title: "التوفير الذكي", href: "/dashboard/smart-savings", icon: PiggyBank },
      { title: "التقويم المالي", href: "/dashboard/financial-calendar", icon: Calendar },
    ],
  },
  {
    title: "التسويق والنشر",
    icon: Megaphone,
    items: [
      { title: "إدارة التسويق", href: "/dashboard/marketing", icon: ClipboardList },
      { title: "النشر عبر السوشيال", href: "/dashboard/social-publishing", icon: Megaphone },
    ],
  },
  {
    title: "الإعدادات",
    icon: Settings,
    items: [
      { title: "الفروع", href: "/dashboard/branches", icon: Building2 },
      { title: "المستخدمون والفريق", href: "/dashboard/settings/users", icon: UserCheck },
      { title: "إدارة الموظفين", href: "/dashboard/settings/devices?tab=staff", icon: Users },
      { title: "الأجهزة والأكواد", href: "/dashboard/settings/devices", icon: Tablet },
      { title: "مركز الاختصارات", href: "/dashboard/settings#shortcuts", icon: Keyboard },
      { title: "الإعدادات العامة", href: "/dashboard/settings", icon: SlidersHorizontal },
      { title: "الفوترة والاشتراك", href: "/dashboard/billing", icon: WalletCards },
    ],
  },
];

export const accountingNav: NavGroup = {
  title: "المحاسبة والمالية",
  icon: Calculator,
  items: [
    { title: "لوحة المحاسبة", href: "/dashboard/accounting", icon: PieChart, roles: ["super_admin", "organization_owner", "accountant", "branch_manager"] },
    { title: "دليل الحسابات", href: "/dashboard/accounting/accounts", icon: BookOpenCheck, roles: ["super_admin", "organization_owner", "accountant"] },
    { title: "دفتر الأستاذ", href: "/dashboard/accounting/ledger", icon: Scale, roles: ["super_admin", "organization_owner", "accountant"] },
    { title: "ميزان المراجعة", href: "/dashboard/accounting/trial-balance", icon: FileSpreadsheet, roles: ["super_admin", "organization_owner", "accountant"] },
    { title: "قائمة الأرباح والخسائر", href: "/dashboard/accounting/p-and-l", icon: TrendingUp, roles: ["super_admin", "organization_owner", "accountant"] },
    { title: "المركز المالي", href: "/dashboard/accounting/balance-sheet", icon: Landmark, roles: ["super_admin", "organization_owner", "accountant"] },
    { title: "المصروفات", href: "/dashboard/accounting/expenses", icon: WalletCards, roles: ["super_admin", "organization_owner", "accountant", "branch_manager"] },
    { title: "مراكز التكلفة", href: "/dashboard/accounting/cost-centers", icon: Coins, roles: ["super_admin", "organization_owner", "accountant"] },
    { title: "الإقفال الشهري", href: "/dashboard/accounting/closing", icon: Calendar, roles: ["super_admin", "organization_owner", "accountant"] },
    { title: "إعدادات المحاسبة", href: "/dashboard/accounting/settings", icon: Settings, roles: ["super_admin", "organization_owner"] },
  ],
};

export const adminNav: NavItem[] = [
  { title: "لوحة الأدمن", href: "/admin", icon: Shield },
  { title: "طلبات التسجيل", href: "/admin/account-requests", icon: UserCheck },
  { title: "المؤسسات", href: "/admin/organizations", icon: Building2 },
  { title: "المستخدمون", href: "/admin/users", icon: Users },
  { title: "الخطط", href: "/admin/plans", icon: WalletCards },
  { title: "مفاتيح الميزات", href: "/admin/feature-flags", icon: Settings },
  { title: "سجلات النظام", href: "/admin/system-logs", icon: FileText },
  { title: "تذاكر الدعم", href: "/admin/support-tickets", icon: BarChart3 },
];
