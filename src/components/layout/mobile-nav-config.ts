/**
 * Mobile Navigation Configuration
 * Defines the bottom navigation structure for mobile devices
 * Each item is a main area that users can access quickly
 */

import {
  BarChart3,
  Boxes,
  FileText,
  Home,
  Megaphone,
  Receipt,
  ShoppingCart,
  Settings,
  Truck,
  Utensils,
} from "lucide-react";

export const mobileMainNav = [
  {
    title: "الرئيسية",
    href: "/dashboard",
    icon: Home,
    label: "الرئيسية",
    description: "نظرة عامة سريعة",
  },
  {
    title: "المبيعات",
    href: "/dashboard/customer-invoices/new",
    icon: Receipt,
    label: "بيع",
    description: "فاتورة جديدة",
  },
  {
    title: "المخزون",
    href: "/dashboard/inventory",
    icon: Boxes,
    label: "مخزون",
    description: "إدارة المخزون",
  },
  {
    title: "المشتريات",
    href: "/dashboard/purchase-orders",
    icon: ShoppingCart,
    label: "شراء",
    description: "طلبات الشراء",
  },
  {
    title: "التقارير",
    href: "/dashboard/reports",
    icon: BarChart3,
    label: "تقارير",
    description: "التحليلات",
  },
];

export const mobileQuickActions = [
  {
    title: "فاتورة جديدة",
    description: "بيع سريع وتخفيض مخزون تلقائي",
    href: "/dashboard/customer-invoices/new",
    icon: Receipt,
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    title: "طلب شراء",
    description: "حول النقص إلى طلب للمورد",
    href: "/dashboard/purchase-orders",
    icon: ShoppingCart,
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  {
    title: "جرد سريع",
    description: "راجع الكميات",
    href: "/dashboard/stock-counts",
    icon: Boxes,
    className: "bg-green-50 text-green-700 border-green-200",
  },
  {
    title: "منشور تسويقي",
    description: "انشر عرضًا",
    href: "/dashboard/marketing/create",
    icon: Megaphone,
    className: "bg-violet-50 text-violet-700 border-violet-200",
  },
];

export const mobileAllItems = [
  { title: "التشغيل", href: "/dashboard/inventory", icon: Boxes },
  { title: "المشتريات", href: "/dashboard/purchase-orders", icon: Truck },
  { title: "المبيعات", href: "/dashboard/customer-invoices/new", icon: Receipt },
  { title: "القائمة", href: "/dashboard/recipes", icon: Utensils },
  { title: "التسويق", href: "/dashboard/marketing", icon: Megaphone },
  { title: "التقارير", href: "/dashboard/reports", icon: BarChart3 },
  { title: "المستندات", href: "/dashboard/invoices", icon: FileText },
  { title: "الإعدادات", href: "/dashboard/settings", icon: Settings },
];
