import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const employeeMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/066_unify_employee_codes_and_department_scope.sql"),
  "utf8",
);
const deviceMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/067_atomic_device_provisioning_and_revocation.sql"),
  "utf8",
);
const departmentLoginRoute = readFileSync(
  resolve(process.cwd(), "src/app/api/auth/department-login/route.ts"),
  "utf8",
);
const restaurantOrderRoute = readFileSync(
  resolve(process.cwd(), "src/app/api/department/restaurant-orders/route.ts"),
  "utf8",
);

describe("employee and device access migrations", () => {
  it("keeps one hashed employee credential source and migrates legacy staff forward", () => {
    expect(employeeMigration).toContain("insert into public.team_invites");
    expect(employeeMigration).toContain("extensions.digest(upper(btrim(staff.login_code)), 'sha256')");
    expect(employeeMigration).toContain("update public.staff_members");
    expect(employeeMigration).not.toMatch(/delete\s+from\s+public\.(staff_members|team_invites)/i);
  });

  it("binds employees to organization, branch and department and enforces revocation in RLS helpers", () => {
    expect(employeeMigration).toContain("validate_employee_department_scope");
    expect(employeeMigration).toContain("sync_team_invite_access_to_membership");
    expect(employeeMigration).toContain("membership.is_active");
    expect(employeeMigration).toContain("create or replace function public.can_access_branch");
    expect(employeeMigration).not.toContain("membership.role in ('organization_owner', 'inventory_manager'");
  });

  it("provisions and revokes devices atomically with audit records", () => {
    expect(deviceMigration).toContain("provision_department_device_atomic");
    expect(deviceMigration).toContain("revoke_department_device_atomic");
    expect(deviceMigration).toContain("department_device_provisioned");
    expect(deviceMigration).toContain("department_device_revoked");
    expect(deviceMigration).toContain("for update");
    expect(deviceMigration).toContain("to service_role");
    expect(deviceMigration).not.toMatch(/delete\s+from\s+public\.department_api_keys/i);
  });

  it("requires a matching employee identity before issuing a device session", () => {
    expect(departmentLoginRoute).toContain("getOptionalSession");
    expect(departmentLoginRoute).toContain("employee.organizationId !== keyData.organization_id");
    expect(departmentLoginRoute).toContain("employeeRoleAllowsModule");
    expect(departmentLoginRoute).toContain("user_id: employee.user.id");
  });

  it("writes waiter and actor identities into restaurant orders", () => {
    expect(restaurantOrderRoute).toContain("p_waiter_user_id: auth.actor.id");
    expect(restaurantOrderRoute).toContain("p_actor_user_id: auth.actor.id");
    expect(restaurantOrderRoute).not.toContain("p_actor_user_id: null");
  });
});
