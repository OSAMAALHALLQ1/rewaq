"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClientWithContext, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { requireAuth, requireSensitiveActionCapability } from "@/lib/auth/require-auth";
import { postInventoryWriteOffJournal, todayLocal } from "@/lib/accounting/posting";
import { logAuditEvent } from "@/lib/audit/log";

type ActionState = {
  ok: boolean;
  message: string;
};

const manualAdjustmentSchema = z.object({
  branchId: z.string().uuid("اختر الفرع"),
  itemId: z.string().uuid("اختر المادة"),
  movementType: z.enum(["purchase", "waste", "adjustment", "stock_count"]),
  quantity: z.coerce.number(),
  notes: z.string().optional(),
});

export async function saveManualAdjustmentAction(formData: FormData): Promise<ActionState> {
  if (!hasSupabaseAdminEnv()) {
    return { ok: false, message: "مفتاح Supabase الإداري غير موجود." };
  }

  const parsed = manualAdjustmentSchema.safeParse({
    branchId: formData.get("branchId"),
    itemId: formData.get("itemId"),
    movementType: formData.get("movementType"),
    quantity: formData.get("quantity"),
    notes: formData.get("notes") || "",
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "بيانات الحركة غير صحيحة" };
  }

  try {
    const auth = await requireAuth();
    requireSensitiveActionCapability(auth, "inventory_movement_write", parsed.data.branchId);
    const admin = createAdminClientWithContext("adjustments.ts/saveManualAdjustmentAction");
    
    // Find organization membership
    const { data: membership } = await (admin as any)
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", auth.id)
      .maybeSingle();

    const organizationId = membership?.organization_id;
    if (!organizationId) {
      return { ok: false, message: "لم يتم العثور على مؤسسة مرتبطة بحسابك." };
    }

    const branchId = parsed.data.branchId;
    const itemId = parsed.data.itemId;
    const quantity = parsed.data.quantity;

    // Fetch item details
    const { data: item } = await admin
      .from("inventory_items")
      .select("*")
      .eq("id", itemId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!item) {
      return { ok: false, message: "المادة المختارة غير موجودة في هذه المؤسسة." };
    }

    const unitCost = Number(item.average_cost ?? 0);

    // Adjust stock atomically using the apply_stock_movement RPC
    const idempotencyKey = crypto.randomUUID();
    const { data: rpcResult, error: rpcError } = await (admin as any).rpc("apply_stock_movement", {
      p_org_id: organizationId,
      p_branch_id: branchId,
      p_item_id: itemId,
      p_movement_type: parsed.data.movementType,
      p_quantity: quantity,
      p_unit_cost: unitCost,
      p_reference: "manual_adjustment",
      p_idempotency_key: idempotencyKey,
      p_notes: parsed.data.notes || "تعديل مخزون يدوي",
      p_created_by: auth.id,
    });

    if (rpcError) {
      return { ok: false, message: rpcError.message };
    }

    const result = rpcResult as { success: boolean; movement_id?: string; new_quantity?: number };
    const movementId = result.movement_id;

    if (movementId && Math.abs(quantity * unitCost) > 0) {
      await postInventoryWriteOffJournal(admin, {
        organizationId,
        branchId,
        sourceDocType: "inventory_adjustment",
        sourceDocId: movementId,
        label: `تسوية مخزون يدوية - صنف ${item.name} (${parsed.data.movementType})`,
        totalCost: Math.abs(quantity * unitCost),
        entryDate: todayLocal(),
        createdBy: auth.id,
      });
    }

    if (movementId) {
      await logAuditEvent({
        organizationId,
        branchId,
        userId: auth.id,
        action: "manual_stock_override",
        entityType: "branch_stock",
        entityId: movementId,
        oldData: null,
        newData: {
          itemId,
          quantity,
          movementType: parsed.data.movementType,
          idempotencyKey,
        },
      });
    }

  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "تعذر حفظ الحركة." };
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath(`/dashboard/inventory/${parsed.data.itemId}`);
  revalidatePath("/dashboard/stock-movements");
  revalidatePath("/dashboard/reports");

  return { ok: true, message: "تم تسجيل الحركة وتعديل المخزون بنجاح." };
}
