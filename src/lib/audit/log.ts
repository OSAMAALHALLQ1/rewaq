import { createAdminClientWithContext } from "@/lib/supabase/admin";

export async function logAuditEvent(params: {
  organizationId: string;
  branchId?: string | null;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldData?: any;
  newData?: any;
}) {
  try {
    const admin = createAdminClientWithContext("audit-log");
    await (admin as any).from("audit_logs").insert({
      organization_id: params.organizationId,
      branch_id: params.branchId ?? null,
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      old_data: params.oldData ?? null,
      new_data: params.newData ?? null,
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
