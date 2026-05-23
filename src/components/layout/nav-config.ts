import {
  BarChart3,
  Barcode,
  Bell,
  Boxes,
  Building2,
  ClipboardCheck,
  FileText,
  Gauge,
  PackageMinus,
  ReceiptText,
  RotateCcw,
  Settings,
  Shield,
  Store,
  Truck,
  UserCheck,
  Users,
  WalletCards,
} from "lucide-react";

export const appNav = [
  {
    title: "إدارة المخزن",
    items: [
      { title: "لوحة المخزن", href: "/dashboard", icon: Gauge },
      { title: "مخطط المخزن (المخزون)", href: "/dashboard/inventory", icon: Boxes },
      { title: "حركات المخزن (الصادر والوارد)", href: "/dashboard/stock-movements", icon: FileText },
      { title: "الأصناف / المواد", href: "/dashboard/items", icon: Barcode },
      { title: "الموردون", href: "/dashboard/suppliers", icon: Store },
      { title: "فواتير التوريد", href: "/dashboard/invoices", icon: ReceiptText },
      { title: "التحويلات الداخلية", href: "/dashboard/transfers", icon: Truck },
      { title: "طلبيات الأقسام", href: "/dashboard/purchase-orders", icon: ClipboardCheck },
      { title: "التالف والمحاريق", href: "/dashboard/waste", icon: PackageMinus },
      { title: "مرتجعات المخزن", href: "/dashboard/sales-returns", icon: RotateCcw },
      { title: "تقارير المخزن", href: "/dashboard/reports", icon: BarChart3 },
      { title: "تقرير تذبذب الأسعار", href: "/dashboard/reports?type=price_changes", icon: BarChart3 },
      { title: "الإعدادات / الأقسام", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

export const adminNav = [
  { title: "لوحة الأدمن", href: "/admin", icon: Shield },
  { title: "طلبات التسجيل", href: "/admin/account-requests", icon: UserCheck },
  { title: "المؤسسات", href: "/admin/organizations", icon: Building2 },
  { title: "المستخدمون", href: "/admin/users", icon: Users },
  { title: "الخطط", href: "/admin/plans", icon: WalletCards },
  { title: "مفاتيح الميزات", href: "/admin/feature-flags", icon: Settings },
  { title: "سجلات النظام", href: "/admin/system-logs", icon: FileText },
  { title: "تذاكر الدعم", href: "/admin/support-tickets", icon: Bell },
];
