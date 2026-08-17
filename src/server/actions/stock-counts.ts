"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClientWithContext, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { requireAuth, requireSensitiveActionCapability } from "@/lib/auth/require-auth";
import { requireOrganizationModule } from "@/server/billing/entitlements";
import type { ActionState } from "./auth";

const uuid = z.string().uuid();

function ok(message: string): ActionState {
  return { ok: true, message };
}

function invalid(message: string): ActionState {
  return { ok: false, message };
}

function revalidateStockCountPaths() {
  revalidatePath("/dashboard/stock-counts");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movements");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/accounting/ledger");
}

async function resolveScope() {
  const auth = await requireAuth();
  const admin = createAdminClientWithContext("stock-counts.ts/resolveScope");
  await requireOrganizationModule(admin, auth.organizationId, "inventory", { write: true });
  return { admin, auth, organizationId: auth.organizationId, userId: auth.id };
}

async function requireScopedSession(
  admin: ReturnType<typeof createAdminClientWithContext>,
  organizationId: string,
  stockCountId: string,
) {
  const { data, error } = await admin
    .from("stock_counts")
    .select("id, branch_id, status")
    .eq("organization_id", organizationId)
    .eq("id", stockCountId)
    .maybeSingle();
  if (error || !data) throw new Error("جلسة الجرد غير موجودة في المؤسسة الحالية.");
  return data;
}

const createSchema = z.object({
  branchId: uuid,
  countedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  warehouse: z.enum(["all", "general", "kitchen"]),
  categoryId: z.union([uuid, z.literal("")]),
  varianceApprovalThreshold: z.coerce.number().min(0).max(999999999),
  notes: z.string().trim().max(1000).optional(),
});

export async function createStockCountSessionAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!hasSupabaseAdminEnv()) return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن بدء جلسة الجرد.");
  const parsed = createSchema.safeParse({
    branchId: formData.get("branchId"),
    countedAt: formData.get("countedAt"),
    warehouse: formData.get("warehouse") || "all",
    categoryId: formData.get("categoryId") || "",
    varianceApprovalThreshold: formData.get("varianceApprovalThreshold") || 0,
    notes: formData.get("notes") || "",
  });
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات جلسة الجرد غير صحيحة.");

  try {
    const { admin, auth, organizationId, userId } = await resolveScope();
    requireSensitiveActionCapability(auth, "inventory_movement_write", parsed.data.branchId);
    const { data, error } = await (admin as any).rpc("create_stock_count_session_atomic", {
      p_organization_id: organizationId,
      p_branch_id: parsed.data.branchId,
      p_counted_at: parsed.data.countedAt,
      p_warehouse: parsed.data.warehouse,
      p_category_id: parsed.data.categoryId || null,
      p_blind_count: formData.get("blindCount") === "on",
      p_variance_approval_threshold: parsed.data.varianceApprovalThreshold,
      p_notes: parsed.data.notes || null,
      p_idempotency_key: String(formData.get("idempotencyKey") || crypto.randomUUID()),
      p_actor_user_id: userId,
    });
    if (error) return invalid(error.message);
    const result = data as { success?: boolean; duplicate?: boolean; count_number?: string } | null;
    if (!result?.success) return invalid("تعذر إنشاء جلسة الجرد.");
    revalidateStockCountPaths();
    return ok(result.duplicate ? "جلسة الجرد موجودة مسبقًا؛ لم تُكرر." : `بدأت جلسة الجرد ${result.count_number ?? ""}.`);
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر بدء جلسة الجرد.");
  }
}

const progressSchema = z.object({
  stockCountId: uuid,
  mode: z.enum(["first", "recount"]),
});

