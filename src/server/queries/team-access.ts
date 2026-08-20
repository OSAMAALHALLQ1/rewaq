import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireRoleCapability } from "@/lib/auth/require-auth";
import type { Role } from "@/types/domain";

export type TeamAccessEmployee = {
  id: string;
  fullName: string;
  email: string | null;
  role: Role;
  branchId: string | null;
  departmentId: string | null;
  status: string;
  codeHint: string | null;
  lastUsedAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
  accepted: boolean;
};

export type TeamAccessOption = { id: string; name: string; branchId?: string };

export async function getTeamAccessWorkspaceData() {
  const user = await requireAuth();
  requireRoleCapability(user, ["super_admin", "organization_owner"]);

  const admin = createAdminClient();
  const [employeesResult, branchesResult, departmentsResult] = await Promise.all([
    admin
      .from("team_invites")
      .select(
        "id,full_name,email,role,branch_id,department_id,status,code_hint,last_used_at,expires_at,revoked_at,accepted_user_id,created_at",
      )
      .eq("organization_id", user.organizationId)
      .order("created_at", { ascending: false }),
    admin
      .from("branches")
      .select("id,name")
      .eq("organization_id", user.organizationId)
      .eq("status", "active")
      .order("name"),
    (admin as any)
      .from("departments")
      .select("id,name,branch_id,branches!inner(organization_id)")
      .eq("branches.organization_id", user.organizationId)
      .order("name"),
  ]);

  if (employeesResult.error) throw employeesResult.error;
  if (branchesResult.error) throw branchesResult.error;
  if (departmentsResult.error) throw departmentsResult.error;

  const employees: TeamAccessEmployee[] = (employeesResult.data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name?.trim() || "موظف بدون اسم",
    email: row.email.endsWith("@employees.rewaq.internal") ? null : row.email,
    role: row.role as Role,
    branchId: row.branch_id,
    departmentId: row.department_id,
    status: row.status,
    codeHint: row.code_hint,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    accepted: Boolean(row.accepted_user_id),
  }));

  return {
    employees,
    branches: (branchesResult.data ?? []).map((row) => ({ id: row.id, name: row.name })),
    departments: ((departmentsResult.data ?? []) as Array<{ id: string; name: string; branch_id: string }>).map(
      (row) => ({ id: row.id, name: row.name, branchId: row.branch_id }),
    ),
  };
}
