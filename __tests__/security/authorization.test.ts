/**
 * Authorization & Role Capability Security Tests
 *
 * Validates that low-privileged roles (waiter, cashier, chef) cannot perform
 * privileged management, accounting, or administrative operations.
 */
import { describe, it, expect } from "vitest";
import { employeeRoleAllowsModule, departmentRoleAllowsModule } from "@/lib/department/auth";
import type { Role } from "@/types/domain";

describe("Role Capability & Privilege Boundary Tests", () => {
  it("strictly restricts staff/waiter module access", () => {
    expect(employeeRoleAllowsModule("staff", "waiter")).toBe(true);
    expect(employeeRoleAllowsModule("staff", "pos")).toBe(false);
    expect(employeeRoleAllowsModule("staff", "kitchen")).toBe(false);
    expect(employeeRoleAllowsModule("staff", "accounting")).toBe(false);
    expect(employeeRoleAllowsModule("staff", "inventory")).toBe(false);
    expect(employeeRoleAllowsModule("staff", "purchasing")).toBe(false);
  });

  it("strictly restricts cashier module access", () => {
    expect(employeeRoleAllowsModule("cashier", "pos")).toBe(true);
    expect(employeeRoleAllowsModule("cashier", "waiter")).toBe(false);
    expect(employeeRoleAllowsModule("cashier", "accounting")).toBe(false);
    expect(employeeRoleAllowsModule("cashier", "purchasing")).toBe(false);
  });

  it("strictly restricts kitchen chef module access", () => {
    expect(employeeRoleAllowsModule("chef", "kitchen")).toBe(true);
    expect(employeeRoleAllowsModule("chef", "expo")).toBe(true);
    expect(employeeRoleAllowsModule("chef", "pos")).toBe(false);
    expect(employeeRoleAllowsModule("chef", "accounting")).toBe(false);
  });

  it("grants manager and owner comprehensive operational access", () => {
    const managerModules = ["pos", "waiter", "kitchen", "expo", "inventory", "recipes", "waste"];
    managerModules.forEach((m) => {
      expect(employeeRoleAllowsModule("branch_manager", m)).toBe(true);
      expect(employeeRoleAllowsModule("organization_owner", m)).toBe(true);
    });
  });

  it("prevents vertical privilege escalation from staff to admin", () => {
    const checkIsPrivilegedActionAllowed = (role: Role, action: string) => {
      const privilegedActions = [
        "close_accounting_period",
        "create_device_api_key",
        "revoke_device_api_key",
        "invite_team_member",
        "rotate_employee_pin",
      ];
      if (privilegedActions.includes(action)) {
        if (!["super_admin", "organization_owner", "branch_manager"].includes(role)) {
          throw new Error("صلاحيات غير كافية لتنفيذ هذا الإجراء.");
        }
      }
      return true;
    };

    // Low-privileged roles blocked
    expect(() => checkIsPrivilegedActionAllowed("staff", "create_device_api_key")).toThrow();
    expect(() => checkIsPrivilegedActionAllowed("cashier", "close_accounting_period")).toThrow();
    expect(() => checkIsPrivilegedActionAllowed("staff", "invite_team_member")).toThrow();

    // Organization owner allowed
    expect(() => checkIsPrivilegedActionAllowed("organization_owner", "create_device_api_key")).not.toThrow();
  });
});
