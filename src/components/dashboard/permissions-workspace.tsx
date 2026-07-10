"use client";

import React, { useState, useEffect } from "react";
import { 
  Shield, Users, Sliders, Lock, Scale, DollarSign, 
  Percent, Eye, FileDown, ChevronDown, Settings, 
  Plus, Search, Copy, Trash2, Play, Check, 
  AlertTriangle, Fingerprint, Clock,
  ShieldCheck, RefreshCw
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RoleTemplate = {
  id: string;
  name: string;
  description: string;
  risk: "high" | "medium" | "low";
  usersCount: number;
  isSystem: boolean;
  color: string;
  scope: string;
  permissions: string[];
  sensitiveData: Record<string, boolean>;
  limits: {
    discountPct: number;
    discountVal: number;
    refundVal: number;
    wasteVal: number;
    varianceVal: number;
    poVal: number;
    paymentVal: number;
    manualVoucherVal: number;
  };
  approvals: {
    routing: string;
    requireTwo: boolean;
    validityHours: number;
    mobileApprove: boolean;
    reasonRequired: boolean;
  };
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  scopes: string[];
  status: "active" | "inactive";
  startAt?: string;
  endAt?: string;
  mfa: boolean;
  devices: string[];
};

type AuditRow = {
  id: string;
  user: string;
  action: string;
  target: string;
  timestamp: string;
  details: string;
  ip: string;
};

// Standard Role Templates based on user spec
const initialRoles: RoleTemplate[] = [
  {
    id: "platform_admin",
    name: "مدير منصة رواق",
    description: "خاص بفريق رواق فقط. إدارة المؤسسات، الاشتراكات، feature flags، ودعم المنصة التقني.",
    risk: "high",
    usersCount: 1,
    isSystem: true,
    color: "bg-red-500/10 text-red-500 border-red-500/20",
    scope: "all",
    permissions: ["integrations.view", "integrations.manage", "branches.view", "audit_logs.view"],
    sensitiveData: { cost: false, purchase: false, profit: false, netProfit: false, bank: false, salaries: false, customers: false, export: true },
    limits: { discountPct: 0, discountVal: 0, refundVal: 0, wasteVal: 0, varianceVal: 0, poVal: 0, paymentVal: 0, manualVoucherVal: 0 },
    approvals: { routing: "none", requireTwo: false, validityHours: 0, mobileApprove: false, reasonRequired: false }
  },
  {
    id: "organization_owner",
    name: "مالك المؤسسة",
    description: "أعلى سلطة وصلاحيات مطلقة داخل المطعم. رؤية الفروع، الأرباح، التكاليف، وإغلاق الفترات.",
    risk: "high",
    usersCount: 1,
    isSystem: true,
    color: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    scope: "all",
    permissions: [
      "sales.orders.view", "sales.orders.create", "sales.orders.edit", "sales.orders.cancel_approve", "sales.discount.apply", "sales.discount.approve", "sales.refund.approve", "sales.refund.execute",
      "tables.view", "tables.open", "tables.transfer", "tables.merge", "tables.split", "tables.close", "tables.reserve", "tables.manage_layout",
      "shifts.open_own", "shifts.close_own", "shifts.view_all", "shifts.approve_variance", "shifts.reopen", "cash.drawer_open",
      "inventory.items.view", "inventory.items.manage", "inventory.cost.view", "inventory.movements.view", "inventory.count.approve", "inventory.count.post",
      "waste.view", "waste.create", "waste.submit", "waste.approve", "waste.post", "waste.view_cost",
      "purchasing.order.approve", "purchasing.receipt.approve", "purchasing.invoice.post", "supplier.payment.approve", "supplier.payment.execute",
      "recipes.view", "recipes.cost.view", "recipes.create", "recipes.edit", "recipes.approve", "recipes.publish",
      "accounting.dashboard.view", "accounting.accounts.view", "accounting.accounts.manage", "accounting.journal.post", "accounting.period.close", "accounting.period.reopen",
      "users.view", "users.invite", "users.disable", "users.roles.assign", "roles.view", "roles.create", "roles.edit", "branches.manage", "warehouses.manage", "audit_logs.view"
    ],
    sensitiveData: { cost: true, purchase: true, profit: true, netProfit: true, bank: true, salaries: true, customers: true, export: true },
    limits: { discountPct: 100, discountVal: 100000, refundVal: 100000, wasteVal: 100000, varianceVal: 100000, poVal: 1000000, paymentVal: 1000000, manualVoucherVal: 1000000 },
    approvals: { routing: "none", requireTwo: false, validityHours: 24, mobileApprove: true, reasonRequired: false }
  },
  {
    id: "regional_manager",
    name: "مدير منطقة",
    description: "إدارة ومراقبة أداء فروع محددة. مقارنة الفروع، واعتماد المصاريف والمخزون ضمن نطاقه.",
    risk: "high",
    usersCount: 2,
    isSystem: true,
    color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    scope: "region",
    permissions: [
      "sales.orders.view", "sales.discount.approve", "sales.refund.approve", "tables.view", "shifts.view_all", "shifts.approve_variance",
      "inventory.items.view", "inventory.movements.view", "inventory.count.perform", "inventory.count.recount",
      "waste.view", "waste.approve", "waste.view_cost", "purchasing.order.create", "purchasing.order.approve",
      "recipes.view", "recipes.cost.view", "accounting.reports.view", "users.view", "branches.view", "warehouses.view"
    ],
    sensitiveData: { cost: true, purchase: true, profit: true, netProfit: false, bank: false, salaries: false, customers: true, export: true },
    limits: { discountPct: 30, discountVal: 5000, refundVal: 2000, wasteVal: 5000, varianceVal: 2000, poVal: 50000, paymentVal: 10000, manualVoucherVal: 0 },
    approvals: { routing: "owner", requireTwo: true, validityHours: 12, mobileApprove: true, reasonRequired: true }
  },
  {
    id: "branch_manager",
    name: "مدير الفرع",
    description: "إشراف كامل على فرع واحد. المبيعات، الورديات، الطاولات، الجرد، واعتماد التالف والخصم المحدود.",
    risk: "medium",
    usersCount: 4,
    isSystem: true,
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    scope: "branch",
    permissions: [
      "sales.orders.view", "sales.orders.create", "sales.orders.edit", "sales.discount.apply", "sales.discount.approve", "sales.refund.request", "sales.refund.approve", "sales.price.override", "sales.invoice.print",
      "tables.view", "tables.open", "tables.transfer", "tables.merge", "tables.split", "tables.close", "tables.reserve", "tables.assign_waiter",
      "shifts.open_own", "shifts.close_own", "shifts.view_all", "shifts.approve_variance", "shifts.reopen", "cash.drawer_open", "cash.deposit", "cash.withdrawal",
      "inventory.items.view", "inventory.movements.view", "inventory.transfer.create", "inventory.transfer.ship", "inventory.transfer.receive", "inventory.count.create", "inventory.count.perform",
      "waste.view", "waste.create", "waste.submit", "waste.approve", "waste.post", "purchasing.requisition.create", "purchasing.order.create",
      "recipes.view", "users.view", "branches.view", "warehouses.view"
    ],
    sensitiveData: { cost: true, purchase: false, profit: true, netProfit: false, bank: false, salaries: false, customers: true, export: false },
    limits: { discountPct: 15, discountVal: 500, refundVal: 500, wasteVal: 150, varianceVal: 100, poVal: 5000, paymentVal: 0, manualVoucherVal: 0 },
    approvals: { routing: "regional_manager", requireTwo: false, validityHours: 8, mobileApprove: true, reasonRequired: true }
  },
  {
    id: "shift_supervisor",
    name: "مشرف الوردية",
    description: "إدارة ورديات الموظفين، فتح الصندوق، تسوية الفروقات المحدودة، ونقل ودمج الطاولات.",
    risk: "medium",
    usersCount: 6,
    isSystem: true,
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    scope: "shift",
    permissions: [
      "sales.orders.view", "sales.orders.create", "sales.orders.edit", "sales.discount.apply", "sales.discount.approve", "sales.refund.request", "sales.invoice.print", "sales.invoice.reprint",
      "tables.view", "tables.open", "tables.transfer", "tables.merge", "tables.split", "tables.close", "tables.reserve",
      "shifts.open_own", "shifts.close_own", "shifts.view_own", "shifts.reopen", "cash.drawer_open", "cash.deposit", "cash.withdrawal",
      "inventory.items.view", "waste.view", "waste.create", "waste.submit"
    ],
    sensitiveData: { cost: false, purchase: false, profit: false, netProfit: false, bank: false, salaries: false, customers: true, export: false },
    limits: { discountPct: 10, discountVal: 150, refundVal: 150, wasteVal: 50, varianceVal: 0, poVal: 0, paymentVal: 0, manualVoucherVal: 0 },
    approvals: { routing: "branch_manager", requireTwo: false, validityHours: 4, mobileApprove: false, reasonRequired: true }
  },
  {
    id: "cashier",
    name: "كاشير",
    description: "المستخدم الأساسي لشاشة نقاط البيع. تسجيل الطلبات، استلام المدفوعات، وتعليق وطباعة الفاتورة.",
    risk: "low",
    usersCount: 12,
    isSystem: true,
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    scope: "shift",
    permissions: [
      "sales.orders.view", "sales.orders.create", "sales.orders.edit", "sales.discount.apply", "sales.refund.request", "sales.invoice.print", "sales.invoice.reprint",
      "tables.view", "tables.open", "tables.close",
      "shifts.open_own", "shifts.close_own", "shifts.view_own", "cash.drawer_open"
    ],
    sensitiveData: { cost: false, purchase: false, profit: false, netProfit: false, bank: false, salaries: false, customers: false, export: false },
    limits: { discountPct: 5, discountVal: 50, refundVal: 0, wasteVal: 0, varianceVal: 0, poVal: 0, paymentVal: 0, manualVoucherVal: 0 },
    approvals: { routing: "shift_supervisor", requireTwo: false, validityHours: 1, mobileApprove: false, reasonRequired: true }
  },
  {
    id: "waiter",
    name: "جرسون",
    description: "تسجيل طلبات الزبائن على الطاولات المسندة إليه، وإضافتها للمطبخ ومتابعة جاهزيتها.",
    risk: "low",
    usersCount: 18,
    isSystem: true,
    color: "bg-slate-450/10 text-slate-400 border-slate-700",
    scope: "personal",
    permissions: [
      "sales.orders.view", "sales.orders.create", "tables.view", "tables.open", "tables.transfer", "tables.assign_waiter"
    ],
    sensitiveData: { cost: false, purchase: false, profit: false, netProfit: false, bank: false, salaries: false, customers: false, export: false },
    limits: { discountPct: 0, discountVal: 0, refundVal: 0, wasteVal: 0, varianceVal: 0, poVal: 0, paymentVal: 0, manualVoucherVal: 0 },
    approvals: { routing: "shift_supervisor", requireTwo: false, validityHours: 1, mobileApprove: false, reasonRequired: false }
  },
  {
    id: "accountant",
    name: "المحاسب",
    description: "مسؤول عن قيود اليومية المحاسبية، فواتير المشتريات، متابعة المدفوعات، والجرد والتقارير المالية.",
    risk: "medium",
    usersCount: 3,
    isSystem: true,
    color: "bg-cyan-500/10 text-cyan-550 border-cyan-500/20",
    scope: "all",
    permissions: [
      "inventory.items.view", "inventory.cost.view", "inventory.movements.view",
      "purchasing.requisition.create", "purchasing.order.create", "purchasing.receipt.create", "purchasing.invoice.create", "supplier.payment.create",
      "accounting.dashboard.view", "accounting.accounts.view", "accounting.journal.view", "accounting.journal.create", "accounting.receipts.create", "accounting.payments.create", "accounting.reports.view"
    ],
    sensitiveData: { cost: true, purchase: true, profit: true, netProfit: false, bank: true, salaries: true, customers: true, export: true },
    limits: { discountPct: 0, discountVal: 0, refundVal: 0, wasteVal: 0, varianceVal: 0, poVal: 10000, paymentVal: 10000, manualVoucherVal: 20000 },
    approvals: { routing: "finance_manager", requireTwo: false, validityHours: 48, mobileApprove: true, reasonRequired: true }
  },
  {
    id: "finance_manager",
    name: "مدير المالية",
    description: "ترحيل قيود اليومية، مراجعة وتصفية البنوك والمطابقات، اعتماد دفعات الموردين وإقفال الفترات.",
    risk: "high",
    usersCount: 1,
    isSystem: true,
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    scope: "all",
    permissions: [
      "inventory.items.view", "inventory.cost.view", "inventory.movements.view",
      "purchasing.order.approve", "purchasing.invoice.post", "supplier.payment.approve", "supplier.payment.execute",
      "accounting.dashboard.view", "accounting.accounts.view", "accounting.accounts.manage", "accounting.journal.view", "accounting.journal.create", "accounting.journal.post", "accounting.journal.reverse", "accounting.receipts.create", "accounting.payments.create", "accounting.payments.approve", "accounting.reports.view", "accounting.reports.export", "accounting.period.close"
    ],
    sensitiveData: { cost: true, purchase: true, profit: true, netProfit: true, bank: true, salaries: true, customers: true, export: true },
    limits: { discountPct: 50, discountVal: 10000, refundVal: 10000, wasteVal: 10000, varianceVal: 5000, poVal: 150000, paymentVal: 150000, manualVoucherVal: 200000 },
    approvals: { routing: "organization_owner", requireTwo: true, validityHours: 24, mobileApprove: true, reasonRequired: true }
  }
];

const initialUsers: UserRow[] = [
  { id: "u1", name: "أحمد المبحوح", email: "ahmed.m@rewaq.saas", role: "branch_manager", scopes: ["فرع الرمال"], status: "active", mfa: true, devices: ["جهاز كاشير فرع الرمال Main"] },
  { id: "u2", name: "سعيد النخالة", email: "saeed.n@rewaq.saas", role: "cashier", scopes: ["فرع الرمال", "وردية صباحية"], status: "active", mfa: false, devices: ["تابلت صالة الرمال A"] },
  { id: "u3", name: "محمود الشرفا", email: "m.shurafa@rewaq.saas", role: "accountant", scopes: ["كل المؤسسة"], status: "active", mfa: true, devices: ["متصفح الإدارة كروم"] },
  { id: "u4", name: "رشا البرغوثي", email: "rasha.b@rewaq.saas", role: "organization_owner", scopes: ["كل المؤسسة"], status: "active", mfa: true, devices: ["موبايل الإدارة آيفون"] }
];

const initialAudits: AuditRow[] = [
  { id: "a1", user: "رشا البرغوثي", action: "تعديل صلاحية", target: "أحمد المبحوح (مدير فرع)", timestamp: "2026-07-10T14:22:15Z", details: "تعديل الحد المالي للمرتجعات إلى 500 شيكل وتوسيع نطاق صلاحية المخازن.", ip: "192.168.1.45" },
  { id: "a2", user: "أحمد المبحوح", action: "طلب اعتماد خصم", target: "فاتورة #INV-4929", timestamp: "2026-07-10T14:40:10Z", details: "تجاوز حد الخصم المباشر (خصم 20%)، تم تحويل الطلب للموافقة.", ip: "192.168.2.11" },
  { id: "a3", user: "رشا البرغوثي", action: "اعتماد عملية دفع", target: "المورد شركة النخبة", timestamp: "2026-07-10T15:10:05Z", details: "اعتماد دفعة مالية بقيمة 8,500 شيكل لمستلزمات المطبخ.", ip: "192.168.1.45" }
];

const modulesList = [
  {
    id: "sales",
    title: "المبيعات ونقاط البيع",
    permissions: [
      { key: "sales.orders.view", label: "عرض الطلبات والفواتير" },
      { key: "sales.orders.create", label: "إنشاء طلبات مبيعات جديدة" },
      { key: "sales.orders.edit", label: "تعديل الطلبات قبل السداد" },
      { key: "sales.orders.cancel_approve", label: "اعتماد إلغاء الطلبات النشطة" },
      { key: "sales.discount.apply", label: "تطبيق خصومات مباشرة" },
      { key: "sales.discount.approve", label: "اعتماد خصومات الموظفين الآخرين" },
      { key: "sales.refund.approve", label: "اعتماد طلبات المرتجعات" },
      { key: "sales.refund.execute", label: "تنفيذ وتصدير مبالغ المرتجع للزبون" },
      { key: "sales.price.override", label: "تعديل وتجاوز أسعار الأصناف المعرّفة" },
      { key: "sales.invoice.reprint", label: "إعادة طباعة الفواتير المدفوعة" }
    ]
  },
  {
    id: "tables",
    title: "إإدارة الطاولات والصالات",
    permissions: [
      { key: "tables.view", label: "عرض مخطط الصالة والطاولات" },
      { key: "tables.open", label: "فتح طاولة وتعيين عدد الضيوف" },
      { key: "tables.transfer", label: "نقل الحجوزات أو الطلبات بين الطاولات" },
      { key: "tables.merge", label: "دمج طاولات متعددة في فاتورة واحدة" },
      { key: "tables.split", label: "فصل الفاتورة والمحاسبة المجزأة" },
      { key: "tables.manage_layout", label: "تعديل المخطط المعماري للصالة وتوزيع المقاعد" }
    ]
  },
  {
    id: "shifts",
    title: "الورديات والصندوق النقدي",
    permissions: [
      { key: "shifts.open_own", label: "فتح ورديتي الشخصية فقط" },
      { key: "shifts.close_own", label: "إغلاق ورديتي وتسجيل المبلغ الفعلي" },
      { key: "shifts.view_all", label: "عرض تقارير وورديات كافة الكاشيرات" },
      { key: "shifts.approve_variance", label: "اعتماد فوارق الصندوق النقدي عند العجز أو الزيادة" },
      { key: "shifts.reopen", label: "إعادة فتح وردية مغلقة للتسوية" },
      { key: "cash.drawer_open", label: "فتح درج النقد يدويًا بدون عملية مبيعات" }
    ]
  },
  {
    id: "inventory",
    title: "إدارة المخازن والمستودعات",
    permissions: [
      { key: "inventory.items.view", label: "عرض قائمة الأصناف والمستودعات" },
      { key: "inventory.items.manage", label: "إضافة وتعديل بيانات الأصناف وتوزيع الرفوف" },
      { key: "inventory.cost.view", label: "عرض تكلفة شراء المواد الخام" },
      { key: "inventory.movements.view", label: "عرض تقارير وسجلات حركة المخزن" },
      { key: "inventory.transfer.create", label: "إنشاء طلب تحويل بضاعة بين المخازن" },
      { key: "inventory.transfer.approve", label: "اعتماد شحن واستلام التحويلات" },
      { key: "inventory.count.create", label: "إنشاء دورات الجرد الفعلي للمخازن" },
      { key: "inventory.count.perform", label: "إدخال كميات العد الفعلي للجرد" },
      { key: "inventory.count.approve", label: "اعتماد الفوارق الناتجة عن عمليات الجرد" }
    ]
  },
  {
    id: "waste",
    title: "إدارة التالف والهدر الغذائي",
    permissions: [
      { key: "waste.view", label: "عرض تقارير التالف والهدر" },
      { key: "waste.create", label: "تسجيل حالة هدر/تالف جديدة" },
      { key: "waste.approve", label: "اعتماد عمليات التالف وتحديث رصيد المخزن" },
      { key: "waste.view_cost", label: "عرض تكلفة المواد التالفة والهدر المالي" }
    ]
  },
  {
    id: "purchasing",
    title: "دورة المشتريات والموردين",
    permissions: [
      { key: "purchasing.requisition.create", label: "إنشاء طلب شراء داخلي" },
      { key: "purchasing.requisition.approve", label: "اعتماد طلبات الشراء وتصديرها" },
      { key: "purchasing.order.create", label: "إنشاء أمر شراء رسمي (PO) للمورد" },
      { key: "purchasing.order.approve", label: "اعتماد أمر الشراء وتوقيعه إلكترونيًا" },
      { key: "purchasing.receipt.create", label: "تسجيل إيصال استلام البضائع بالفرع" },
      { key: "purchasing.invoice.create", label: "تسجيل فاتورة المورد المالية ومطابقتها" },
      { key: "purchasing.invoice.post", label: "ترحيل فاتورة المورد للحسابات الدائنة" },
      { key: "supplier.payment.create", label: "إنشاء طلب سند صرف للمورد" },
      { key: "supplier.payment.execute", label: "اعتماد وصرف دفعات الموردين المالية" }
    ]
  },
  {
    id: "accounting",
    title: "النظام المحاسبي ودفتر الأستاذ",
    permissions: [
      { key: "accounting.dashboard.view", label: "عرض لوحة القيادة والتقارير المالية العامة" },
      { key: "accounting.accounts.view", label: "عرض دليل الحسابات (شجرة الحسابات)" },
      { key: "accounting.accounts.manage", label: "إضافة وتعديل شجرة الحسابات ومراكز التكلفة" },
      { key: "accounting.journal.create", label: "إنشاء قيود اليومية اليدوية (مسودة)" },
      { key: "accounting.journal.post", label: "ترحيل قيود اليومية اليدوية للحسابات العامة" },
      { key: "accounting.journal.reverse", label: "عكس قيد محاسبي معرّف أو تالف" },
      { key: "accounting.period.close", label: "إغلاق الفترات المحاسبية الشهرية/السنوية" },
      { key: "accounting.period.reopen", label: "إعادة فتح فترة مقفلة للتعديل الاستثنائي" }
    ]
  },
  {
    id: "administration",
    title: "إدارة النظام والإعدادات العامة",
    permissions: [
      { key: "users.view", label: "عرض الموظفين والمستخدمين بالشركة" },
      { key: "users.invite", label: "دعوة وتوظيف مستخدمين جدد للنظام" },
      { key: "users.roles.assign", label: "تعديل وإسناد أدوار وصلاحيات للموظفين" },
      { key: "roles.create", label: "إنشاء وتخصيص أدوار وصلاحيات جديدة" },
      { key: "branches.manage", label: "إدارة الفروع وربطها بالمواقع الجغرافية" },
      { key: "warehouses.manage", label: "إدارة المستودعات والتخزين المركزي" },
      { key: "audit_logs.view", label: "الاطلاع على سجل التدقيق الأمني والعمليات الحساسة" }
    ]
  }
];

export default function PermissionsWorkspaceClient() {
  const [activeTab, setActiveTab] = useState<"roles" | "users" | "logs">("roles");
  const [roles, setRoles] = useState<RoleTemplate[]>(initialRoles);
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [audits, setAudits] = useState<AuditRow[]>(initialAudits);
  
  // Search states
  const [roleSearch, setRoleSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  
  // Role editor state
  const [editingRole, setEditingRole] = useState<RoleTemplate | null>(null);
  const [editorAccordion, setEditorAccordion] = useState<string | null>("sales");
  const [sodConflicts, setSodConflicts] = useState<string[]>([]);
  
  // Dialog / Modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newInvite, setNewInvite] = useState({
    name: "",
    email: "",
    role: "cashier",
    scope: "branch",
    branch: "فرع الرمال",
    startAt: "",
    endAt: "",
    mfa: false
  });
  
  // Role Preview mode active state
  const [previewRoleName, setPreviewRoleName] = useState<string | null>(null);

  // Compute SoD conflicts whenever editing role permissions change
  useEffect(() => {
    if (!editingRole) {
      setSodConflicts([]);
      return;
    }
    const perms = editingRole.permissions;
    const conflicts: string[] = [];

    // SoD Check 1: PO approval + payment execution
    if (perms.includes("purchasing.order.approve") && perms.includes("supplier.payment.execute")) {
      conflicts.push("⚠️ تعارض صلاحيات حرج (شراء ودفع): يجمع هذا الدور بين اعتماد المشتريات وصرف مستحقات الموردين مما يهدد الرقابة المالية.");
    }
    // SoD Check 2: count performing + count approving
    if (perms.includes("inventory.count.perform") && perms.includes("inventory.count.approve")) {
      conflicts.push("⚠️ تعارض صلاحيات متوسط (عد واعتماد جرد): يقوم الموظف بالجرد الفعلي واعتماده بنفسه دون رقابة ثنائية.");
    }
    // SoD Check 3: POS orders + refund approval
    if (perms.includes("sales.orders.create") && perms.includes("sales.refund.approve")) {
      conflicts.push("⚠️ تعارض صلاحيات مرتفع (بيع واسترجاع): يتيح للكاشير إجراء عمليات البيع واعتماد الاسترجاع النقدي بمفرده.");
    }
    // SoD Check 4: journal creation + journal posting
    if (perms.includes("accounting.journal.create") && perms.includes("accounting.journal.post")) {
      conflicts.push("⚠️ تعارض صلاحيات متوسط (إنشاء وترحيل قيود): يتيح للموظف تسجيل القيود اليومية وترحيلها مباشرة دون مراجعة ماليّة.");
    }

    setSodConflicts(conflicts);
  }, [editingRole?.permissions, editingRole]);

  // Handle Edit/Save Role
  const handleEditRole = (role: RoleTemplate) => {
    setEditingRole({ ...role });
  };

  const handleTogglePermission = (key: string) => {
    if (!editingRole) return;
    const isChecked = editingRole.permissions.includes(key);
    const updatedPerms = isChecked
      ? editingRole.permissions.filter(p => p !== key)
      : [...editingRole.permissions, key];
    
    setEditingRole({
      ...editingRole,
      permissions: updatedPerms
    });
  };

  const handleToggleSensitive = (key: string) => {
    if (!editingRole) return;
    setEditingRole({
      ...editingRole,
      sensitiveData: {
        ...editingRole.sensitiveData,
        [key]: !editingRole.sensitiveData[key]
      }
    });
  };

  const handleLimitChange = (key: string, value: number) => {
    if (!editingRole) return;
    setEditingRole({
      ...editingRole,
      limits: {
        ...editingRole.limits,
        [key]: value
      }
    });
  };

  const handleApprovalChange = (key: string, value: any) => {
    if (!editingRole) return;
    setEditingRole({
      ...editingRole,
      approvals: {
        ...editingRole.approvals,
        [key]: value
      }
    });
  };

  const handleSaveRole = () => {
    if (!editingRole) return;
    setRoles(prev => prev.map(r => r.id === editingRole.id ? editingRole : r));
    
    // Add audit entry
    const newAudit: AuditRow = {
      id: `a-${Date.now()}`,
      user: "رشا البرغوثي",
      action: "تحديث الصلاحيات",
      target: `دور ${editingRole.name}`,
      timestamp: new Date().toISOString(),
      details: `تحديث نطاق البيانات، الحدود المالية، ومصفوفة الصلاحيات لـ ${editingRole.name}.`,
      ip: "192.168.1.45"
    };
    setAudits(prev => [newAudit, ...prev]);
    setEditingRole(null);
  };

  const handleDuplicateRole = (role: RoleTemplate) => {
    const duplicated: RoleTemplate = {
      ...role,
      id: `custom_${Date.now()}`,
      name: `${role.name} (نسخة)`,
      isSystem: false,
      usersCount: 0
    };
    setRoles(prev => [...prev, duplicated]);
    
    const newAudit: AuditRow = {
      id: `a-${Date.now()}`,
      user: "رشا البرغوثي",
      action: "نسخ وتكرار دور",
      target: `دور ${role.name}`,
      timestamp: new Date().toISOString(),
      details: `إنشاء دور مخصص مكرر من ${role.name}.`,
      ip: "192.168.1.45"
    };
    setAudits(prev => [newAudit, ...prev]);
  };

  const handleDeleteRole = (id: string) => {
    const roleToDelete = roles.find(r => r.id === id);
    if (roleToDelete?.isSystem) return;
    setRoles(prev => prev.filter(r => r.id !== id));
    
    const newAudit: AuditRow = {
      id: `a-${Date.now()}`,
      user: "رشا البرغوثي",
      action: "حذف دور مخصص",
      target: `دور ${roleToDelete?.name || id}`,
      timestamp: new Date().toISOString(),
      details: `حذف الدور المخصص ${roleToDelete?.name} نهائياً من النظام.`,
      ip: "192.168.1.45"
    };
    setAudits(prev => [newAudit, ...prev]);
  };

  // Handle Invite User
  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvite.name || !newInvite.email) return;

    const newUser: UserRow = {
      id: `u-${Date.now()}`,
      name: newInvite.name,
      email: newInvite.email,
      role: newInvite.role,
      scopes: [newInvite.branch],
      status: "active",
      mfa: newInvite.mfa,
      devices: ["لم يُربط بعد"],
      startAt: newInvite.startAt || undefined,
      endAt: newInvite.endAt || undefined
    };

    setUsers(prev => [...prev, newUser]);
    
    // Increment users count in role
    setRoles(prev => prev.map(r => r.id === newInvite.role ? { ...r, usersCount: r.usersCount + 1 } : r));

    // Audit
    const newAudit: AuditRow = {
      id: `a-${Date.now()}`,
      user: "رشا البرغوثي",
      action: "دعوة موظف جديد",
      target: `${newInvite.name} (${newInvite.email})`,
      timestamp: new Date().toISOString(),
      details: `دعوة بريد إلكتروني مرتبط بدور ${roles.find(r => r.id === newInvite.role)?.name} ونطاق ${newInvite.branch}.`,
      ip: "192.168.1.45"
    };
    setAudits(prev => [newAudit, ...prev]);

    setShowInviteModal(false);
    setNewInvite({
      name: "",
      email: "",
      role: "cashier",
      scope: "branch",
      branch: "فرع الرمال",
      startAt: "",
      endAt: "",
      mfa: false
    });
  };

  const handleToggleUserStatus = (id: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        const nextStatus = u.status === "active" ? "inactive" : "active";
        // Audit
        const newAudit: AuditRow = {
          id: `a-${Date.now()}`,
          user: "رشا البرغوثي",
          action: nextStatus === "active" ? "تفعيل حساب" : "تعطيل حساب",
          target: `${u.name}`,
          timestamp: new Date().toISOString(),
          details: `${nextStatus === "active" ? "تفعيل" : "تعطيل وتجميد"} وصول المستخدم إلى النظام والأجهزة المرتبطة به.`,
          ip: "192.168.1.45"
        };
        setAudits(prevAudits => [newAudit, ...prevAudits]);
        return { ...u, status: nextStatus };
      }
      return u;
    }));
  };

  // Simulating preview mode
  const handlePreviewRole = (roleName: string) => {
    setPreviewRoleName(roleName);
    setTimeout(() => {
      setPreviewRoleName(null);
    }, 4000);
  };

  const getRiskBadge = (risk: "high" | "medium" | "low") => {
    switch (risk) {
      case "high":
        return <Badge className="bg-red-500/10 text-red-500 border border-red-500/20 text-[10px]">مرتفعة جداً ⚠️</Badge>;
      case "medium":
        return <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px]">متوسطة 🛡️</Badge>;
      case "low":
        return <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px]">منخفضة ✓</Badge>;
    }
  };

  const getScopeLabel = (scope: string) => {
    switch (scope) {
      case "all": return "كل المؤسسة والفروع";
      case "region": return "علامات ومناطق محددة";
      case "branch": return "فروع مسندة فقط";
      case "shift": return "الوردية الحالية فقط";
      case "personal": return "السجلات الشخصية فقط";
      default: return "محدود";
    }
  };

  return (
    <div className="space-y-6 text-right">
      
      {/* Role Preview Simulation Alert */}
      {previewRoleName && (
        <div className="fixed inset-x-0 top-0 z-50 bg-teal-600 text-white p-4 shadow-xl flex items-center justify-center gap-3 font-bold text-sm">
          <ShieldCheck className="h-5 w-5 animate-pulse" />
          <span>جاري محاكاة بيئة العمل بصلاحيات ({previewRoleName})... تم تعطيل أزرار الحفظ والأمن لحمايتك.</span>
          <Button variant="outline" size="sm" className="bg-white/10 hover:bg-white/20 border-white/20 text-white" onClick={() => setPreviewRoleName(null)}>
            إلغاء المعاينة
          </Button>
        </div>
      )}

      {/* Main Settings Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2.5 text-slate-900">
            <Shield className="h-6 w-6 text-primary" />
            نظام الصلاحيات المتقدم (RBAC & ABAC)
          </h1>
          <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
            التحكم الذكي بمحرك الصلاحيات في رواق: الأدوار، القيود المالية، نطاقات الموظفين، الفصل التلقائي بين المهام الحساسة، وسجل المتابعة الأمني.
          </p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
          <button 
            onClick={() => { setActiveTab("roles"); setEditingRole(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "roles" ? "bg-white text-primary shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sliders className="h-4 w-4" />
            إدارة الأدوار ({roles.length})
          </button>
          <button 
            onClick={() => { setActiveTab("users"); setEditingRole(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "users" ? "bg-white text-primary shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="h-4 w-4" />
            أعضاء الفريق ({users.length})
          </button>
          <button 
            onClick={() => { setActiveTab("logs"); setEditingRole(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "logs" ? "bg-white text-primary shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Fingerprint className="h-4 w-4" />
            سجل العمليات الأمني
          </button>
        </div>
      </div>

      {/* ------------------------------ TAB 1: ROLES & PERMISSIONS EDITOR ------------------------------ */}
      {activeTab === "roles" && !editingRole && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="ابحث عن دور معين..."
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                className="ps-9 text-right text-xs"
              />
            </div>
            <Button className="flex items-center gap-1.5 text-xs h-10 font-bold" onClick={() => {
              const newCustomRole: RoleTemplate = {
                id: `custom_${Date.now()}`,
                name: "دور مخصص جديد",
                description: "اكتب وصفاً لوظيفة هذا الدور والمهام المسندة إليه.",
                risk: "low",
                usersCount: 0,
                isSystem: false,
                color: "bg-slate-500/10 text-slate-600 border-slate-350",
                scope: "branch",
                permissions: [],
                sensitiveData: { cost: false, purchase: false, profit: false, netProfit: false, bank: false, salaries: false, customers: false, export: false },
                limits: { discountPct: 0, discountVal: 0, refundVal: 0, wasteVal: 0, varianceVal: 0, poVal: 0, paymentVal: 0, manualVoucherVal: 0 },
                approvals: { routing: "branch_manager", requireTwo: false, validityHours: 4, mobileApprove: false, reasonRequired: true }
              };
              setRoles(prev => [...prev, newCustomRole]);
              setEditingRole(newCustomRole);
            }}>
              <Plus className="h-4 w-4" />
              إضافة دور مخصص
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles
              .filter(r => r.name.includes(roleSearch) || r.description.includes(roleSearch))
              .map((role) => (
                <Card key={role.id} className="hover:shadow-md transition-shadow flex flex-col justify-between border-slate-100">
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <Badge className={`${role.color} border text-[10px] py-0.5 font-bold`}>
                        {role.isSystem ? "دور نظامي جاهز" : "دور مخصص"}
                      </Badge>
                      {getRiskBadge(role.risk)}
                    </div>
                    <CardTitle className="text-sm font-bold text-slate-800 mt-3">{role.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 pt-0 flex-1 flex flex-col justify-between gap-4">
                    <p className="text-[11px] text-slate-500 leading-relaxed min-h-[44px]">
                      {role.description}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg text-[10px] text-slate-650 font-bold border border-slate-100">
                      <div>الموظفون النشطون: <span className="text-primary font-black">{role.usersCount}</span></div>
                      <div>النطاق الافتراضي: <span className="text-slate-800">{getScopeLabel(role.scope)}</span></div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-50">
                      <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold text-slate-700" onClick={() => handleEditRole(role)}>
                        تعديل الصلاحيات
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold text-slate-700" onClick={() => handleDuplicateRole(role)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold text-teal-655 hover:text-teal-650" onClick={() => handlePreviewRole(role.name)} title="معاينة شاشة الصلاحيات لهذا الدور">
                        <Play className="h-3 w-3" />
                      </Button>
                      {!role.isSystem && (
                        <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold text-rose-600 hover:bg-rose-50" onClick={() => handleDeleteRole(role.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* ------------------------------ TAB 1.1: FINE-GRAINED ROLE EDITOR ------------------------------ */}
      {activeTab === "roles" && editingRole && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          
          {/* Main settings panel */}
          <div className="space-y-4">
            
            {/* General Info & Scope */}
            <Card className="border-slate-100 shadow-sm">
              <CardHeader className="p-5 border-b border-slate-50">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Settings className="h-4.5 w-4.5 text-primary" />
                  بيانات الدور ونطاق الوصول المسموح
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="role-name" className="text-xs font-bold text-slate-700">اسم الدور الوظيفي</Label>
                    <Input 
                      id="role-name"
                      type="text" 
                      value={editingRole.name} 
                      onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                      disabled={editingRole.isSystem}
                      className="text-right text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="role-scope" className="text-xs font-bold text-slate-700">نطاق البيانات الافتراضي (ABAC)</Label>
                    <select
                      id="role-scope"
                      value={editingRole.scope}
                      onChange={(e) => setEditingRole({ ...editingRole, scope: e.target.value })}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold"
                    >
                      <option value="all">كل المؤسسة وكافة الفروع والمستودعات</option>
                      <option value="region">علامات تجارية ومناطق جغرافية محددة</option>
                      <option value="branch">الفروع والمستودعات المسندة للموظف فقط</option>
                      <option value="shift">وردية العمل الشخصية فقط (مبيعات/نقود)</option>
                      <option value="personal">السجلات الشخصية والطلبات المسندة فقط</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role-desc" className="text-xs font-bold text-slate-700">الوصف التفصيلي للدور</Label>
                  <textarea 
                    id="role-desc"
                    value={editingRole.description} 
                    onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 p-3 text-xs leading-relaxed text-slate-660 focus:outline-none focus:ring-1 focus:ring-primary text-right"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Matrix of Fine-Grained Permissions (Accordions) */}
            <Card className="border-slate-100 shadow-sm">
              <CardHeader className="p-5 border-b border-slate-50">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Lock className="h-4.5 w-4.5 text-primary" />
                  مصفوفة العمليات والصلاحيات الدقيقة (Fine-grained Permissions)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {modulesList.map((mod) => {
                  const isOpen = editorAccordion === mod.id;
                  const allowedCount = mod.permissions.filter(p => editingRole.permissions.includes(p.key)).length;

                  return (
                    <div key={mod.id} className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                      <button
                        onClick={() => setEditorAccordion(isOpen ? null : mod.id)}
                        className="w-full flex items-center justify-between p-4 bg-white border-b border-slate-50 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="h-2 w-2 rounded-full bg-primary" />
                          <span className="font-bold text-xs text-slate-800">{mod.title}</span>
                          <Badge tone="default" className="text-[9px] py-0.5 px-2 bg-slate-100 text-slate-600 font-semibold border-none">
                            مفعّل: {allowedCount} / {mod.permissions.length}
                          </Badge>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      
                      {isOpen && (
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 bg-white text-right">
                          {mod.permissions.map((p) => {
                            const isAllowed = editingRole.permissions.includes(p.key);
                            return (
                              <label
                                key={p.key}
                                className={`flex items-start gap-2.5 p-3 rounded-lg border text-right cursor-pointer select-none transition-all ${
                                  isAllowed 
                                    ? "bg-teal-500/5 border-teal-500/20 text-slate-800" 
                                    : "bg-slate-50/20 border-slate-100 text-slate-400"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isAllowed}
                                  onChange={() => handleTogglePermission(p.key)}
                                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary accent-primary"
                                />
                                <div>
                                  <span className="block text-xs font-bold">{p.label}</span>
                                  <span className="block text-[9px] text-slate-400 font-mono mt-0.5">{p.key}</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Financial Approval Limits */}
            <Card className="border-slate-100 shadow-sm">
              <CardHeader className="p-5 border-b border-slate-50">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Scale className="h-4.5 w-4.5 text-primary" />
                  حدود التفويض المالي والاعتمادات بالعملة المحلية
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-right">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">نسبة الخصم القصوى (%)</Label>
                    <div className="relative">
                      <Percent className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        type="number"
                        value={editingRole.limits.discountPct}
                        onChange={(e) => handleLimitChange("discountPct", Number(e.target.value))}
                        className="ps-9 text-right text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">قيمة الخصم للفاتورة (شيكل)</Label>
                    <div className="relative">
                      <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        type="number"
                        value={editingRole.limits.discountVal}
                        onChange={(e) => handleLimitChange("discountVal", Number(e.target.value))}
                        className="ps-9 text-right text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">قيمة المرتجع المسموح (شيكل)</Label>
                    <div className="relative">
                      <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        type="number"
                        value={editingRole.limits.refundVal}
                        onChange={(e) => handleLimitChange("refundVal", Number(e.target.value))}
                        className="ps-9 text-right text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">اعتماد التالف بالعملة (شيكل)</Label>
                    <div className="relative">
                      <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        type="number"
                        value={editingRole.limits.wasteVal}
                        onChange={(e) => handleLimitChange("wasteVal", Number(e.target.value))}
                        className="ps-9 text-right text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">فرق الجرد المسموح (شيكل)</Label>
                    <div className="relative">
                      <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        type="number"
                        value={editingRole.limits.varianceVal}
                        onChange={(e) => handleLimitChange("varianceVal", Number(e.target.value))}
                        className="ps-9 text-right text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">أقصى أمر شراء PO (شيكل)</Label>
                    <div className="relative">
                      <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        type="number"
                        value={editingRole.limits.poVal}
                        onChange={(e) => handleLimitChange("poVal", Number(e.target.value))}
                        className="ps-9 text-right text-xs"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar: Sensitive fields & Approvals routing */}
          <div className="space-y-4">
            
            {/* SoD separation of duties check */}
            {sodConflicts.length > 0 && (
              <Card className="border-red-200 bg-red-50/50">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-bold text-red-650 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    تحذير الفصل بين المهام (SoD Check)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2 text-right">
                  {sodConflicts.map((conflict, idx) => (
                    <p key={idx} className="text-[10px] text-red-700 leading-relaxed font-semibold">
                      {conflict}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Read permissions on sensitive data */}
            <Card className="border-slate-100 shadow-sm">
              <CardHeader className="p-5 border-b border-slate-50">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Eye className="h-4.5 w-4.5 text-primary" />
                  عرض البيانات الحساسة والتصدير
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-3 text-right">
                <p className="text-[10px] text-slate-400 leading-normal mb-1">حدد الحقول المالية السرّية المسموح لهذا الدور قراءتها:</p>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingRole.sensitiveData.cost}
                    onChange={() => handleToggleSensitive("cost")}
                    className="h-4 w-4 rounded text-primary accent-primary"
                  />
                  <span>عرض تكلفة الأصناف ومشتريات الأغذية</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingRole.sensitiveData.purchase}
                    onChange={() => handleToggleSensitive("purchase")}
                    className="h-4 w-4 rounded text-primary accent-primary"
                  />
                  <span>عرض أسعار الشراء في الفواتير</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingRole.sensitiveData.profit}
                    onChange={() => handleToggleSensitive("profit")}
                    className="h-4 w-4 rounded text-primary accent-primary"
                  />
                  <span>عرض هامش الربح الإجمالي للأصناف</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingRole.sensitiveData.netProfit}
                    onChange={() => handleToggleSensitive("netProfit")}
                    className="h-4 w-4 rounded text-primary accent-primary"
                  />
                  <span>عرض صافي أرباح الفروع والمؤسسة</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingRole.sensitiveData.bank}
                    onChange={() => handleToggleSensitive("bank")}
                    className="h-4 w-4 rounded text-primary accent-primary"
                  />
                  <span>عرض أرصدة البنوك وحسابات النقدية</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingRole.sensitiveData.salaries}
                    onChange={() => handleToggleSensitive("salaries")}
                    className="h-4 w-4 rounded text-primary accent-primary"
                  />
                  <span>عرض رواتب وتكاليف موظفي التشغيل</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingRole.sensitiveData.customers}
                    onChange={() => handleToggleSensitive("customers")}
                    className="h-4 w-4 rounded text-primary accent-primary"
                  />
                  <span>عرض الهويات وأرقام هواتف العملاء</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer pt-2 border-t border-slate-100">
                  <input
                    type="checkbox"
                    checked={editingRole.sensitiveData.export}
                    onChange={() => handleToggleSensitive("export")}
                    className="h-4 w-4 rounded text-primary accent-primary"
                  />
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    <FileDown className="h-3.5 w-3.5 text-amber-500" />
                    تصدير التقارير والبيانات (Excel/PDF)
                  </span>
                </label>
              </CardContent>
            </Card>

            {/* Approvals Routing configuration */}
            <Card className="border-slate-100 shadow-sm">
              <CardHeader className="p-5 border-b border-slate-50">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Clock className="h-4.5 w-4.5 text-primary" />
                  شروط وتوجيه الموافقات (Approvals)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4 text-right">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">توجيه المعاملات الفائضة إلى</Label>
                  <select
                    value={editingRole.approvals.routing}
                    onChange={(e) => handleApprovalChange("routing", e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold"
                  >
                    <option value="none">لا يوجد (منع تلقائي لتجاوز الحد)</option>
                    <option value="shift_supervisor">مشرف الوردية المناوب</option>
                    <option value="branch_manager">مدير الفرع الموثق</option>
                    <option value="regional_manager">مدير المنطقة الجغرافية</option>
                    <option value="finance_manager">مدير المالية العام</option>
                    <option value="organization_owner">مالك المؤسسة مباشرة</option>
                  </select>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingRole.approvals.requireTwo}
                      onChange={() => handleApprovalChange("requireTwo", !editingRole.approvals.requireTwo)}
                      className="h-4 w-4 rounded text-primary accent-primary"
                    />
                    <span>يتطلب اعتماد ثنائي من مسؤولين اثنين (2-Step)</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingRole.approvals.mobileApprove}
                      onChange={() => handleApprovalChange("mobileApprove", !editingRole.approvals.mobileApprove)}
                      className="h-4 w-4 rounded text-primary accent-primary"
                    />
                    <span>السماح بالاعتماد السريع عبر الجوال والـ WhatsApp</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingRole.approvals.reasonRequired}
                      onChange={() => handleApprovalChange("reasonRequired", !editingRole.approvals.reasonRequired)}
                      className="h-4 w-4 rounded text-primary accent-primary"
                    />
                    <span>إلزامية كتابة سبب إلكتروني مقنع لتبرير التجاوز</span>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button className="flex-1 h-11 text-xs font-bold" onClick={handleSaveRole}>
                <Check className="h-4 w-4" />
                حفظ تعديلات الدور
              </Button>
              <Button variant="outline" className="flex-1 h-11 text-xs font-bold text-slate-600" onClick={() => setEditingRole(null)}>
                إلغاء التغييرات
              </Button>
            </div>
          </div>

        </div>
      )}

      {/* ------------------------------ TAB 2: TEAM MEMBERS & EXCEPTIONS ------------------------------ */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="ابحث عن اسم أو بريد موظف..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="ps-9 text-right text-xs"
              />
            </div>
            <Button className="flex items-center gap-1.5 text-xs h-10 font-bold" onClick={() => setShowInviteModal(true)}>
              <Plus className="h-4 w-4" />
              دعوة فرد جديد للفريق
            </Button>
          </div>

          <Card className="border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                    <th className="p-4 font-bold">اسم الموظف</th>
                    <th className="p-4 font-bold">البريد الإلكتروني</th>
                    <th className="p-4 font-bold">الدور الأساسي</th>
                    <th className="p-4 font-bold">الفروع والمنطقة</th>
                    <th className="p-4 font-bold">المصادقة الثنائية MFA</th>
                    <th className="p-4 font-bold">حالة الحساب</th>
                    <th className="p-4 font-bold">الأجهزة المسموحة</th>
                    <th className="p-4 font-bold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users
                    .filter(u => u.name.includes(userSearch) || u.email.includes(userSearch))
                    .map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-bold text-slate-800">{user.name}</td>
                        <td className="p-4 text-slate-500 font-mono">{user.email}</td>
                        <td className="p-4">
                          <Badge className="bg-slate-100 text-slate-700 border-none text-[10px] font-bold">
                            {roles.find(r => r.id === user.role)?.name || user.role}
                          </Badge>
                        </td>
                        <td className="p-4 font-semibold text-slate-600">
                          {user.scopes.join("، ")}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 font-bold ${
                            user.mfa ? "text-emerald-500" : "text-slate-400"
                          }`}>
                            <Fingerprint className="h-4 w-4" />
                            {user.mfa ? "مفعلّة" : "معطلّة"}
                          </span>
                        </td>
                        <td className="p-4">
                          <Badge className={user.status === "active" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 text-[9px] font-bold" : "bg-red-500/10 text-red-500 border border-red-500/25 text-[9px] font-bold"}>
                            {user.status === "active" ? "نشط" : "مجمد"}
                          </Badge>
                        </td>
                        <td className="p-4 text-slate-400 text-[10px] truncate max-w-[140px]" title={user.devices.join(", ")}>
                          {user.devices.join("، ")}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-1.5">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className={`h-7 px-2.5 text-[10px] font-bold ${
                                user.status === "active" ? "text-rose-600 hover:bg-rose-50" : "text-emerald-600 hover:bg-emerald-50"
                              }`}
                              onClick={() => handleToggleUserStatus(user.id)}
                            >
                              {user.status === "active" ? "تجميد الحساب" : "تفعيل"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ------------------------------ TAB 3: SECURITY AUDIT LOG ------------------------------ */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          <Card className="border-slate-100 shadow-sm overflow-hidden">
            <CardHeader className="p-5 border-b border-slate-50 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock className="h-4.5 w-4.5 text-primary" />
                سجل تدقيق الأمان وعمليات الصلاحيات (Security Audit Trail)
              </CardTitle>
              <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold text-slate-600" onClick={() => setAudits(initialAudits)}>
                <RefreshCw className="h-3 w-3" />
                تحديث
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {audits.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-slate-50/40 transition-colors flex items-start justify-between gap-4">
                    <div className="space-y-1 text-right">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800">{log.user}</span>
                        <Badge tone="default" className="text-[9px] py-0 px-2 border-slate-200 text-slate-600 bg-slate-100">{log.action}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-normal">{log.details}</p>
                      <div className="flex items-center gap-3 text-[9px] text-slate-400 font-semibold font-mono pt-1">
                        <span>IP: {log.ip}</span>
                        <span>•</span>
                        <span>{new Date(log.timestamp).toLocaleString("ar-EG")}</span>
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <span className="text-[10px] text-slate-400 block font-mono">الهدف:</span>
                      <span className="text-[10px] text-slate-700 block font-bold">{log.target}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ------------------------------ DIALOG: INVITE USER MODAL ------------------------------ */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg bg-white border-none shadow-2xl text-right">
            <CardHeader className="p-6 border-b border-slate-100">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                دعوة موظف جديد لنظام الصلاحيات
              </CardTitle>
            </CardHeader>
            <form onSubmit={handleInviteSubmit}>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-name" className="text-xs font-bold text-slate-700">اسم الموظف الكامل</Label>
                  <Input
                    id="invite-name"
                    type="text"
                    required
                    placeholder="مثال: أحمد المبحوح"
                    value={newInvite.name}
                    onChange={(e) => setNewInvite({ ...newInvite, name: e.target.value })}
                    className="text-right text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email" className="text-xs font-bold text-slate-700">البريد الإلكتروني للعمل</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    required
                    placeholder="example@rewaq.saas"
                    value={newInvite.email}
                    onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                    className="text-right text-xs font-mono"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-role" className="text-xs font-bold text-slate-700">الدور الأساسي</Label>
                    <select
                      id="invite-role"
                      value={newInvite.role}
                      onChange={(e) => setNewInvite({ ...newInvite, role: e.target.value })}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold"
                    >
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-branch" className="text-xs font-bold text-slate-700">الفرع المتاح للدخول</Label>
                    <select
                      id="invite-branch"
                      value={newInvite.branch}
                      onChange={(e) => setNewInvite({ ...newInvite, branch: e.target.value })}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold"
                    >
                      <option value="فرع الرمال">فرع الرمال الرئيسي</option>
                      <option value="فرع الجلاء">فرع الجلاء</option>
                      <option value="فرع النصر">فرع النصر</option>
                      <option value="كل الفروع">كل الفروع (مسؤول)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-start" className="text-xs font-bold text-slate-700">تاريخ بدء الصلاحية (اختياري)</Label>
                    <Input
                      id="invite-start"
                      type="date"
                      value={newInvite.startAt}
                      onChange={(e) => setNewInvite({ ...newInvite, startAt: e.target.value })}
                      className="text-right text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-end" className="text-xs font-bold text-slate-700">تاريخ انتهاء الصلاحية (اختياري)</Label>
                    <Input
                      id="invite-end"
                      type="date"
                      value={newInvite.endAt}
                      onChange={(e) => setNewInvite({ ...newInvite, endAt: e.target.value })}
                      className="text-right text-xs"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={newInvite.mfa}
                    onChange={() => setNewInvite({ ...newInvite, mfa: !newInvite.mfa })}
                    className="h-4 w-4 rounded text-primary accent-primary"
                  />
                  <span className="font-bold flex items-center gap-1">
                    إلزام الموظف بالمصادقة الثنائية (MFA) عبر تطبيق Authenticator
                  </span>
                </label>
              </CardContent>
              <div className="p-6 border-t border-slate-100 flex gap-2 justify-end">
                <Button type="submit" className="h-10 text-xs font-bold">
                  إرسال كود الدعوة والربط
                </Button>
                <Button type="button" variant="outline" className="h-10 text-xs font-bold text-slate-600" onClick={() => setShowInviteModal(false)}>
                  إلغاء
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

    </div>
  );
}