export async function saveStockCountProgressAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!hasSupabaseAdminEnv()) return invalid("مفتاح Supabase الإداري غير موجود.");
  const parsed = progressSchema.safeParse({
    stockCountId: formData.get("stockCountId"),
    mode: formData.get("mode"),
  });
  if (!parsed.success) return invalid("جلسة الجرد أو مرحلة العد غير صالحة.");

  const itemIds = formData.getAll("itemId").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const reasons = formData.getAll("varianceReason").map(String);
  if (!itemIds.length || itemIds.length !== quantities.length || itemIds.some((value) => !uuid.safeParse(value).success)) {
    return invalid("بنود الجرد غير مكتملة أو غير صالحة.");
  }
  const lines = itemIds.map((itemId, index) => ({
    item_id: itemId,
    quantity: quantities[index],
    variance_reason: reasons[index] || null,
  }));
  if (lines.some((line) => line.quantity === "" || !Number.isFinite(Number(line.quantity)) || Number(line.quantity) < 0)) {
    return invalid("كل كمية عد يجب أن تكون رقمًا غير سالب.");
  }

  try {
    const { admin, auth, organizationId, userId } = await resolveScope();
    const session = await requireScopedSession(admin, organizationId, parsed.data.stockCountId);
    requireSensitiveActionCapability(auth, "inventory_movement_write", session.branch_id);
    const submit = formData.get("submitStage") === "yes";
    const { data, error } = await (admin as any).rpc("save_stock_count_progress_atomic", {
      p_organization_id: organizationId,
      p_stock_count_id: parsed.data.stockCountId,
      p_lines: lines,
      p_mode: parsed.data.mode,
      p_submit: submit,
      p_actor_user_id: userId,
    });
    if (error) return invalid(error.message);
    if (!(data as { success?: boolean } | null)?.success) return invalid("تعذر حفظ العد.");
    revalidateStockCountPaths();
    return ok(submit ? "حُفظ العد وانتقلت الجلسة للمرحلة التالية." : "حُفظ تقدم العد دون ترحيل أي فرق.");
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ العد.");
  }
}

const transitionSchema = z.object({
  stockCountId: uuid,
  transition: z.enum(["request_recount", "submit_review", "approve", "cancel", "close"]),
});

export async function transitionStockCountSessionAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!hasSupabaseAdminEnv()) return invalid("مفتاح Supabase الإداري غير موجود.");
  const parsed = transitionSchema.safeParse({
    stockCountId: formData.get("stockCountId"),
    transition: formData.get("transition"),
  });
  if (!parsed.success) return invalid("إجراء جلسة الجرد غير صالح.");
  const itemIds = formData.getAll("recountItemId").map(String).filter((value) => uuid.safeParse(value).success);
  if (parsed.data.transition === "request_recount" && itemIds.length === 0) {
    return invalid("حدد مادة واحدة على الأقل لإعادة العد.");
  }

  try {
    const { admin, auth, organizationId, userId } = await resolveScope();
    const session = await requireScopedSession(admin, organizationId, parsed.data.stockCountId);
    requireSensitiveActionCapability(auth, "inventory_movement_write", session.branch_id);
    const { data, error } = await (admin as any).rpc("transition_stock_count_session_atomic", {
      p_organization_id: organizationId,
      p_stock_count_id: parsed.data.stockCountId,
      p_action: parsed.data.transition,
      p_item_ids: itemIds,
      p_actor_user_id: userId,
    });
    if (error) return invalid(error.message);
    if (!(data as { success?: boolean } | null)?.success) return invalid("تعذر تحديث حالة جلسة الجرد.");
    revalidateStockCountPaths();
    const messages: Record<typeof parsed.data.transition, string> = {
      request_recount: "أُرسلت المواد ذات الفروقات لإعادة العد.",
      submit_review: "أُرسلت الجلسة للاعتماد.",
      approve: "اعتُمدت الجلسة وهي جاهزة للترحيل.",
      cancel: "أُلغيت الجلسة قبل الترحيل مع بقاء سجل التدقيق.",
      close: "أُغلقت جلسة الجرد.",
    };
    return ok(messages[parsed.data.transition]);
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر تحديث جلسة الجرد.");
  }
}

export async function postStockCountSessionAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!hasSupabaseAdminEnv()) return invalid("مفتاح Supabase الإداري غير موجود.");
  const stockCountId = String(formData.get("stockCountId") || "");
  if (!uuid.safeParse(stockCountId).success) return invalid("جلسة الجرد غير صالحة.");

  try {
    const { admin, auth, organizationId, userId } = await resolveScope();
    const session = await requireScopedSession(admin, organizationId, stockCountId);
    requireSensitiveActionCapability(auth, "inventory_movement_write", session.branch_id);
    const { data, error } = await (admin as any).rpc("post_stock_count_session_atomic", {
      p_organization_id: organizationId,
      p_stock_count_id: stockCountId,
      p_idempotency_key: String(formData.get("idempotencyKey") || `stock-count-post:${stockCountId}`),
      p_actor_user_id: userId,
    });
    if (error) return invalid(error.message);
    const result = data as { success?: boolean; duplicate?: boolean; variance_count?: number } | null;
    if (!result?.success) return invalid("تعذر ترحيل فروقات الجرد.");
    revalidateStockCountPaths();
    return ok(result.duplicate ? "هذه الجلسة مرحّلة مسبقًا؛ لم تُكرر الحركة أو القيد." : `رُحّلت الجلسة ذريًا (${result.variance_count ?? 0} فروقات).`);
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر ترحيل جلسة الجرد.");
  }
}
