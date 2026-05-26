"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClientWithContext, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/require-auth";

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
      .select("id, name, average_cost")
      .eq("id", itemId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!item) {
      return { ok: false, message: "المادة المختارة غير موجودة في هذه المؤسسة." };
    }

    const unitCost = Number(item.average_cost ?? 0);

    // 1. Fetch current stock
    const { data: stock } = await admin
      .from("branch_stock")
      .select("id, quantity")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("item_id", itemId)
      .maybeSingle();

    // 2. Update stock quantity
    const newQty = Number(stock?.quantity ?? 0) + quantity;
    if (stock?.id) {
      const { error: updateError } = await admin
        .from("branch_stock")
        .update({ quantity: newQty })
        .eq("id", stock.id);
      if (updateError) return { ok: false, message: updateError.message };
    } else {
      const { error: insertError } = await admin
        .from("branch_stock")
        .insert({
          organization_id: organizationId,
          branch_id: branchId,
          item_id: itemId,
          quantity: newQty,
          reserved_quantity: 0,
          created_by: auth.id,
        });
      if (insertError) return { ok: false, message: insertError.message };
    }

    // 3. Create stock movement record
    const { error: movementError } = await admin
      .from("stock_movements")
      .insert({
        organization_id: organizationId,
        branch_id: branchId,
        item_id: itemId,
        movement_type: parsed.data.movementType,
        quantity: quantity,
        unit_cost: unitCost,
        source_doc_type: "manual_adjustment",
        source_doc_id: null,
        idempotency_key: crypto.randomUUID(),
        notes: parsed.data.notes || "تعديل مخزون يدوي",
        created_by: auth.id,
      });

    if (movementError) {
      // Rollback stock update
      if (stock?.id) {
        await admin.from("branch_stock").update({ quantity: Number(stock.quantity) }).eq("id", stock.id);
      } else {
        await admin.from("branch_stock").delete().eq("organization_id", organizationId).eq("branch_id", branchId).eq("item_id", itemId);
      }
      return { ok: false, message: movementError.message };
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
