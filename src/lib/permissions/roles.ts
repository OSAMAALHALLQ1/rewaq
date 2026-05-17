import type { Role } from "@/types/domain";

export const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  organization_owner: "مالك المؤسسة",
  branch_manager: "مدير فرع",
  inventory_manager: "مدير مخزون",
  purchasing_manager: "مدير مشتريات",
  chef: "شيف",
  marketing_manager: "مدير تسويق",
  accountant: "محاسب",
  staff: "موظف",
};

export const roleCapabilities: Record<Role, string[]> = {
  super_admin: ["platform:manage", "organizations:read", "billing:manage", "logs:read"],
  organization_owner: ["*"],
  branch_manager: ["branch:read", "inventory:read", "purchasing:read", "reports:read"],
  inventory_manager: ["inventory:manage", "waste:manage", "transfers:manage"],
  purchasing_manager: ["suppliers:manage", "purchase_orders:manage", "invoices:read"],
  chef: ["recipes:manage", "menu_items:read", "inventory:read"],
  marketing_manager: ["marketing:manage", "menu_items:read"],
  accountant: ["reports:read", "food_cost:read", "invoices:read"],
  staff: ["dashboard:read"],
};

export function can(role: Role, capability: string) {
  const capabilities = roleCapabilities[role] ?? [];
  return capabilities.includes("*") || capabilities.includes(capability);
}
