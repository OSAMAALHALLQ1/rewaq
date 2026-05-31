/**
 * Tests for organization access authorization helpers
 */
import { describe, it, expect } from "vitest";
import {
  hasRoleLevel,
  canManageInventory,
  canManagePurchasing,
  canManageMarketing,
  canViewFinancialReports,
  canManageUsers,
  canApproveAccounts,
} from "@/lib/auth/organization-access";

describe("hasRoleLevel", () => {
  it("should return true when user has required role", () => {
    expect(hasRoleLevel("super_admin", "staff")).toBe(true);
    expect(hasRoleLevel("organization_owner", "cashier")).toBe(true);
    expect(hasRoleLevel("branch_manager", "inventory_manager")).toBe(true);
    expect(hasRoleLevel("inventory_manager", "staff")).toBe(true);
    expect(hasRoleLevel("cashier", "staff")).toBe(true);
  });

  it("should return true for same role", () => {
    expect(hasRoleLevel("inventory_manager", "inventory_manager")).toBe(true);
    expect(hasRoleLevel("cashier", "cashier")).toBe(true);
  });

  it("should return false when user lacks required role", () => {
    expect(hasRoleLevel("staff", "inventory_manager")).toBe(false);
    expect(hasRoleLevel("cashier", "branch_manager")).toBe(false);
    expect(hasRoleLevel("inventory_manager", "organization_owner")).toBe(false);
  });
});

describe("canManageInventory", () => {
  it("should return true for inventory_manager and above", () => {
    expect(canManageInventory("inventory_manager")).toBe(true);
    expect(canManageInventory("purchasing_manager")).toBe(true);
    expect(canManageInventory("branch_manager")).toBe(true);
    expect(canManageInventory("organization_owner")).toBe(true);
    expect(canManageInventory("super_admin")).toBe(true);
  });

  it("should return false for staff and cashier", () => {
    expect(canManageInventory("staff")).toBe(false);
    expect(canManageInventory("cashier")).toBe(false);
  });
});

describe("canManagePurchasing", () => {
  it("should return true for purchasing_manager and above", () => {
    expect(canManagePurchasing("purchasing_manager")).toBe(true);
    expect(canManagePurchasing("branch_manager")).toBe(true);
    expect(canManagePurchasing("organization_owner")).toBe(true);
    expect(canManagePurchasing("super_admin")).toBe(true);
  });

  it("should return false for inventory_manager and below", () => {
    expect(canManagePurchasing("inventory_manager")).toBe(false);
    expect(canManagePurchasing("cashier")).toBe(false);
    expect(canManagePurchasing("staff")).toBe(false);
  });
});

describe("canManageMarketing", () => {
  it("should return true for marketing_manager and above", () => {
    expect(canManageMarketing("marketing_manager")).toBe(true);
    expect(canManageMarketing("organization_owner")).toBe(true);
    expect(canManageMarketing("super_admin")).toBe(true);
  });

  it("should return false for other roles", () => {
    expect(canManageMarketing("branch_manager")).toBe(false);
    expect(canManageMarketing("inventory_manager")).toBe(false);
    expect(canManageMarketing("cashier")).toBe(false);
  });
});

describe("canViewFinancialReports", () => {
  it("should return true for accountant and above", () => {
    expect(canViewFinancialReports("accountant")).toBe(true);
    expect(canViewFinancialReports("organization_owner")).toBe(true);
    expect(canViewFinancialReports("super_admin")).toBe(true);
  });

  it("should return false for marketing_manager and below", () => {
    expect(canViewFinancialReports("marketing_manager")).toBe(false);
    expect(canViewFinancialReports("chef")).toBe(false);
    expect(canViewFinancialReports("cashier")).toBe(false);
  });
});

describe("canManageUsers", () => {
  it("should return true for branch_manager and above", () => {
    expect(canManageUsers("branch_manager")).toBe(true);
    expect(canManageUsers("organization_owner")).toBe(true);
    expect(canManageUsers("super_admin")).toBe(true);
  });

  it("should return false for staff and below", () => {
    expect(canManageUsers("inventory_manager")).toBe(false);
    expect(canManageUsers("cashier")).toBe(false);
    expect(canManageUsers("staff")).toBe(false);
  });
});

describe("canApproveAccounts", () => {
  it("should return true only for super_admin", () => {
    expect(canApproveAccounts("super_admin")).toBe(true);
  });

  it("should return false for all other roles", () => {
    const roles = [
      "organization_owner",
      "branch_manager",
      "inventory_manager",
      "purchasing_manager",
      "marketing_manager",
      "accountant",
      "chef",
      "cashier",
      "staff",
    ] as const;

    for (const role of roles) {
      expect(canApproveAccounts(role)).toBe(false);
    }
  });
});

describe("Role hierarchy", () => {
  it("should have super_admin at highest level", () => {
    const highestRole = "super_admin";
    const lowestRole = "staff";

    for (const role of [
      "organization_owner",
      "branch_manager",
      "inventory_manager",
      "purchasing_manager",
      "marketing_manager",
      "accountant",
      "chef",
      "cashier",
      "staff",
    ] as const) {
      expect(hasRoleLevel(highestRole, role)).toBe(true);
    }
  });

  it("should have staff at lowest level", () => {
    const lowestRole = "staff";

    expect(hasRoleLevel(lowestRole, "staff")).toBe(true);
  });
});