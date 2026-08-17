import { describe, expect, it } from "vitest";
import {
  canRoleAccessPath,
  roleAllowedPathPrefixes,
  roleHomePath,
} from "@/lib/auth/route-access";

describe("role route access", () => {
  it("redirects operational roles to their own section", () => {
    expect(roleHomePath("cashier")).toBe("/d/gate?next=/d/pos");
    expect(roleHomePath("inventory_manager")).toBe(
      "/dashboard/inventory/dashboard",
    );
    expect(roleHomePath("accountant")).toBe("/dashboard/accounting");
    expect(roleHomePath("marketing_manager")).toBe("/dashboard/digital-presence");
  });

  it("keeps cashier identity separate from the physical POS device", () => {
    const cashierHome = roleHomePath("cashier");
    expect(cashierHome).toBe("/d/gate?next=/d/pos");
    expect(canRoleAccessPath("cashier", cashierHome)).toBe(true);
  });

  it("keeps organization owners and super admins on the organization dashboard", () => {
    expect(roleHomePath("organization_owner")).toBe("/dashboard");
    expect(roleHomePath("super_admin")).toBe("/dashboard");
    expect(canRoleAccessPath("organization_owner", "/dashboard/settings/users")).toBe(true);
    expect(canRoleAccessPath("super_admin", "/dashboard/accounting/ledger")).toBe(true);
    expect(canRoleAccessPath("organization_owner", "/d/pos")).toBe(true);
  });

  it("denies crafted cross-department dashboard URLs", () => {
    expect(canRoleAccessPath("cashier", "/dashboard/accounting")).toBe(false);
    expect(canRoleAccessPath("inventory_manager", "/dashboard/accounting/ledger")).toBe(false);
    expect(canRoleAccessPath("accountant", "/dashboard/inventory")).toBe(false);
    expect(canRoleAccessPath("marketing_manager", "/dashboard/settings/users")).toBe(false);
  });

  it("allows each employee role only inside its section", () => {
    expect(canRoleAccessPath("cashier", "/d/pos")).toBe(true);
    expect(canRoleAccessPath("inventory_manager", "/dashboard/inventory/items?low=1")).toBe(true);
    expect(canRoleAccessPath("accountant", "/dashboard/accounting/trial-balance")).toBe(true);
    expect(canRoleAccessPath("marketing_manager", "/dashboard/digital-presence")).toBe(true);
    expect(canRoleAccessPath("marketing_manager", "/dashboard/social-publishing")).toBe(false);
  });

  it("does not confuse similar path prefixes", () => {
    expect(canRoleAccessPath("accountant", "/dashboard/accounting-malicious")).toBe(false);
    expect(canRoleAccessPath("cashier", "/d/pos-admin")).toBe(false);
  });

  it("leaves public routes outside the operational role policy", () => {
    expect(canRoleAccessPath("cashier", "/login")).toBe(true);
    expect(canRoleAccessPath("staff", "/pending-approval")).toBe(true);
    expect(canRoleAccessPath("staff", "/d/gate")).toBe(true);
  });

  it("exposes immutable prefixes for navigation filtering", () => {
    expect(roleAllowedPathPrefixes("marketing_manager")).toContain(
      "/dashboard/digital-presence",
    );
  });
});
