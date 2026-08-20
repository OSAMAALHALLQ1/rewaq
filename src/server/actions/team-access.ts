"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateEmployeeCode, employeeCodeHint, hashEmployeeCode } from "@/lib/auth/employee-code";
import { logAuditEvent } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireRoleCapability } from "@/lib/auth/require-auth";
import type { Role } from "@/types/domain";

export type EmployeeAccessActionState = {
  ok: boolean;
  message: string;
  code?: string;
  employeeId?: string;
};

const employeeRoleSchema = z.enum([
  "branch_manager",
  "cashier",
  "inventory_manager",
  "purchasing_manager",
  "chef",
  "accountant",
  "staff",
]);

const createEmployeeSchema = z.object({
  fullName: z.string().trim().min(2, "أدخل اسم الموظف").max(120, "اسم الموظف طويل جدًا"),
  email: z.string().trim().email("البريد غير صحيح").optional().or(z.literal("")),
  role: employeeRoleSchema,
  branchId: z.string().uuid("اختر فرعًا صحيحًا").optional().or(z.literal("")),
  departmentId: z.string().uuid("اختر قسمًا صحيحًا").optional().or(z.literal("")),
});

function internalEmployeeEmail(employeeId: string) {
  return `staff-${employeeId}@employees.rewaq.internal`;
}

async function requireTeamAccessManager() {
  const user = await requireAuth();
  requireRoleCapability(user, ["super_admin", "organization_owner"]);
  return user;
}

async function validateScope(
  organizationId: string,
  branchId?: string,
  departmentId?: string,
) {
  const admin = createAdminClient();

  if (branchId) {
    const { data: branch, error } = await admin
      .from("branches")
      .select("id")
      .eq("id", branchId)
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .maybeSingle();
    if (error || !branch) throw new Error("الفرع المحدد غير متاح داخل المؤسسة.");
  }

  if (departmentId) {
    const { data: department, error } = await (admin as any)
      .from("departments")
      .select("id,branch_id,branches!inner(organization_id)")
      .eq("id", departmentId)
      .eq("branches.organization_id", organizationId)
      .maybeSingle();
    if (error || !department) throw new Error("القسم المحدد غير متاح داخل المؤسسة.");
    if (branchId && department.branch_id !== branchId) {
      throw new Error("القسم لا يتبع الفرع المحدد.");
    }
  }
}

export async function createEmployeeAccessAction(
  _previousState: EmployeeAccessActionState,
  formData: FormData,
): Promise<EmployeeAccessActionState> {
  const parsed = createEmployeeSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email") ?? "",
    role: formData.get("role"),
    branchId: formData.get("branchId") ?? "",
    departmentId: formData.get("departmentId") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "تحقق من بيانات الموظف." };
  }

  try {
    const user = await requireTeamAccessManager();
    const branchId = parsed.data.branchId || undefined;
    const departmentId = parsed.data.departmentId || undefined;
    await validateScope(user.organizationId, branchId, departmentId);

    const employeeId = randomUUID();
    const code = generateEmployeeCode();
    const email = parsed.data.email
      ? parsed.data.email.toLowerCase()
      : internalEmployeeEmail(employeeId);
    const admin = createAdminClient();

    const { data: invite, error } = await admin
      .from("team_invites")
      .insert({
        id: employeeId,
        organization_id: user.organizationId,
        email,
        invite_code: hashEmployeeCode(code),
        full_name: parsed.data.fullName,
        code_hint: employeeCodeHint(code),
        code_issued_at: new Date().toISOString(),
        role: parsed.data.role as Role,
        branch_id: branchId ?? null,
        department_id: departmentId ?? null,
        permissions: [],
        status: "pending",
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !invite) {
      return {
        ok: false,
        message: error?.code === "23505" ? "هذا البريد مرتبط بموظف آخر." : error?.message || "تعذر إنشاء الموظف.",
      };
    }

    await logAuditEvent({
      organizationId: user.organizationId,
      branchId: branchId ?? null,
      userId: user.id,
      action: "employee_access_created",
      entityType: "team_invite",
      entityId: invite.id,
      newData: {
        fullName: parsed.data.fullName,
        role: parsed.data.role,
        branchId: branchId ?? null,
        departmentId: departmentId ?? null,
        codeHint: employeeCodeHint(code),
      },
    });

    revalidatePath("/dashboard/settings/users");
    return {
      ok: true,
      message: "تم إنشاء الموظف. احفظ الكود الآن؛ لن يظهر كاملًا مرة أخرى.",
      code,
      employeeId: invite.id,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "تعذر إنشاء الموظف." };
  }
}

