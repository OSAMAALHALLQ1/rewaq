import type { Role } from "@/types/domain";

export const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  organization_owner: "مالك المؤسسة",
  branch_manager: "مدير فرع",
  cashier: "كاشير",
  inventory_manager: "مدير مخزون",
  purchasing_manager: "مدير مشتريات",
  chef: "شيف",
  marketing_manager: "مدير تسويق",
  accountant: "محاسب",
  staff: "موظف",
};

/**
 * Capability matrix per the ERP complexity strategy:
 * - Cashier: simple POS only — never journal entries, chart of accounts, or financial reports.
 * - Accountant: full professional accounting workspace, but not core company settings.
 * - Branch manager: operations + summary-level accounting (expenses, profit summaries).
 * - Owner/Admin: everything.
 */
export const roleCapabilities: Record<Role, string[]> = {
  super_admin: ["platform:manage", "organizations:read", "billing:manage", "logs:read", "accounting:read", "accounting:manage", "accounting:close", "expenses:manage", "reports:read"],
  organization_owner: ["*"],
  branch_manager: ["branch:read", "inventory:read", "purchasing:read", "reports:read", "expenses:manage", "accounting:summary"],
  cashier: ["pos:sell", "shift:manage", "customer_invoices:read", "receipts:print"],
  inventory_manager: ["inventory:manage", "waste:manage", "transfers:manage"],
  purchasing_manager: ["suppliers:manage", "purchase_orders:manage", "invoices:read"],
  chef: ["recipes:manage", "menu_items:read", "inventory:read"],
  marketing_manager: ["marketing:manage", "menu_items:read"],
  accountant: [
    "reports:read",
    "food_cost:read",
    "invoices:read",
    "accounting:read",
    "accounting:manage",
    "accounting:close",
    "expenses:manage",
  ],
  staff: ["dashboard:read"],
};

export function can(role: Role, capability: string) {
  const capabilities = roleCapabilities[role] ?? [];
  return capabilities.includes("*") || capabilities.includes(capability);
}

/** Roles that can open the professional accounting workspace (/dashboard/accounting). */
export const ACCOUNTING_WORKSPACE_ROLES: readonly Role[] = [
  "super_admin",
  "organization_owner",
  "accountant",
];

/** Roles that see the accounting section in navigation (summary or full). */
export const ACCOUNTING_NAV_ROLES: readonly Role[] = [
  ...ACCOUNTING_WORKSPACE_ROLES,
  "branch_manager",
];

export function canAccessAccountingWorkspace(role: Role) {
  return ACCOUNTING_WORKSPACE_ROLES.includes(role);
}
