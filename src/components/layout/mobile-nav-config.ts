/**
 * Mobile Navigation Configuration
 * Defines the bottom navigation structure for mobile devices.
 */

import {
  BarChart3,
  Barcode,
  Boxes,
  ClipboardCheck,
  Home,
  PackageMinus,
  ReceiptText,
  RotateCcw,
  Settings,
  Store,
  Truck,
} from "lucide-react";

export const mobileMainNav = [
  {
    title: "لوحة المخزن",
    href: "/dashboard",
    icon: Home,
    label: "اللوحة",
    description: "متابعة المخزن",
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
    title: "طلبيات الأقسام",
    href: "/dashboard/purchase-orders",
    icon: ClipboardCheck,
    label: "طلبيات",
    description: "طلبات الأقسام",
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
    title: "طلب قسم",
    description: "جهز طلب صرف لقسم داخلي",
    href: "/dashboard/purchase-orders",
    icon: ClipboardCheck,
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
  { title: "لوحة المخزن", href: "/dashboard", icon: Boxes },
  { title: "مخطط المخزن", href: "/dashboard/stock-movements", icon: Boxes },
  { title: "الأصناف / المواد", href: "/dashboard/items", icon: Barcode },
  { title: "الموردون", href: "/dashboard/suppliers", icon: Store },
  { title: "فواتير التوريد", href: "/dashboard/invoices", icon: ReceiptText },
  { title: "التحويلات الداخلية", href: "/dashboard/transfers", icon: Truck },
  { title: "طلبيات الأقسام", href: "/dashboard/purchase-orders", icon: ClipboardCheck },
  { title: "التالف والمحاريق والمنظفات", href: "/dashboard/waste", icon: PackageMinus },
  { title: "مرتجعات المخزن", href: "/dashboard/sales-returns", icon: RotateCcw },
  { title: "تقارير المخزن", href: "/dashboard/reports", icon: BarChart3 },
  { title: "تقرير تذبذب الأسعار", href: "/dashboard/reports", icon: BarChart3 },
  { title: "الإعدادات / الأقسام", href: "/dashboard/settings", icon: Settings },
];
