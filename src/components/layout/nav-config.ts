import {
  BarChart3,
  Barcode,
  Bell,
  Boxes,
  Building2,
  Calculator,
  CalendarDays,
  ChefHat,
  ClipboardCheck,
  CircleDollarSign,
  FileText,
  Gauge,
  Megaphone,
  PackageSearch,
  Receipt,
  ReceiptText,
  Printer,
  RotateCcw,
  Settings,
  Shield,
  ShoppingCart,
  Smartphone,
  Store,
  Table2,
  Truck,
  Users,
  Utensils,
  WalletCards,
} from "lucide-react";

export const appNav = [
  {
    title: "نظرة عامة",
    items: [
      { title: "لوحة التحكم", href: "/dashboard", icon: Gauge },
      { title: "الفروع", href: "/dashboard/branches", icon: Building2 },
    ],
  },
  {
    title: "التشغيل",
    items: [
      { title: "التوفير الذكي", href: "/dashboard/smart-savings", icon: Smartphone },
      { title: "المخزون", href: "/dashboard/inventory", icon: Boxes },
      { title: "الأصناف والباركود", href: "/dashboard/items", icon: Barcode },
      { title: "الجرد", href: "/dashboard/stock-counts", icon: ClipboardCheck },
      { title: "الهدر", href: "/dashboard/waste", icon: PackageSearch },
      { title: "التحويلات", href: "/dashboard/transfers", icon: Truck },
    ],
  },
  {
    title: "المشتريات",
    items: [
      { title: "الموردون", href: "/dashboard/suppliers", icon: Store },
      { title: "طلبات الشراء", href: "/dashboard/purchase-orders", icon: ShoppingCart },
      { title: "فواتير الموردين", href: "/dashboard/invoices", icon: ReceiptText },
    ],
  },
  {
    title: "المبيعات",
    items: [
      { title: "شاشة بيع سريعة", href: "/dashboard/customer-invoices/new", icon: ShoppingCart },
      { title: "إدارة الطاولات", href: "/dashboard/tables", icon: Table2 },
      { title: "فواتير العملاء", href: "/dashboard/customer-invoices", icon: Printer },
      { title: "مرتجعات البيع", href: "/dashboard/sales-returns", icon: RotateCcw },
      { title: "العملاء والذمم", href: "/dashboard/customers", icon: Users },
      { title: "الورديات", href: "/dashboard/shifts", icon: WalletCards },
    ],
  },
  {
    title: "المدفوعات",
    items: [
      { title: "دفع الفواتير", href: "/dashboard/bill-payments", icon: Receipt },
      { title: "الخصم المباشر", href: "/dashboard/direct-debit", icon: WalletCards },
    ],
  },
  {
    title: "الوصفات والقائمة",
    items: [
      { title: "الوصفات", href: "/dashboard/recipes", icon: ChefHat },
      { title: "أطباق القائمة", href: "/dashboard/menu-items", icon: Utensils },
      { title: "تكلفة الطعام", href: "/dashboard/food-cost", icon: WalletCards },
      { title: "محاسبة التكاليف", href: "/dashboard/cost-accounting", icon: Calculator },
    ],
  },
  {
    title: "التسويق",
    items: [
      { title: "مركز التسويق", href: "/dashboard/marketing", icon: Megaphone },
      { title: "تقويم النشر", href: "/dashboard/marketing/calendar", icon: CalendarDays },
      { title: "حسابات التواصل", href: "/dashboard/marketing/accounts", icon: Bell },
    ],
  },
  {
    title: "التقارير",
    items: [
      { title: "التقارير", href: "/dashboard/reports", icon: BarChart3 },
      { title: "أموالي", href: "/dashboard/amwali", icon: CircleDollarSign },
      { title: "التقويم المالي", href: "/dashboard/financial-calendar", icon: CalendarDays },
    ],
  },
  {
    title: "الإعدادات",
    items: [
      { title: "الإعدادات", href: "/dashboard/settings", icon: Settings },
      { title: "المستخدمون والصلاحيات", href: "/dashboard/settings/users", icon: Users },
      { title: "الاشتراك والفوترة", href: "/dashboard/billing", icon: FileText },
    ],
  },
];

export const adminNav = [
  { title: "لوحة الأدمن", href: "/admin", icon: Shield },
  { title: "المؤسسات", href: "/admin/organizations", icon: Building2 },
  { title: "المستخدمون", href: "/admin/users", icon: Users },
  { title: "الخطط", href: "/admin/plans", icon: WalletCards },
  { title: "مفاتيح الميزات", href: "/admin/feature-flags", icon: Settings },
  { title: "سجلات النظام", href: "/admin/system-logs", icon: FileText },
  { title: "تذاكر الدعم", href: "/admin/support-tickets", icon: Bell },
];