const employeeIdSchema = z.string().uuid();

export async function rotateEmployeeCodeAction(employeeId: string): Promise<EmployeeAccessActionState> {
  const parsedId = employeeIdSchema.safeParse(employeeId);
  if (!parsedId.success) return { ok: false, message: "معرف الموظف غير صالح." };

  try {
    const user = await requireTeamAccessManager();
    const admin = createAdminClient();
    const { data: existing, error: lookupError } = await admin
      .from("team_invites")
      .select("id,branch_id,accepted_user_id,role,code_hint,revoked_at")
      .eq("id", parsedId.data)
      .eq("organization_id", user.organizationId)
      .maybeSingle();

    if (lookupError || !existing) return { ok: false, message: "الموظف غير موجود." };

    const code = generateEmployeeCode();
    const { error } = await admin
      .from("team_invites")
      .update({
        invite_code: hashEmployeeCode(code),
        code_hint: employeeCodeHint(code),
        code_issued_at: new Date().toISOString(),
        status: existing.accepted_user_id ? "accepted" : "pending",
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        revoked_at: null,
        failed_login_attempts: 0,
        locked_until: null,
        last_failed_login_at: null,
      })
      .eq("id", existing.id)
      .eq("organization_id", user.organizationId);

    if (error) return { ok: false, message: error.message };

    await logAuditEvent({
      organizationId: user.organizationId,
      branchId: existing.branch_id,
      userId: user.id,
      action: "employee_code_rotated",
      entityType: "team_invite",
      entityId: existing.id,
      oldData: { codeHint: existing.code_hint, revokedAt: existing.revoked_at },
      newData: { codeHint: employeeCodeHint(code), role: existing.role },
    });

    revalidatePath("/dashboard/settings/users");
    return { ok: true, message: "تم إصدار كود جديد وإلغاء الكود السابق.", code, employeeId: existing.id };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "تعذر تدوير الكود." };
  }
}

export async function revokeEmployeeAccessAction(employeeId: string): Promise<EmployeeAccessActionState> {
  const parsedId = employeeIdSchema.safeParse(employeeId);
  if (!parsedId.success) return { ok: false, message: "معرف الموظف غير صالح." };

  try {
    const user = await requireTeamAccessManager();
    const admin = createAdminClient();
    const { data: existing, error: lookupError } = await admin
      .from("team_invites")
      .select("id,branch_id,accepted_user_id,role,revoked_at")
      .eq("id", parsedId.data)
      .eq("organization_id", user.organizationId)
      .maybeSingle();

    if (lookupError || !existing) return { ok: false, message: "الموظف غير موجود." };
    if (existing.revoked_at) return { ok: true, message: "وصول الموظف متوقف بالفعل." };

    const revokedAt = new Date().toISOString();
    const { error } = await admin
      .from("team_invites")
      .update({ status: "revoked", revoked_at: revokedAt })
      .eq("id", existing.id)
      .eq("organization_id", user.organizationId);

    if (error) return { ok: false, message: error.message };

    await logAuditEvent({
      organizationId: user.organizationId,
      branchId: existing.branch_id,
      userId: user.id,
      action: "employee_access_revoked",
      entityType: "team_invite",
      entityId: existing.id,
      oldData: { role: existing.role, revokedAt: null },
      newData: { role: existing.role, revokedAt },
    });

    revalidatePath("/dashboard/settings/users");
    return { ok: true, message: "تم إيقاف وصول الموظف. لإعادته أصدر كودًا جديدًا." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "تعذر إيقاف الموظف." };
  }
}
