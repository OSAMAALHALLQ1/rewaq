/**
 * Mobile Navigation Configuration
 * Defines the bottom navigation structure for mobile devices.
 */

import {
  BarChart3,
  Barcode,
  Boxes,
  Building2,
  Home,
  ListChecks,
  MonitorSmartphone,
  PackageMinus,
  ReceiptText,
  RotateCcw,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  Users,
  WalletCards,
} from "lucide-react";

export const mobileMainNav = [
  {
    title: "لوحة التحكم",
    href: "/dashboard",
    icon: Home,
    label: "اللوحة",
    description: "ملخص مالي ولحظي",
  },
  {
    title: "الأصناف / المواد",
    href: "/dashboard/items",
    icon: Barcode,
    label: "المواد",
    description: "دفتر الأصناف",
  },
  {
    title: "فواتير التوريد",
    href: "/dashboard/invoices",
    icon: ReceiptText,
    label: "توريد",
    description: "فواتير الموردين",
  },
  {
    title: "أوامر الشراء",
    href: "/dashboard/purchase-orders",
    icon: ShoppingCart,
    label: "شراء",
    description: "طلبات الموردين",
  },
  {
    title: "تقارير المخزن",
    href: "/dashboard/reports",
    icon: BarChart3,
    label: "تقارير",
    description: "الصادر والوارد",
  },
];

export const mobileQuickActions = [
  {
    title: "فاتورة توريد",
    description: "سجل فاتورة مورد مع الأصناف والكميات",
    href: "/dashboard/invoices",
    icon: ReceiptText,
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    title: "طلب شراء",
    description: "جهز طلب شراء لمورد",
    href: "/dashboard/purchase-orders",
    icon: ShoppingCart,
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  {
    title: "حركة مخزون",
    description: "راجع الصادر والوارد",
    href: "/dashboard/stock-movements",
    icon: Boxes,
    className: "bg-green-50 text-green-700 border-green-200",
  },
  {
    title: "تالف أو محاريق",
    description: "سجل التالف والمنظفات والمحاريق",
    href: "/dashboard/waste",
    icon: PackageMinus,
    className: "bg-red-50 text-red-700 border-red-200",
  },
];

export const mobileAllItems = [
  { title: "لوحة التحكم", href: "/dashboard", icon: Home },
  { title: "شاشة الكاشير POS", href: "/d/pos", icon: MonitorSmartphone },
  { title: "الورديات والصندوق", href: "/dashboard/shifts", icon: WalletCards },
  { title: "فواتير العملاء", href: "/dashboard/customer-invoices", icon: ReceiptText },
  { title: "العملاء والذمم", href: "/dashboard/customers", icon: Users },
  { title: "الموردون", href: "/dashboard/suppliers", icon: Store },
  { title: "فواتير التوريد", href: "/dashboard/invoices", icon: ReceiptText },
  { title: "طلبيات الشراء", href: "/dashboard/purchase-orders", icon: ShoppingCart },
  { title: "مخطط المخزن", href: "/dashboard/inventory", icon: Boxes },
  { title: "الأصناف / المواد", href: "/dashboard/items", icon: Barcode },
  { title: "حركات المخزن", href: "/dashboard/stock-movements", icon: Boxes },
  { title: "الجرد", href: "/dashboard/stock-counts", icon: ListChecks },
  { title: "التحويلات الداخلية", href: "/dashboard/transfers", icon: Truck },
  { title: "التالف والمحاريق", href: "/dashboard/waste", icon: PackageMinus },
  { title: "مرتجعات المبيعات", href: "/dashboard/sales-returns", icon: RotateCcw },
  { title: "لوحة المحاسبة", href: "/dashboard/accounting", icon: BarChart3 },
  { title: "دليل الحسابات", href: "/dashboard/accounting/accounts", icon: BarChart3 },
  { title: "ميزان المراجعة", href: "/dashboard/accounting/trial-balance", icon: BarChart3 },
  { title: "قائمة الأرباح والخسائر", href: "/dashboard/accounting/p-and-l", icon: BarChart3 },
  { title: "المركز المالي", href: "/dashboard/accounting/balance-sheet", icon: BarChart3 },
  { title: "تقارير المخزن", href: "/dashboard/reports", icon: BarChart3 },
  { title: "الفروع", href: "/dashboard/branches", icon: Building2 },
  { title: "الفوترة والاشتراك", href: "/dashboard/billing", icon: WalletCards },
  { title: "الإعدادات العامة", href: "/dashboard/settings", icon: Settings },
];
