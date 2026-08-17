import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  ChefHat,
  ClipboardCheck,
  Home,
  ListChecks,
  MonitorSmartphone,
  PackageMinus,
  ReceiptText,
  Settings,
  ShoppingCart,
  Store,
  Users,
  Utensils,
  Warehouse,
} from "lucide-react";
import type { Role } from "@/types/domain";

export type MobileNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  label: string;
};

const item = (
  title: string,
  label: string,
  href: string,
  icon: LucideIcon,
): MobileNavItem => ({ title, label, href, icon });

const MANAGEMENT_NAV = [
  item("لوحة الإدارة", "الإدارة", "/dashboard", Home),
  item("التقارير والتحليلات", "التقارير", "/dashboard/reports", BarChart3),
  item("الأقسام", "الأقسام", "/dashboard/branches", Building2),
  item("المستخدمون والفريق", "الفريق", "/dashboard/settings/users", Users),
  item("الإعدادات العامة", "الإعدادات", "/dashboard/settings", Settings),
] as const;

const ROLE_MOBILE_NAV: Readonly<Record<Role, readonly MobileNavItem[]>> = {
  super_admin: MANAGEMENT_NAV,
  organization_owner: MANAGEMENT_NAV,
  branch_manager: [
    item("لوحة التحكم", "اللوحة", "/dashboard", Home),
    item("فواتير العملاء", "المبيعات", "/dashboard/customer-invoices", ReceiptText),
    item("لوحة المخزون", "المخزون", "/dashboard/inventory/dashboard", Warehouse),
    item("طلبيات الشراء", "المشتريات", "/dashboard/purchase-orders", ShoppingCart),
    item("التقارير", "التقارير", "/dashboard/reports", BarChart3),
  ],
  cashier: [item("شاشة الكاشير POS", "الكاشير", "/d/pos", MonitorSmartphone)],
  inventory_manager: [
    item("لوحة المخزون", "المخزون", "/dashboard/inventory/dashboard", Warehouse),
    item("حركات المخزن", "الحركات", "/dashboard/stock-movements", Boxes),
    item("الجرد", "الجرد", "/dashboard/stock-counts", ListChecks),
    item("التحويلات", "التحويلات", "/dashboard/transfers", ArrowLeftRight),
    item("التالف والهدر", "الهدر", "/dashboard/waste", PackageMinus),
  ],
  purchasing_manager: [
    item("طلبيات الشراء", "الطلبات", "/dashboard/purchase-orders", ClipboardCheck),
    item("فواتير التوريد", "الفواتير", "/dashboard/invoices", ReceiptText),
    item("الموردون", "الموردون", "/dashboard/suppliers", Store),
  ],
  chef: [
    item("شاشة المطبخ", "المطبخ", "/d/kitchen", ChefHat),
    item("التجميع والتسليم", "التسليم", "/d/expo", Utensils),
  ],
  marketing_manager: [
    item("المنيو والموقع", "المنيو", "/dashboard/digital-presence", Store),
  ],
  accountant: [
    item("لوحة المحاسبة", "المحاسبة", "/dashboard/accounting", Calculator),
    item("فواتير التوريد", "الموردون", "/dashboard/invoices", ReceiptText),
    item("فواتير العملاء", "العملاء", "/dashboard/customer-invoices", ReceiptText),
    item("التقارير", "التقارير", "/dashboard/reports", BarChart3),
  ],
  staff: [item("شاشة النادل", "النادل", "/d/waiter", Utensils)],
};

export function mobileMainNavForRole(role: Role): readonly MobileNavItem[] {
  return ROLE_MOBILE_NAV[role];
}
