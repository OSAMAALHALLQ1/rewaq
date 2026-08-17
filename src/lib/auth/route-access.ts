import type { Role } from "@/types/domain";

const FULL_DASHBOARD_ROLES = new Set<Role>([
  "super_admin",
  "organization_owner",
  "branch_manager",
]);

const ROLE_PATH_PREFIXES: Readonly<Record<Role, readonly string[]>> = {
  super_admin: ["/dashboard"],
  organization_owner: ["/dashboard"],
  branch_manager: ["/dashboard"],
  cashier: ["/d/pos"],
  inventory_manager: [
    "/dashboard/inventory",
    "/dashboard/items",
    "/dashboard/warehouses",
    "/dashboard/stock-movements",
    "/dashboard/stock-counts",
    "/dashboard/transfers",
    "/dashboard/waste",
  ],
  purchasing_manager: [
    "/dashboard/purchase-orders",
    "/dashboard/suppliers",
    "/dashboard/invoices",
  ],
  chef: ["/d/kitchen", "/d/expo"],
  marketing_manager: [
    "/dashboard/digital-presence",
  ],
  accountant: [
    "/dashboard/accounting",
    "/dashboard/cost-accounting",
    "/dashboard/customer-invoices",
    "/dashboard/invoices",
    "/dashboard/reports",
    "/dashboard/financial-calendar",
    "/dashboard/amwali",
    "/dashboard/bill-payments",
    "/dashboard/direct-debit",
  ],
  staff: ["/d/waiter"],
};

const ROLE_HOME_PATHS: Readonly<Record<Role, string>> = {
  super_admin: "/dashboard",
  organization_owner: "/dashboard",
  branch_manager: "/dashboard",
  cashier: "/d/gate?next=/d/pos",
  inventory_manager: "/dashboard/inventory/dashboard",
  purchasing_manager: "/dashboard/purchase-orders",
  chef: "/d/kitchen",
  marketing_manager: "/dashboard/digital-presence",
  accountant: "/dashboard/accounting",
  staff: "/d/waiter",
};

function normalizePathname(pathname: string): string {
  const path = pathname.trim().split(/[?#]/, 1)[0] || "/";
  if (path === "/") return path;
  return path.replace(/\/+$/, "");
}

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function roleHomePath(role: Role): string {
  return ROLE_HOME_PATHS[role];
}

/**
 * Enforces the coarse route boundary for operational employee roles.
 *
 * Public/auth routes are outside this policy and remain accessible. Protected
 * `/dashboard` and `/d` paths are default-deny unless the role owns that
 * section. Fine-grained mutations and queries must still apply their own
 * permission and tenant/branch checks.
 */
export function canRoleAccessPath(role: Role, pathname: string): boolean {
  const normalizedPath = normalizePathname(pathname);

  if (
    !pathMatchesPrefix(normalizedPath, "/dashboard") &&
    !pathMatchesPrefix(normalizedPath, "/d")
  ) {
    return true;
  }

  // The department-code gateway performs its own server-side authentication.
  if (normalizedPath === "/d/gate") {
    return true;
  }

  if (FULL_DASHBOARD_ROLES.has(role)) {
    return true;
  }

  return ROLE_PATH_PREFIXES[role].some((prefix) =>
    pathMatchesPrefix(normalizedPath, prefix),
  );
}

export function roleAllowedPathPrefixes(role: Role): readonly string[] {
  return ROLE_PATH_PREFIXES[role];
}
