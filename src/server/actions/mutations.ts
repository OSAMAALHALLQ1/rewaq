"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  demoRequestSchema,
  inventoryItemSchema,
  menuItemSchema,
  recipeSchema,
  supplierSchema,
  salesReturnSchema,
} from "@/lib/validation/schemas";
import {
  parseJsonField,
  purchaseOrderDraftInputSchema,
  purchaseReceiptInputSchema,
} from "@/lib/purchasing/contracts";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createAdminClient, createAdminClientWithContext, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { requireAuth, requireSensitiveActionCapability } from "@/lib/auth/require-auth";
import { logAuditEvent } from "@/lib/audit/log";
import type { RewaqModule } from "@/lib/billing/plans";
import { requireOrganizationModule } from "@/server/billing/entitlements";
import {
  postCashVarianceJournal,
  postCustomerInvoiceJournal,
  postInventoryWriteOffJournal,
  todayLocal,
} from "@/lib/accounting/posting";
import { addCashDrawerEntry } from "@/lib/sales/shift-posting";
import type { Tables } from "@/types/database";
import type { ActionState } from "./auth";

/** Local-date addition (avoids UTC off-by-one). Returns YYYY-MM-DD. */
function addDaysLocal(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ok(message: string): ActionState {
  return { ok: true, message };
}

function invalid(message: string): ActionState {
  return { ok: false, message };
}

const saleInvoiceItemSchema = z.object({
  catalog_item_id: z.string().uuid(),
  barcode: z.string().optional(),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().nonnegative(),
  discount: z.coerce.number().nonnegative().default(0),
  tax_rate: z.coerce.number().nonnegative().default(0),
  unit_name: z.string().optional(),
  unit_factor: z.coerce.number().positive().default(1),
});

const issueCustomerInvoiceSchema = z.object({
  organizationId: z.string().uuid(),
  branchId: z.string().uuid(),
  customerName: z.string().default("عميل نقدي"),
  customerPhone: z.string().nullable().optional(),
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "delivery_app", "receivable", "wallet", "gift_card"]).default("cash"),
  payments: z.array(z.object({
    method: z.string(),
    amount: z.coerce.number().nonnegative(),
  })).optional(),
  channel: z.enum(["dine_in", "delivery", "pickup"]).default("dine_in"),
  items: z.array(saleInvoiceItemSchema).min(1),
  invoiceDiscount: z.coerce.number().nonnegative().default(0),
  serviceFee: z.coerce.number().nonnegative().default(0),
  deliveryFee: z.coerce.number().nonnegative().default(0),
  notes: z.string().nullable().optional(),
  idempotencyKey: z.string().optional(),
  allowNegativeStock: z.boolean().default(false),
});

const wasteLogSchema = z.object({
  branchId: z.string().uuid("اختر القسم"),
  itemId: z.string().uuid("اختر المادة"),
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  reason: z.enum(["تلف", "انتهاء صلاحية", "خطأ تحضير", "كسر/انسكاب", "منظفات", "إرجاع", "سبب آخر"]),
  notes: z.string().optional(),
});

const recipeVersionSchema = z.object({
  activationKey: z.string().uuid("رمز اعتماد الوصفة غير صالح"),
  name: z.string().trim().min(2, "اسم الوصفة مطلوب"),
  category: z.string().trim().min(1, "تصنيف الوصفة مطلوب"),
  servings: z.coerce.number().positive("عدد الحصص يجب أن يكون أكبر من صفر"),
  preparation: z.string().trim().max(4000).optional(),
  targetFoodCostPercent: z.coerce.number().positive().max(99.99),
  laborCostPerBatch: z.coerce.number().min(0),
  overheadCostPerBatch: z.coerce.number().min(0),
  ingredientsJson: z.string().min(2, "أضف مكوناً واحداً على الأقل"),
});

const recipeVersionIngredientSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  yieldPercent: z.coerce.number().positive().max(100).default(100),
});

const stockCountSchema = z.object({
  branchId: z.string().uuid("اختر القسم"),
  notes: z.string().optional(),
});

const closeShiftSchema = z.object({
  shiftId: z.string().uuid("وردية غير صحيحة"),
  actualCash: z.coerce.number().nonnegative("الكاش الفعلي يجب أن يكون صفر أو أكثر"),
  notes: z.string().optional(),
});

const productionOrderSchema = z.object({
  recipeId: z.string().uuid("اختر الوصفة"),
  branchId: z.string().uuid("اختر مستودع/قسم الإنتاج"),
  sourceBranchId: z.string().uuid("اختر مستودع صرف المواد"),
  plannedQuantity: z.coerce.number().positive("الكمية المخططة يجب أن تكون أكبر من صفر"),
  completedQuantity: z.coerce.number().positive("الكمية المنتجة يجب أن تكون أكبر من صفر"),
  allowNegativeStock: z.boolean().default(false),
  notes: z.string().optional(),
});

async function resolveMutationScope(module: RewaqModule) {
  const auth = await requireAuth();
  const admin = createAdminClientWithContext("mutations.ts/resolveMutationScope");

  // Use the user's org from auth (populated by requireAuth via membership lookup)
  if (auth.organizationId) {
    await requireOrganizationModule(admin, auth.organizationId, module, { write: true });
    return { admin, organizationId: auth.organizationId, userId: auth.id, auth };
  }

  throw new Error("لم يتم تحديد مؤسسة نشطة للجلسة. اختر المؤسسة صراحةً ثم أعد المحاولة.");
}

function inferUnitKind(name: string) {
  const normalized = name.trim().toLowerCase();

  if (["كغم", "kg", "كيلو", "كيلوغرام"].includes(normalized)) return { symbol: "kg", kind: "weight" };
  if (["غم", "g", "جرام"].includes(normalized)) return { symbol: "g", kind: "weight" };
  if (["لتر", "l"].includes(normalized)) return { symbol: "L", kind: "volume" };
  if (["مل", "ml"].includes(normalized)) return { symbol: "ml", kind: "volume" };
  if (["كرتونة", "case", "صندوق"].includes(normalized)) return { symbol: "case", kind: "pack" };
  if (["كيس", "bag"].includes(normalized)) return { symbol: "bag", kind: "pack" };
  if (["قطعة", "حبة", "pc", "pcs"].includes(normalized)) return { symbol: "pc", kind: "count" };

  return { symbol: name.trim(), kind: "count" };
}

async function findOrCreateUnit(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  name: string,
  userId: string | null,
) {
  const normalizedName = name.trim();

  const { data: existing, error: selectError } = await admin
    .from("units")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("name", normalizedName)
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }

  if (existing?.id) {
    return existing.id;
  }

  const { symbol, kind } = inferUnitKind(normalizedName);
  const { data: created, error: insertError } = await admin
    .from("units")
    .insert({
      organization_id: organizationId,
      name: normalizedName,
      symbol,
      kind,
      created_by: userId,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return created.id;
}

async function findOrCreateInventoryCategory(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  name: string,
  userId: string | null,
) {
  const normalizedName = name.trim();

  const { data: existing, error: selectError } = await admin
    .from("inventory_categories")
    .select("id")
    .eq("organization_id", organizationId)
    .ilike("name", normalizedName)
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }

  if (existing?.id) {
    return existing.id;
  }

  const { data: created, error: insertError } = await admin
    .from("inventory_categories")
    .insert({
      organization_id: organizationId,
      name: normalizedName,
      created_by: userId,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return created.id;
}

async function getScopedBranch(admin: ReturnType<typeof createAdminClient>, organizationId: string, branchId: string) {
  const { data, error } = await admin
    .from("branches")
    .select("id")
    .eq("id", branchId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function getScopedInventoryItem(admin: ReturnType<typeof createAdminClient>, organizationId: string, itemId: string) {
  const { data, error } = await admin
    .from("inventory_items")
    .select("id,name,average_cost")
    .eq("id", itemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

async function setBranchStockQuantity(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  branchId: string,
  itemId: string,
  quantity: number,
  userId: string | null,
) {
  const { data: stock, error: stockError } = await admin
    .from("branch_stock")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("branch_id", branchId)
    .eq("item_id", itemId)
    .maybeSingle();

  if (stockError) throw new Error(stockError.message);

  if (stock?.id) {
    const { error } = await admin.from("branch_stock").update({ quantity }).eq("id", stock.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await admin.from("branch_stock").insert({
    organization_id: organizationId,
    branch_id: branchId,
    item_id: itemId,
    quantity,
    reserved_quantity: 0,
    created_by: userId,
  });

  if (error) throw new Error(error.message);
}

async function addToBranchStock(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  branchId: string,
  itemId: string,
  delta: number,
  userId: string | null,
) {
  const { data: stock, error: stockError } = await admin
    .from("branch_stock")
    .select("id,quantity")
    .eq("organization_id", organizationId)
    .eq("branch_id", branchId)
    .eq("item_id", itemId)
    .maybeSingle();

  if (stockError) throw new Error(stockError.message);

  await setBranchStockQuantity(
    admin,
    organizationId,
    branchId,
    itemId,
    Number(stock?.quantity ?? 0) + delta,
    userId,
  );
}

function normalizeUnit(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function convertQuantity(quantity: number, fromUnit: string | null | undefined, toUnit: string | null | undefined) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (!from || !to || from === to) return quantity;

  if (["غم", "g", "gram", "grams", "جرام"].includes(from) && ["كغم", "kg", "كيلو", "كيلوغرام"].includes(to)) {
    return quantity / 1000;
  }

  if (["كغم", "kg", "كيلو", "كيلوغرام"].includes(from) && ["غم", "g", "gram", "grams", "جرام"].includes(to)) {
    return quantity * 1000;
  }

  if (["مل", "ml"].includes(from) && ["لتر", "l"].includes(to)) {
    return quantity / 1000;
  }

  if (["لتر", "l"].includes(from) && ["مل", "ml"].includes(to)) {
    return quantity * 1000;
  }

  return quantity;
}


async function nextProductionOrderNumber(admin: ReturnType<typeof createAdminClient>, organizationId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const compactDate = today.replaceAll("-", "");
  const { count, error } = await (admin as any)
    .from("production_orders")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", `${today}T00:00:00.000Z`)
    .lt("created_at", `${today}T23:59:59.999Z`);

  if (error) throw new Error(error.message);

  return `PROD-${compactDate}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

async function updateSalesSummary(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  branchId: string,
  channel: "dine_in" | "delivery" | "pickup",
  salesDelta: number,
  costDelta: number,
) {
  const summaryDate = new Date().toISOString().slice(0, 10);
  const { data: existing, error: selectError } = await admin
    .from("sales_daily_summaries")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("branch_id", branchId)
    .eq("summary_date", summaryDate)
    .eq("channel", channel)
    .maybeSingle();

  if (selectError) throw new Error(selectError.message);

  if (existing?.id) {
    const { error } = await admin
      .from("sales_daily_summaries")
      .update({
        orders_count: Number(existing.orders_count ?? 0) + (salesDelta >= 0 ? 1 : -1),
        sales_total: Number(existing.sales_total ?? 0) + salesDelta,
        ingredient_cost_total: Number(existing.ingredient_cost_total ?? 0) + costDelta,
      })
      .eq("id", existing.id);

    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await admin.from("sales_daily_summaries").insert({
    organization_id: organizationId,
    branch_id: branchId,
    summary_date: summaryDate,
    channel,
    orders_count: salesDelta >= 0 ? 1 : -1,
    sales_total: salesDelta,
    ingredient_cost_total: costDelta,
  });

  if (error) throw new Error(error.message);
}

export async function findCatalogItemByBarcodeAction(organizationId: string, barcode: string) {
  if (!hasSupabaseEnv()) {
    return { ok: false as const, message: "مفاتيح Supabase غير مكتملة. أضف مفتاح publishable في .env.local." };
  }

  const parsed = z.object({ organizationId: z.string().uuid(), barcode: z.string().min(1) }).safeParse({ organizationId, barcode });
  if (!parsed.success) return { ok: false as const, message: "بيانات الباركود غير صحيحة" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_catalog_item_by_barcode", {
    p_organization_id: parsed.data.organizationId,
    p_barcode: parsed.data.barcode,
  });

  if (error) return { ok: false as const, message: error.message };
  const item = data?.[0];
  if (!item) return { ok: false as const, message: "هذا الباركود غير مربوط بأي صنف" };

  return { ok: true as const, item };
}

export async function issueCustomerInvoiceAction(input: unknown) {
  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن إصدار الفاتورة في قاعدة البيانات.");
  }

  const parsed = issueCustomerInvoiceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات الفاتورة غير صحيحة");

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("sales");
    requireSensitiveActionCapability(auth, "sales_write", parsed.data.branchId);
    const branch = await getScopedBranch(admin, organizationId, parsed.data.branchId);
    if (!branch?.id) return invalid("القسم المختار غير موجود في المؤسسة الحالية.");

    const idempotencyKey = parsed.data.idempotencyKey ?? crypto.randomUUID();
    const { data: existing } = await admin
      .from("customer_invoices")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing?.id) {
      return ok("تم إصدار الفاتورة سابقًا بنفس مفتاح العملية.");
    }

    const catalogIds = parsed.data.items.map((item) => item.catalog_item_id);
    const { data: catalogRows, error: catalogError } = await admin
      .from("catalog_items")
      .select("*")
      .eq("organization_id", organizationId)
      .in("id", catalogIds);

    if (catalogError) return invalid(catalogError.message);

    const catalogMap = new Map((catalogRows ?? []).map((item) => [item.id, item]));
    const menuItemIds = (catalogRows ?? []).map((item) => item.menu_item_id).filter((value): value is string => Boolean(value));
    const inventoryItemIds = (catalogRows ?? []).map((item) => item.inventory_item_id).filter((value): value is string => Boolean(value));

    const [{ data: mappings, error: mappingError }, { data: directItems, error: directItemsError }] = await Promise.all([
      menuItemIds.length
        ? admin.from("menu_item_recipe_mapping").select("*").eq("organization_id", organizationId).in("menu_item_id", menuItemIds)
        : Promise.resolve({ data: [], error: null }),
      inventoryItemIds.length
        ? admin.from("inventory_items").select("id,name,average_cost,usage_unit_id").eq("organization_id", organizationId).in("id", inventoryItemIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (mappingError) return invalid(mappingError.message);
    if (directItemsError) return invalid(directItemsError.message);

    const recipeIds = (mappings ?? []).map((mapping) => mapping.recipe_id);
    const { data: ingredientRows, error: ingredientError } = recipeIds.length
      ? await admin.from("recipe_ingredients").select("*").eq("organization_id", organizationId).in("recipe_id", recipeIds)
      : { data: [], error: null };

    if (ingredientError) return invalid(ingredientError.message);

    const allIngredientItemIds = (ingredientRows ?? []).map((ingredient) => ingredient.item_id);
    const allItemIds = Array.from(new Set([...inventoryItemIds, ...allIngredientItemIds]));
    const [{ data: allItems, error: allItemsError }, { data: units, error: unitsError }, { data: stockRows, error: stockError }] = await Promise.all([
      allItemIds.length
        ? admin.from("inventory_items").select("id,name,average_cost,usage_unit_id").eq("organization_id", organizationId).in("id", allItemIds)
        : Promise.resolve({ data: [], error: null }),
      admin.from("units").select("id,name").eq("organization_id", organizationId),
      allItemIds.length
        ? admin
            .from("branch_stock")
            .select("item_id,quantity")
            .eq("organization_id", organizationId)
            .eq("branch_id", parsed.data.branchId)
            .in("item_id", allItemIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (allItemsError) return invalid(allItemsError.message);
    if (unitsError) return invalid(unitsError.message);
    if (stockError) return invalid(stockError.message);

    const itemMap = new Map((allItems ?? directItems ?? []).map((item) => [item.id, item]));
    const unitMap = new Map((units ?? []).map((unit) => [unit.id, unit.name]));
    const stockMap = new Map((stockRows ?? []).map((stock) => [stock.item_id, Number(stock.quantity ?? 0)]));
    const mappingsByMenuItem = new Map<string, typeof mappings>();

    for (const mapping of mappings ?? []) {
      mappingsByMenuItem.set(mapping.menu_item_id, [...(mappingsByMenuItem.get(mapping.menu_item_id) ?? []), mapping]);
    }

    const ingredientsByRecipe = new Map<string, Tables<"recipe_ingredients">[]>();
    for (const ingredient of ingredientRows ?? []) {
      ingredientsByRecipe.set(ingredient.recipe_id, [...(ingredientsByRecipe.get(ingredient.recipe_id) ?? []), ingredient]);
    }

    const stockDeltas = new Map<string, { quantity: number; unitCost: number; name: string }>();
    const invoiceLines: Array<{
      catalog: Tables<"catalog_items">;
      input: z.infer<typeof saleInvoiceItemSchema>;
      lineSubtotal: number;
      lineTax: number;
      lineCost: number;
    }> = [];

    for (const line of parsed.data.items) {
      const catalog = catalogMap.get(line.catalog_item_id);
      if (!catalog || catalog.status !== "active") return invalid("صنف غير معروف أو غير نشط في الفاتورة.");

      const quantity = Math.max(line.quantity, 0);
      const unitPrice = Math.max(line.unit_price || Number(catalog.retail_price ?? 0), 0);
      const discount = Math.max(line.discount ?? 0, 0);
      const taxRate = Math.max(line.tax_rate ?? Number(catalog.tax_rate ?? 0), 0);
      const lineSubtotal = Math.max((unitPrice - discount) * quantity, 0);
      const lineTax = lineSubtotal * (taxRate / 100);
      let lineCost = 0;

      if (catalog.inventory_item_id) {
        const item = itemMap.get(catalog.inventory_item_id);
        const requiredQuantity = quantity * Math.max(line.unit_factor ?? 1, 1);
        const unitCost = Number(item?.average_cost ?? 0);
        const previous = stockDeltas.get(catalog.inventory_item_id) ?? { quantity: 0, unitCost, name: item?.name ?? catalog.name };
        stockDeltas.set(catalog.inventory_item_id, {
          ...previous,
          quantity: previous.quantity + requiredQuantity,
        });
        lineCost += requiredQuantity * unitCost;
      }

      for (const mapping of mappingsByMenuItem.get(catalog.menu_item_id ?? "") ?? []) {
        for (const ingredient of ingredientsByRecipe.get(mapping.recipe_id) ?? []) {
          const item = itemMap.get(ingredient.item_id);
          const ingredientUnitName = ingredient.unit_id ? unitMap.get(ingredient.unit_id) : undefined;
          const usageUnitName = item?.usage_unit_id ? unitMap.get(item.usage_unit_id) : undefined;
          const requiredQuantity =
            convertQuantity(Number(ingredient.quantity ?? 0), ingredientUnitName, usageUnitName) *
            quantity *
            Number(mapping.portion_multiplier ?? 1);
          const unitCost = Number(item?.average_cost ?? ingredient.unit_cost ?? 0);
          const previous = stockDeltas.get(ingredient.item_id) ?? { quantity: 0, unitCost, name: item?.name ?? "مادة خام" };

          stockDeltas.set(ingredient.item_id, {
            ...previous,
            quantity: previous.quantity + requiredQuantity,
          });
          lineCost += requiredQuantity * unitCost;
        }
      }

      invoiceLines.push({ catalog, input: line, lineSubtotal, lineTax, lineCost });
    }

    if (!parsed.data.allowNegativeStock) {
      for (const [itemId, deduction] of stockDeltas) {
        const available = stockMap.get(itemId) ?? 0;
        if (available < deduction.quantity) {
          return invalid(`المخزون لا يكفي للمادة الخام: ${deduction.name}`);
        }
      }
    }

    const subtotal = invoiceLines.reduce((sum, line) => sum + line.lineSubtotal, 0);
    const taxTotal = invoiceLines.reduce((sum, line) => sum + line.lineTax, 0);
    const costTotal = Array.from(stockDeltas.values()).reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    const total = Math.max(subtotal - parsed.data.invoiceDiscount + taxTotal + parsed.data.serviceFee + parsed.data.deliveryFee, 0);
    
    // Concurrency-safe atomic invoice counter
    const { data: nextNum, error: seqError } = await admin
      .rpc("get_next_invoice_number", {
        p_org_id: organizationId,
        p_branch_id: parsed.data.branchId,
      });

    if (seqError) return invalid("فشل توليد رقم الفاتورة الذري: " + seqError.message);
    const invoiceNumber = `POS-${new Date().getFullYear()}-${String(nextNum ?? 1).padStart(6, "0")}`;

    const { data: invoice, error: invoiceError } = await admin
      .from("customer_invoices")
      .insert({
        organization_id: organizationId,
        branch_id: parsed.data.branchId,
        invoice_number: invoiceNumber,
        customer_name: parsed.data.customerName || "عميل نقدي",
        customer_phone: parsed.data.customerPhone ?? null,
        status: "paid",
        payment_method: parsed.data.paymentMethod,
        channel: parsed.data.channel,
        subtotal,
        discount: parsed.data.invoiceDiscount,
        tax_total: taxTotal,
        total,
        service_fee: parsed.data.serviceFee,
        delivery_fee: parsed.data.deliveryFee,
        cost_total: costTotal,
        gross_profit: total - costTotal,
        notes: parsed.data.notes ?? null,
        idempotency_key: idempotencyKey,
        created_by: userId,
      })
      .select("id")
      .single();

    if (invoiceError) return invalid(invoiceError.message);

    for (const line of invoiceLines) {
      const { error } = await admin.from("customer_invoice_items").insert({
        organization_id: organizationId,
        customer_invoice_id: invoice.id,
        catalog_item_id: line.catalog.id,
        menu_item_id: line.catalog.menu_item_id,
        name: line.catalog.name,
        quantity: line.input.quantity,
        unit_price: line.input.unit_price,
        barcode: line.input.barcode ?? null,
        unit_name: line.input.unit_name ?? line.catalog.main_unit,
        unit_factor: line.input.unit_factor,
        discount: line.input.discount,
        tax_rate: line.input.tax_rate,
        cost_total: line.lineCost,
        gross_profit: line.lineSubtotal - line.lineCost,
        created_by: userId,
      });

      if (error) return invalid(error.message);
    }

    for (const [itemId, deduction] of stockDeltas) {
      await addToBranchStock(admin, organizationId, parsed.data.branchId, itemId, -deduction.quantity, userId);

      const { error } = await admin.from("stock_movements").insert({
        organization_id: organizationId,
        branch_id: parsed.data.branchId,
        item_id: itemId,
        movement_type: "sale_usage",
        quantity: -deduction.quantity,
        unit_cost: deduction.unitCost,
        source_doc_type: "customer_invoice",
        source_doc_id: invoice.id,
        idempotency_key: `${invoice.id}:${itemId}`,
        notes: "خصم تلقائي عند إصدار فاتورة كاشير",
        created_by: userId,
      });

      if (error && !error.message.includes("duplicate key")) return invalid(error.message);
    }

    if (parsed.data.payments && parsed.data.payments.length > 0) {
      for (const pay of parsed.data.payments) {
        if (pay.amount > 0) {
          const { error: paymentError } = await admin.from("customer_invoice_payments").insert({
            organization_id: organizationId,
            customer_invoice_id: invoice.id,
            payment_method: pay.method,
            amount: pay.amount,
            created_by: userId,
          });
          if (paymentError) return invalid(paymentError.message);
        }
      }
    } else {
      const { error: paymentError } = await admin.from("customer_invoice_payments").insert({
        organization_id: organizationId,
        customer_invoice_id: invoice.id,
        payment_method: parsed.data.paymentMethod,
        amount: total,
        created_by: userId,
      });
      if (paymentError) return invalid(paymentError.message);
    }

    await postCustomerInvoiceJournal(admin, {
      organizationId,
      branchId: parsed.data.branchId,
      invoiceId: invoice.id,
      invoiceNumber,
      paymentMethod: parsed.data.paymentMethod,
      payments: parsed.data.payments,
      subtotal,
      taxTotal,
      total,
      costTotal,
      discount: parsed.data.invoiceDiscount,
      serviceFee: parsed.data.serviceFee,
      deliveryFee: parsed.data.deliveryFee,
      entryDate: todayLocal(),
      createdBy: userId,
    });

    await updateSalesSummary(admin, organizationId, parsed.data.branchId, parsed.data.channel, total, costTotal);
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر إصدار الفاتورة في Supabase.");
  }

  revalidatePath("/dashboard/customer-invoices");
  revalidatePath("/dashboard/customer-invoices/new");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movements");
  revalidatePath("/dashboard/amwali");

  return ok("تم إصدار الفاتورة وحفظها وخصم المكونات من المخزون.");
}

export async function saveInventoryItemAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = inventoryItemSchema.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    categoryName: formData.get("categoryName") || undefined,
    purchaseUnit: formData.get("purchaseUnit"),
    usageUnit: formData.get("usageUnit"),
    lastPurchasePrice: formData.get("lastPurchasePrice"),
    averageCost: formData.get("averageCost"),
    minimumQuantity: formData.get("minimumQuantity"),
    primarySupplierId: formData.get("primarySupplierId") || undefined,
    sku: formData.get("sku") || undefined,
    notes: formData.get("notes") || undefined,
    isActive: formData.get("isActive") !== "false",
    warehouse: formData.get("warehouse") || undefined,
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات المادة غير صحيحة");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن حفظ مادة المخزون في قاعدة البيانات.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("inventory");
    requireSensitiveActionCapability(auth, "inventory_catalog_write");

    const supplierResult = parsed.data.primarySupplierId
      ? await admin
          .from("suppliers")
          .select("id")
          .eq("id", parsed.data.primarySupplierId)
          .eq("organization_id", organizationId)
          .maybeSingle()
      : { data: null, error: null };

    if (supplierResult.error) return invalid(supplierResult.error.message);

    let categoryId = parsed.data.categoryId || "";
    if (parsed.data.categoryName?.trim()) {
      categoryId = await findOrCreateInventoryCategory(admin, organizationId, parsed.data.categoryName, userId);
    } else if (categoryId) {
      const { data: category, error: categoryError } = await admin
        .from("inventory_categories")
        .select("id")
        .eq("id", categoryId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (categoryError) return invalid(categoryError.message);
      if (!category?.id) {
        return invalid("الفئة المختارة غير موجودة في المؤسسة الحالية.");
      }
    }

    if (parsed.data.primarySupplierId && !supplierResult.data?.id) {
      return invalid("المورد المختار غير موجود في المؤسسة الحالية.");
    }

    const [purchaseUnitId, usageUnitId] = await Promise.all([
      findOrCreateUnit(admin, organizationId, parsed.data.purchaseUnit, userId),
      findOrCreateUnit(admin, organizationId, parsed.data.usageUnit, userId),
    ]);

    const { error } = await admin.from("inventory_items").insert({
      organization_id: organizationId,
      category_id: categoryId,
      primary_supplier_id: parsed.data.primarySupplierId || null,
      name: parsed.data.name,
      purchase_unit_id: purchaseUnitId,
      usage_unit_id: usageUnitId,
      last_purchase_price: parsed.data.lastPurchasePrice,
      average_cost: parsed.data.averageCost,
      minimum_quantity: parsed.data.minimumQuantity,
      sku: parsed.data.sku || null,
      notes: parsed.data.notes || null,
      status: parsed.data.isActive ? "active" : "inactive",
      warehouse: parsed.data.warehouse || "general",
      created_by: userId,
    });

    if (error) {
      return invalid(error.message);
    }
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ مادة المخزون في Supabase.");
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/reports");
  return ok("تم حفظ مادة المخزون في Supabase.");
}

export async function saveSupplierAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = supplierSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email") || "",
    address: formData.get("address") || "",
    notes: formData.get("notes") || "",
    status: formData.get("status") || "active",
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات المورد غير صحيحة");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن حفظ المورد في قاعدة البيانات.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("suppliers");
    requireSensitiveActionCapability(auth, "purchasing_write");
    const { error } = await admin.from("suppliers").insert({
      organization_id: organizationId,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
      status: parsed.data.status,
      created_by: userId,
    });

    if (error) {
      return invalid(error.message);
    }
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ المورد في Supabase.");
  }

  revalidatePath("/dashboard/suppliers");
  revalidatePath("/dashboard/purchase-orders");
  return ok("تم حفظ المورد في Supabase.");
}

export async function saveSalesReturnAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = salesReturnSchema.safeParse({
    branchId: formData.get("branchId"),
    itemId: formData.get("itemId"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
    notes: formData.get("notes") || "",
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات المرتجع غير صحيحة");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن حفظ المرتجع في قاعدة البيانات.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("inventory");
    requireSensitiveActionCapability(auth, "inventory_movement_write", parsed.data.branchId);
    const [branch, item] = await Promise.all([
      getScopedBranch(admin, organizationId, parsed.data.branchId),
      getScopedInventoryItem(admin, organizationId, parsed.data.itemId),
    ]);

    if (!branch?.id) return invalid("القسم المختار غير موجود في المؤسسة الحالية.");
    if (!item?.id) return invalid("المادة المختارة غير موجودة في المؤسسة الحالية.");

    const unitCost = Number(item.average_cost ?? 0);
    const { error: movementError } = await admin.from("stock_movements").insert({
      organization_id: organizationId,
      branch_id: parsed.data.branchId,
      item_id: parsed.data.itemId,
      movement_type: "return",
      quantity: parsed.data.quantity,
      unit_cost: unitCost,
      source_doc_type: "return",
      source_doc_id: null,
      notes: `${parsed.data.reason}${parsed.data.notes ? ` - ${parsed.data.notes}` : ""}`,
      created_by: userId,
    });

    if (movementError) return invalid(movementError.message);
    await addToBranchStock(admin, organizationId, parsed.data.branchId, parsed.data.itemId, parsed.data.quantity, userId);
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ المرتجع في Supabase.");
  }

  revalidatePath("/dashboard/sales-returns");
  revalidatePath("/dashboard/stock-movements");
  revalidatePath("/dashboard/inventory");
  return ok("تم تسجيل المرتجع وتحديث المخزون.");
}

export async function savePurchaseOrderAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let items: unknown;
  let attachmentMetadata: unknown;
  try {
    items = parseJsonField(formData.get("itemsJson"), "بنود أمر الشراء");
    const rawAttachments = formData.get("attachmentMetadataJson");
    attachmentMetadata = typeof rawAttachments === "string" && rawAttachments.trim()
      ? parseJsonField(rawAttachments, "بيانات المرفقات")
      : [];
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "بيانات أمر الشراء غير صالحة.");
  }

  const parsed = purchaseOrderDraftInputSchema.safeParse({
    supplierId: formData.get("supplierId"),
    branchId: formData.get("branchId"),
    orderDate: formData.get("orderDate"),
    expectedDate: formData.get("expectedDate"),
    destinationWarehouse: formData.get("destinationWarehouse"),
    destinationLocation: formData.get("destinationLocation"),
    paymentTerms: formData.get("paymentTerms"),
    shippingAmount: formData.get("shippingAmount") || 0,
    notes: formData.get("notes") || undefined,
    idempotencyKey: formData.get("idempotencyKey"),
    attachmentMetadata,
    items,
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات أمر الشراء غير صحيحة");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن حفظ أمر الشراء في قاعدة البيانات.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("purchasing");
    requireSensitiveActionCapability(auth, "purchasing_write", parsed.data.branchId);
    const [branch, supplierResult] = await Promise.all([
      getScopedBranch(admin, organizationId, parsed.data.branchId),
      admin
        .from("suppliers")
        .select("id")
        .eq("id", parsed.data.supplierId)
        .eq("organization_id", organizationId)
        .maybeSingle(),
    ]);

    if (!branch?.id) return invalid("القسم المختار غير موجود في المؤسسة الحالية.");
    if (supplierResult.error) return invalid(supplierResult.error.message);
    if (!supplierResult.data?.id) return invalid("المورد المختار غير موجود في المؤسسة الحالية.");

    const { data: result, error } = await admin.rpc("create_purchase_order_atomic", {
      p_organization_id: organizationId,
      p_supplier_id: parsed.data.supplierId,
      p_branch_id: parsed.data.branchId,
      p_order_date: parsed.data.orderDate,
      p_expected_date: parsed.data.expectedDate,
      p_destination_warehouse: parsed.data.destinationWarehouse,
      p_destination_location: parsed.data.destinationLocation,
      p_payment_terms: parsed.data.paymentTerms,
      p_items: parsed.data.items.map((item) => ({
        item_id: item.itemId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_amount: item.discountAmount,
        tax_rate: item.taxRate,
      })),
      p_shipping_amount: parsed.data.shippingAmount,
      p_notes: parsed.data.notes || null,
      p_attachment_metadata: parsed.data.attachmentMetadata,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_created_by: userId,
    });

    if (error) return invalid(error.message);
    const response = result as { success?: boolean; duplicate?: boolean } | null;
    if (!response?.success) return invalid("تعذر إنشاء أمر الشراء ببنوده.");
    if (response.duplicate) return ok("أمر الشراء محفوظ مسبقاً (تم تجاهل إعادة الإرسال).");
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ أمر الشراء في Supabase.");
  }

  revalidatePath("/dashboard/purchase-orders");
  return ok("تم حفظ مسودة أمر الشراء متعددة البنود. أرسلها للموافقة من قائمة الأوامر.");
}

async function transitionPurchaseOrder(
  formData: FormData,
  transition: "submit_purchase_order_atomic" | "approve_purchase_order_atomic",
): Promise<ActionState> {
  const parsed = z.object({
    purchaseOrderId: z.string().uuid("أمر الشراء غير صالح"),
    idempotencyKey: z.string().trim().min(8, "مفتاح منع التكرار غير صالح"),
  }).safeParse({
    purchaseOrderId: formData.get("purchaseOrderId"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات الإجراء غير صالحة.");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن تحديث أمر الشراء.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("purchasing");
    requireSensitiveActionCapability(auth, "purchasing_write");
    const { data: order, error: orderError } = await admin
      .from("purchase_orders")
      .select("id,branch_id")
      .eq("id", parsed.data.purchaseOrderId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (orderError) return invalid(orderError.message);
    if (!order) return invalid("أمر الشراء غير موجود.");
    requireSensitiveActionCapability(auth, "purchasing_write", order.branch_id);
    const { data, error } = await admin.rpc(transition, {
      p_organization_id: organizationId,
      p_purchase_order_id: parsed.data.purchaseOrderId,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_actor_user_id: userId,
    });
    if (error) return invalid(error.message);
    const response = data as { success?: boolean; duplicate?: boolean } | null;
    if (!response?.success) return invalid("تعذر تحديث دورة أمر الشراء.");
    if (response.duplicate) return ok("تم تنفيذ هذا الإجراء مسبقاً (تم تجاهل التكرار).");
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر تحديث أمر الشراء.");
  }

  revalidatePath("/dashboard/purchase-orders");
  return transition === "submit_purchase_order_atomic"
    ? ok("تم إرسال أمر الشراء للموافقة.")
    : ok("تم اعتماد أمر الشراء وإرساله للمورد.");
}

export async function submitPurchaseOrderAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  return transitionPurchaseOrder(formData, "submit_purchase_order_atomic");
}

export async function approvePurchaseOrderAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  return transitionPurchaseOrder(formData, "approve_purchase_order_atomic");
}

export async function receivePurchaseOrderAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let lines: unknown;
  try {
    lines = parseJsonField(formData.get("linesJson"), "بنود الاستلام");
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "بنود الاستلام غير صالحة.");
  }
  const parsed = purchaseReceiptInputSchema.safeParse({
    purchaseOrderId: formData.get("purchaseOrderId"),
    receivedAt: formData.get("receivedAt") || todayLocal(),
    notes: formData.get("notes") || undefined,
    idempotencyKey: formData.get("idempotencyKey"),
    lines,
  });
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات الاستلام غير صالحة.");
  if (parsed.data.receivedAt > todayLocal()) return invalid("لا يمكن زيادة المخزون باستلام مؤرخ في المستقبل.");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن تسجيل الاستلام.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("purchasing");
    requireSensitiveActionCapability(auth, "purchasing_write");
    const { data: order, error: orderError } = await admin
      .from("purchase_orders")
      .select("id,branch_id")
      .eq("id", parsed.data.purchaseOrderId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (orderError) return invalid(orderError.message);
    if (!order) return invalid("أمر الشراء غير موجود.");
    requireSensitiveActionCapability(auth, "purchasing_write", order.branch_id);
    const { data: receiptResult, error: receiptError } = await admin.rpc("record_purchase_receipt_atomic", {
      p_organization_id: organizationId,
      p_purchase_order_id: parsed.data.purchaseOrderId,
      p_received_at: parsed.data.receivedAt,
      p_lines: parsed.data.lines.map((line) => ({
        purchase_order_item_id: line.purchaseOrderItemId,
        accepted_quantity: line.acceptedQuantity,
        rejected_quantity: line.rejectedQuantity,
        rejection_reason: line.rejectionReason || null,
        batch_number: line.batchNumber || null,
        expiry_date: line.expiryDate || null,
        destination_warehouse: line.destinationWarehouse,
        destination_location: line.destinationLocation,
      })),
      p_notes: parsed.data.notes || null,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_created_by: userId,
    });

    if (receiptError) return invalid(receiptError.message);
    const response = receiptResult as {
      success?: boolean;
      duplicate?: boolean;
      accepted_quantity?: number;
      rejected_quantity?: number;
    } | null;
    if (!response?.success) return invalid("تعذر استلام أمر الشراء.");
    if (response.duplicate) return ok("تم استلام أمر الشراء مسبقاً (تم تجاهل التكرار).");
    if (Number(response.accepted_quantity ?? 0) === 0 && Number(response.rejected_quantity ?? 0) > 0) {
      revalidatePath("/dashboard/purchase-orders");
      return ok("تم تسجيل فحص الكمية المرفوضة دون أي زيادة في المخزون أو قيد GRNI.");
    }
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر تسجيل استلام أمر الشراء.");
  }

  revalidatePath("/dashboard/purchase-orders");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movements");
  revalidatePath("/dashboard/accounting/ledger");
  return ok("تم تسجيل الاستلام الجزئي وتحديث المخزون والقيد للكميات المقبولة فقط.");
}

export async function receivePurchaseOrderFormAction(formData: FormData): Promise<void> {
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  if (!purchaseOrderId) return;

  await receivePurchaseOrderAction({ ok: false, message: "" }, formData);
}

/**
 * Creates the recipe and its first active, immutable costed version in one RPC.
 * The live recipe_ingredients projection is produced by the database only after
 * the version snapshot has been retained for auditability.
 */
export async function activateRecipeVersionAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = recipeVersionSchema.safeParse({
    activationKey: formData.get("activationKey"),
    name: formData.get("name"),
    category: formData.get("category"),
    servings: formData.get("servings"),
    preparation: formData.get("preparation") || "",
    targetFoodCostPercent: formData.get("targetFoodCostPercent"),
    laborCostPerBatch: formData.get("laborCostPerBatch"),
    overheadCostPerBatch: formData.get("overheadCostPerBatch"),
    ingredientsJson: formData.get("ingredientsJson"),
  });
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات إصدار الوصفة غير صحيحة.");

  let rawIngredients: unknown;
  try {
    rawIngredients = JSON.parse(parsed.data.ingredientsJson);
  } catch {
    return invalid("مكونات الوصفة غير صالحة. أضف المواد من النموذج ثم أعد المحاولة.");
  }
  const ingredients = z.array(recipeVersionIngredientSchema).min(1).max(200).safeParse(rawIngredients);
  if (!ingredients.success) return invalid("تحقق من المادة والكمية ونسبة التصافي في كل سطر.");
  if (new Set(ingredients.data.map((ingredient) => ingredient.itemId)).size !== ingredients.data.length) {
    return invalid("لا تكرر المادة نفسها؛ اجمع الكمية في سطر واحد.");
  }

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن اعتماد إصدار الوصفة.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("recipes");
    // Version activation is a costing approval; the database RPC also restricts
    // the actor to the accounting approval roles.
    requireSensitiveActionCapability(auth, "accounting_write");
    const { data, error } = await (admin as any).rpc("activate_recipe_version_atomic", {
      p_organization_id: organizationId,
      p_recipe_id: null,
      p_name: parsed.data.name,
      p_category: parsed.data.category,
      p_servings: parsed.data.servings,
      p_preparation: parsed.data.preparation || null,
      p_target_food_cost_percent: parsed.data.targetFoodCostPercent,
      p_labor_cost_per_batch: parsed.data.laborCostPerBatch,
      p_overhead_cost_per_batch: parsed.data.overheadCostPerBatch,
      p_ingredients: ingredients.data.map((ingredient) => ({
        item_id: ingredient.itemId,
        quantity: ingredient.quantity,
        yield_percent: ingredient.yieldPercent,
      })),
      // The client keeps this key for a retry, so a lost response cannot create
      // a second immutable version for the same approval.
      p_activation_key: parsed.data.activationKey,
      p_actor_user_id: userId,
    });
    if (error) return invalid(error.message);
    if (!(data as { success?: boolean } | null)?.success) return invalid("تعذر اعتماد إصدار الوصفة.");
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر اعتماد إصدار الوصفة.");
  }

  revalidatePath("/dashboard/recipes");
  revalidatePath("/dashboard/menu-items");
  revalidatePath("/dashboard/food-cost");
  revalidatePath("/dashboard/cost-accounting");
  return ok("تم حفظ الوصفة واعتماد إصدار تكلفتها الحالي.");
}

export async function saveRecipeAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = recipeSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    servings: formData.get("servings"),
    preparation: formData.get("preparation") || "",
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات الوصفة غير صحيحة");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن حفظ الوصفة في قاعدة البيانات.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("recipes");
    requireSensitiveActionCapability(auth, "recipe_write");
    const servings = parsed.data.servings;
    const { error } = await admin.from("recipes").insert({
      organization_id: organizationId,
      name: parsed.data.name,
      category: parsed.data.category,
      servings,
      preparation: parsed.data.preparation || null,
      total_cost: 0,
      cost_per_serving: 0,
      status: "active",
      created_by: userId,
    });

    if (error) {
      return invalid(error.message);
    }
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ الوصفة في Supabase.");
  }

  revalidatePath("/dashboard/recipes");
  return ok("تم حفظ الوصفة في Supabase.");
}

export async function saveMenuItemAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = menuItemSchema.safeParse({
    name: formData.get("name"),
    recipeId: formData.get("recipeId"),
    sellingPrice: formData.get("sellingPrice"),
    branchId: formData.get("branchId") || undefined,
    status: formData.get("status") || "active",
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات الطبق غير صحيحة");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن حفظ الطبق في قاعدة البيانات.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("recipes");
    requireSensitiveActionCapability(auth, "menu_write", parsed.data.branchId ?? null);
    const [{ data: recipe, error: recipeError }, branch] = await Promise.all([
      admin
        .from("recipes")
        .select("id,category")
        .eq("id", parsed.data.recipeId)
        .eq("organization_id", organizationId)
        .maybeSingle(),
      parsed.data.branchId ? getScopedBranch(admin, organizationId, parsed.data.branchId) : Promise.resolve(null),
    ]);

    if (recipeError) return invalid(recipeError.message);
    if (!recipe?.id) return invalid("الوصفة المختارة غير موجودة في المؤسسة الحالية.");
    if (parsed.data.branchId && !branch?.id) return invalid("القسم المختار غير موجود في المؤسسة الحالية.");

    const { data: menuItem, error: menuError } = await admin
      .from("menu_items")
      .insert({
        organization_id: organizationId,
        branch_id: parsed.data.branchId || null,
        name: parsed.data.name,
        selling_price: parsed.data.sellingPrice,
        status: parsed.data.status,
        created_by: userId,
      })
      .select("id")
      .single();

    if (menuError) return invalid(menuError.message);

    const { error: mappingError } = await admin.from("menu_item_recipe_mapping").insert({
      organization_id: organizationId,
      menu_item_id: menuItem.id,
      recipe_id: parsed.data.recipeId,
      portion_multiplier: 1,
      created_by: userId,
    });

    if (mappingError) return invalid(mappingError.message);

    await admin.from("catalog_items").insert({
      organization_id: organizationId,
      branch_id: parsed.data.branchId || null,
      menu_item_id: menuItem.id,
      code: `MENU-${menuItem.id.slice(0, 8)}`,
      name: parsed.data.name,
      category_name: recipe.category,
      main_unit: "وجبة",
      retail_price: parsed.data.sellingPrice,
      wholesale_price: parsed.data.sellingPrice,
      tax_rate: 0,
      status: parsed.data.status,
      created_by: userId,
    });
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ الطبق في Supabase.");
  }

  revalidatePath("/dashboard/menu-items");
  revalidatePath("/dashboard/customer-invoices/new");
  return ok("تم حفظ الطبق في Supabase وربطه بالكتالوج.");
}

export async function saveProductionOrderAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = productionOrderSchema.safeParse({
    recipeId: formData.get("recipeId"),
    branchId: formData.get("branchId"),
    sourceBranchId: formData.get("sourceBranchId"),
    plannedQuantity: formData.get("plannedQuantity"),
    completedQuantity: formData.get("completedQuantity"),
    allowNegativeStock: formData.get("allowNegativeStock") === "true",
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات أمر الإنتاج غير صحيحة");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن حفظ أمر الإنتاج.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("production");
    requireSensitiveActionCapability(auth, "inventory_movement_write", parsed.data.branchId);
    requireSensitiveActionCapability(auth, "inventory_movement_write", parsed.data.sourceBranchId);
    const db = admin as any;

    const [recipeResult, branchResult, sourceBranchResult, ingredientResult] = await Promise.all([
      db
        .from("recipes")
        .select("id,name,servings")
        .eq("id", parsed.data.recipeId)
        .eq("organization_id", organizationId)
        .maybeSingle(),
      db
        .from("branches")
        .select("id,name")
        .eq("id", parsed.data.branchId)
        .eq("organization_id", organizationId)
        .maybeSingle(),
      db
        .from("branches")
        .select("id,name")
        .eq("id", parsed.data.sourceBranchId)
        .eq("organization_id", organizationId)
        .maybeSingle(),
      db
        .from("recipe_ingredients")
        .select("id,item_id,quantity,unit_cost,yield_percent")
        .eq("recipe_id", parsed.data.recipeId)
        .eq("organization_id", organizationId),
    ]);

    if (recipeResult.error) return invalid(recipeResult.error.message);
    if (branchResult.error) return invalid(branchResult.error.message);
    if (sourceBranchResult.error) return invalid(sourceBranchResult.error.message);
    if (ingredientResult.error) return invalid(ingredientResult.error.message);
    if (!recipeResult.data?.id) return invalid("الوصفة المختارة غير موجودة.");
    if (!branchResult.data?.id) return invalid("قسم الإنتاج غير موجود.");
    if (!sourceBranchResult.data?.id) return invalid("مستودع صرف المواد غير موجود.");

    type RecipeIngredientRow = {
      item_id: string;
      quantity: number | string | null;
      unit_cost: number | string | null;
      yield_percent: number | string | null;
    };
    type InventoryItemRow = {
      id: string;
      name: string;
      average_cost: number | string | null;
    };
    type BranchStockRow = {
      item_id: string;
      quantity: number | string | null;
    };
    type MaterialLine = {
      itemId: string;
      itemName: string;
      plannedQuantity: number;
      issuedQuantity: number;
      unitCost: number;
      yieldPercent: number;
      availableQuantity: number;
    };

    const ingredients = (ingredientResult.data ?? []) as RecipeIngredientRow[];
    if (ingredients.length === 0) {
      return invalid("الوصفة لا تحتوي على مواد خام. أضف مكونات الوصفة قبل إنشاء أمر إنتاج.");
    }

    const itemIds = ingredients.map((ingredient) => ingredient.item_id);
    const [{ data: itemRows, error: itemError }, { data: stockRows, error: stockError }] = await Promise.all([
      db.from("inventory_items").select("id,name,average_cost").eq("organization_id", organizationId).in("id", itemIds),
      db
        .from("branch_stock")
        .select("item_id,quantity")
        .eq("organization_id", organizationId)
        .eq("branch_id", parsed.data.sourceBranchId)
        .in("item_id", itemIds),
    ]);

    if (itemError) return invalid(itemError.message);
    if (stockError) return invalid(stockError.message);

    const typedItemRows = (itemRows ?? []) as InventoryItemRow[];
    const typedStockRows = (stockRows ?? []) as BranchStockRow[];
    const itemMap = new Map<string, InventoryItemRow>(typedItemRows.map((item) => [item.id, item]));
    const stockMap = new Map<string, number>(typedStockRows.map((stock) => [stock.item_id, Number(stock.quantity ?? 0)]));
    const servings = Math.max(Number(recipeResult.data.servings ?? 1), 1);
    const plannedMultiplier = parsed.data.plannedQuantity / servings;
    const completedMultiplier = parsed.data.completedQuantity / servings;

    const materialLines: MaterialLine[] = ingredients.map((ingredient) => {
      const item = itemMap.get(ingredient.item_id);
      const unitCost = Number(ingredient.unit_cost ?? item?.average_cost ?? 0);
      const yieldPercent = Math.max(Number(ingredient.yield_percent ?? 100), 1);
      const plannedQuantity = Number(ingredient.quantity ?? 0) * plannedMultiplier / (yieldPercent / 100);
      const issuedQuantity = Number(ingredient.quantity ?? 0) * completedMultiplier / (yieldPercent / 100);
      const availableQuantity = stockMap.get(ingredient.item_id) ?? 0;

      return {
        itemId: ingredient.item_id,
        itemName: item?.name ?? "مادة غير معروفة",
        plannedQuantity,
        issuedQuantity,
        unitCost,
        yieldPercent,
        availableQuantity,
      };
    });

    const shortage = materialLines.find(
      (line) => !parsed.data.allowNegativeStock && line.availableQuantity < line.issuedQuantity,
    );
    if (shortage) {
      return invalid(
        `رصيد ${shortage.itemName} لا يكفي في مستودع الصرف. الرصيد الحالي: ${shortage.availableQuantity.toFixed(3)}`,
      );
    }

    const materialCost = materialLines.reduce((sum: number, line) => sum + line.issuedQuantity * line.unitCost, 0);
    const orderNumber = await nextProductionOrderNumber(admin, organizationId);
    const now = new Date().toISOString();

    const { data: order, error: orderError } = await db
      .from("production_orders")
      .insert({
        organization_id: organizationId,
        branch_id: parsed.data.branchId,
        recipe_id: parsed.data.recipeId,
        order_number: orderNumber,
        status: "completed",
        planned_quantity: parsed.data.plannedQuantity,
        completed_quantity: parsed.data.completedQuantity,
        material_cost: materialCost,
        started_at: now,
        completed_at: now,
        notes: parsed.data.notes || null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (orderError || !order) return invalid(orderError?.message ?? "تعذر إنشاء أمر الإنتاج.");

    const { error: materialsError } = await db.from("production_order_materials").insert(
      materialLines.map((line) => ({
        organization_id: organizationId,
        production_order_id: order.id,
        source_branch_id: parsed.data.sourceBranchId,
        item_id: line.itemId,
        planned_quantity: line.plannedQuantity,
        issued_quantity: line.issuedQuantity,
        unit_cost: line.unitCost,
        yield_percent: line.yieldPercent,
        created_by: userId,
      })),
    );

    if (materialsError) return invalid(materialsError.message);

    for (const line of materialLines) {
      await addToBranchStock(admin, organizationId, parsed.data.sourceBranchId, line.itemId, -line.issuedQuantity, userId);

      const { error: movementError } = await db.from("stock_movements").insert({
        organization_id: organizationId,
        branch_id: parsed.data.sourceBranchId,
        item_id: line.itemId,
        movement_type: "sale_usage",
        quantity: -line.issuedQuantity,
        unit_cost: line.unitCost,
        source_doc_type: "production_order",
        source_doc_id: order.id,
        idempotency_key: `${order.id}:${line.itemId}:production`,
        notes: `صرف مواد لأمر إنتاج ${orderNumber}`,
        created_by: userId,
      });

      if (movementError && !movementError.message.includes("duplicate key")) return invalid(movementError.message);
    }
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ أمر الإنتاج.");
  }

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movements");
  revalidatePath("/dashboard/cost-accounting");

  return ok("تم إنشاء أمر الإنتاج وخصم مواد الوصفة من المخزون.");
}

export async function saveWasteLogAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = wasteLogSchema.safeParse({
    branchId: formData.get("branchId"),
    itemId: formData.get("itemId"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
    notes: formData.get("notes") || "",
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات الهدر غير صحيحة");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن حفظ الهدر في قاعدة البيانات.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("waste");
    requireSensitiveActionCapability(auth, "inventory_movement_write", parsed.data.branchId);
    const [branch, item] = await Promise.all([
      getScopedBranch(admin, organizationId, parsed.data.branchId),
      getScopedInventoryItem(admin, organizationId, parsed.data.itemId),
    ]);

    if (!branch?.id) return invalid("القسم المختار غير موجود في المؤسسة الحالية.");
    if (!item?.id) return invalid("المادة المختارة غير موجودة في المؤسسة الحالية.");

    const unitCost = Number(item.average_cost ?? 0);
    const cost = parsed.data.quantity * unitCost;

    const { data: wasteLog, error: wasteError } = await admin
      .from("waste_logs")
      .insert({
        organization_id: organizationId,
        branch_id: parsed.data.branchId,
        item_id: parsed.data.itemId,
        quantity: parsed.data.quantity,
        reason: parsed.data.reason,
        cost,
        notes: parsed.data.notes || null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (wasteError) return invalid(wasteError.message);

    await addToBranchStock(admin, organizationId, parsed.data.branchId, parsed.data.itemId, -parsed.data.quantity, userId);

    const { error: movementError } = await admin.from("stock_movements").insert({
      organization_id: organizationId,
      branch_id: parsed.data.branchId,
      item_id: parsed.data.itemId,
      movement_type: "waste",
      quantity: -parsed.data.quantity,
      unit_cost: unitCost,
      source_doc_type: "waste_log",
      source_doc_id: wasteLog.id,
      idempotency_key: `${wasteLog.id}:${parsed.data.itemId}`,
      notes: parsed.data.reason,
      created_by: userId,
    });

    if (movementError) return invalid(movementError.message);

    await postInventoryWriteOffJournal(admin, {
      organizationId,
      branchId: parsed.data.branchId,
      sourceDocType: "waste_log",
      sourceDocId: wasteLog.id,
      label: `هدر ${item.name ?? parsed.data.itemId} - ${parsed.data.reason}`,
      totalCost: cost,
      entryDate: todayLocal(),
      createdBy: userId,
    });
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ الهدر في Supabase.");
  }

  revalidatePath("/dashboard/waste");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/stock-movements");
  revalidatePath("/dashboard/accounting/ledger");
  return ok("تم حفظ الهدر وتحديث المخزون.");
}

export async function saveStockCountAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = stockCountSchema.safeParse({
    branchId: formData.get("branchId"),
    notes: formData.get("notes") || "",
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات الجرد غير صحيحة");

  const itemIds = formData.getAll("itemId").map(String);
  const countedQuantities = formData.getAll("countedQuantity").map((value) => Number(value));
  const countedAt = String(formData.get("countedAt") || todayLocal());
  const idempotencyKey = String(formData.get("idempotencyKey") || "");

  if (!itemIds.length) {
    return invalid("لا توجد مواد لاعتماد الجرد.");
  }

  if (countedQuantities.some((quantity) => !Number.isFinite(quantity) || quantity < 0)) {
    return invalid("كميات الجرد يجب أن تكون أرقامًا صحيحة أو عشرية غير سالبة.");
  }
  if (itemIds.length !== countedQuantities.length || itemIds.some((itemId) => !z.string().uuid().safeParse(itemId).success)) {
    return invalid("تطابق مواد الجرد وكمياتها غير صالح.");
  }
  if (new Set(itemIds).size !== itemIds.length) return invalid("لا تكرر المادة نفسها في الجرد.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(countedAt)) return invalid("تاريخ الجرد غير صالح.");
  if (idempotencyKey.length < 8) return invalid("مفتاح منع التكرار غير صالح.");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن حفظ الجرد في قاعدة البيانات.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("inventory");
    requireSensitiveActionCapability(auth, "inventory_movement_write", parsed.data.branchId);
    const branch = await getScopedBranch(admin, organizationId, parsed.data.branchId);
    if (!branch?.id) return invalid("القسم المختار غير موجود في المؤسسة الحالية.");

    const { data: atomicResult, error: atomicError } = await (admin as any).rpc("post_stock_count_atomic", {
      p_organization_id: organizationId,
      p_branch_id: parsed.data.branchId,
      p_counted_at: countedAt,
      p_lines: itemIds.map((itemId, index) => ({ item_id: itemId, counted_quantity: countedQuantities[index] })),
      p_notes: parsed.data.notes || null,
      p_idempotency_key: idempotencyKey,
      p_created_by: userId,
    });
    if (atomicError) return invalid(atomicError.message);
    const atomicResponse = atomicResult as { success?: boolean; duplicate?: boolean } | null;
    if (!atomicResponse?.success) return invalid("تعذر اعتماد الجرد بشكل ذري.");
    revalidatePath("/dashboard/stock-counts");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/stock-movements");
    revalidatePath("/dashboard/reports");
    revalidatePath("/dashboard/accounting/ledger");
    return ok(atomicResponse.duplicate ? "تم اعتماد هذا الجرد مسبقاً (تم تجاهل التكرار)." : "تم اعتماد الجرد وتحديث المخزون والقيد المحاسبي في عملية واحدة.");

    /* Legacy non-atomic implementation retained only in git history. The RPC
       above is the sole approved posting path for stock counts.
    const { data: stockCount, error: countError } = await admin
      .from("stock_counts")
      .insert({
        organization_id: organizationId,
        branch_id: parsed.data.branchId,
        status: "approved",
        counted_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
        notes: parsed.data.notes || null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (countError) return invalid(countError.message);

    let totalFinancialVariance = 0;

    for (let index = 0; index < itemIds.length; index += 1) {
      const itemId = itemIds[index];
      const countedQuantity = countedQuantities[index] ?? 0;
      const item = await getScopedInventoryItem(admin, organizationId, itemId);
      if (!item?.id) continue;

      const { data: stock } = await admin
        .from("branch_stock")
        .select("quantity")
        .eq("organization_id", organizationId)
        .eq("branch_id", parsed.data.branchId)
        .eq("item_id", itemId)
        .maybeSingle();

      const systemQuantity = Number(stock?.quantity ?? 0);
      const variance = countedQuantity - systemQuantity;
      const unitCost = Number(item.average_cost ?? 0);

      totalFinancialVariance += variance * unitCost;

      const { error: itemError } = await admin.from("stock_count_items").insert({
        organization_id: organizationId,
        stock_count_id: stockCount.id,
        item_id: itemId,
        system_quantity: systemQuantity,
        counted_quantity: countedQuantity,
        created_by: userId,
      });

      if (itemError) return invalid(itemError.message);

      if (variance !== 0) {
        await setBranchStockQuantity(admin, organizationId, parsed.data.branchId, itemId, countedQuantity, userId);

        const { error: movementError } = await admin.from("stock_movements").insert({
          organization_id: organizationId,
          branch_id: parsed.data.branchId,
          item_id: itemId,
          movement_type: "stock_count",
          quantity: variance,
          unit_cost: unitCost,
          source_doc_type: "stock_count",
          source_doc_id: stockCount.id,
          idempotency_key: `${stockCount.id}:${itemId}`,
          notes: "تسوية فرق جرد",
          created_by: userId,
        });

        if (movementError) return invalid(movementError.message);
      }
    }

    if (Math.abs(totalFinancialVariance) > 0.01) {
      const [inventoryAcc, varianceAcc] = await Promise.all([
        admin.from("chart_of_accounts").select("id").eq("organization_id", organizationId).eq("system_key", "inventory").maybeSingle(),
        admin.from("chart_of_accounts").select("id").eq("organization_id", organizationId).eq("system_key", "cash_over_short").maybeSingle(),
      ]);

      if (inventoryAcc.data?.id && varianceAcc.data?.id) {
        const absVariance = Math.abs(totalFinancialVariance);
        const entryNumber = await nextJournalEntryNumber(admin, organizationId);
        
        const { data: entry, error: entryError } = await admin
          .from("journal_entries")
          .insert({
            organization_id: organizationId,
            entry_number: entryNumber,
            entry_date: new Date().toISOString().slice(0, 10),
            memo: `تسوية فروقات جرد مخزن - وثيقة رقم ${stockCount.id.slice(0, 8)}`,
            status: "posted",
            source_doc_type: "stock_count",
            source_doc_id: stockCount.id,
            created_by: userId,
          })
          .select("id")
          .single();

        if (!entryError && entry) {
          const lines = [];
          if (totalFinancialVariance < 0) {
            lines.push({
              organization_id: organizationId,
              journal_entry_id: entry.id,
              account_id: varianceAcc.data.id,
              debit: absVariance,
              credit: 0,
              memo: "عجز جرد مخزني",
            });
            lines.push({
              organization_id: organizationId,
              journal_entry_id: entry.id,
              account_id: inventoryAcc.data.id,
              debit: 0,
              credit: absVariance,
              memo: "تخفيض قيمة المخزون بالعجز",
            });
          } else {
            lines.push({
              organization_id: organizationId,
              journal_entry_id: entry.id,
              account_id: inventoryAcc.data.id,
              debit: absVariance,
              credit: 0,
              memo: "زيادة جرد مخزني",
            });
            lines.push({
              organization_id: organizationId,
              journal_entry_id: entry.id,
              account_id: varianceAcc.data.id,
              debit: 0,
              credit: absVariance,
              memo: "تسوية زيادة الجرد",
            });
          }
          await admin.from("journal_lines").insert(lines);
        }
      }
    }
    */
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ الجرد في Supabase.");
  }

  revalidatePath("/dashboard/stock-counts");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movements");
  revalidatePath("/dashboard/reports");
  return ok("تم اعتماد الجرد وتحديث كميات المخزون.");
}

export async function requestDemoAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = demoRequestSchema.safeParse({
    name: formData.get("name"),
    restaurant: formData.get("restaurant"),
    phone: formData.get("phone"),
    email: formData.get("email") || "",
    message: formData.get("message") || "",
  });

  if (!parsed.success) return invalid("تحقق من بيانات طلب العرض");

  return ok("وصلنا طلبك. سنرتب عرضًا تجريبيًا مناسبًا لفريقك.");
}





const catalogItemSchema = z.object({
  name: z.string().min(2, "اسم الصنف مطلوب"),
  code: z.string().min(2, "كود الصنف مطلوب"),
  categoryName: z.string().min(1, "اختر الفئة أو اكتبها"),
  mainUnit: z.string().min(1, "الوحدة الأساسية مطلوبة"),
  retailPrice: z.coerce.number().nonnegative("سعر التجزئة يجب ألا يكون سالبًا"),
  taxRate: z.coerce.number().nonnegative("نسبة الضريبة يجب ألا تكون سالبة"),
  barcode: z.string().optional(),
});

const invoiceSchema = z.object({
  supplierId: z.string().uuid("اختر المورد"),
  branchId: z.string().uuid("اختر القسم"),
  invoiceNumber: z.string().min(1, "رقم الفاتورة مطلوب"),
  issuedAt: z.string().min(1, "التاريخ مطلوب"),
  itemId: z.string().uuid("اختر الصنف"),
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  unitPrice: z.coerce.number().positive("السعر يجب أن يكون أكبر من صفر"),
  expiryDate: z.string().optional(),
  dueDate: z.string().optional(),
  paymentMethod: z.string().optional(),
  purchaseOrderId: z.string().optional(),
  idempotencyKey: z.string().min(8, "مفتاح منع التكرار غير صالح"),
});

const transferSchema = z.object({
  fromBranchId: z.string().uuid("اختر القسم المرسل"),
  toBranchId: z.string().uuid("اختر القسم المستقبل"),
  lines: z.array(z.object({
    itemId: z.string().uuid("اختر المادة"),
    quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
    sourceWarehouse: z.enum(["general", "kitchen"]).default("general"),
    sourceLocation: z.string().optional(),
    destinationWarehouse: z.enum(["general", "kitchen"]).default("general"),
    destinationLocation: z.string().optional(),
    batchNumber: z.string().optional(),
    expiryDate: z.string().optional(),
  })).min(1, "أضف مادة واحدة على الأقل"),
  notes: z.string().optional(),
  idempotencyKey: z.string().min(8, "مفتاح منع التكرار غير صالح"),
});

const returnSchema = z.object({
  branchId: z.string().uuid("اختر القسم"),
  itemId: z.string().uuid("اختر المادة"),
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  notes: z.string().min(2, "السبب مطلوب"),
});

const branchSchema = z.object({
  name: z.string().min(2, "اسم القسم مطلوب"),
});

// New Server Actions
export async function saveCatalogItemAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = catalogItemSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    categoryName: formData.get("categoryName"),
    mainUnit: formData.get("mainUnit"),
    retailPrice: formData.get("retailPrice"),
    taxRate: formData.get("taxRate"),
    barcode: formData.get("barcode") || undefined,
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات الصنف غير صحيحة");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن حفظ الصنف في قاعدة البيانات.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("inventory");
    requireSensitiveActionCapability(auth, "inventory_catalog_write");

    const { data: createdItem, error: itemError } = await admin
      .from("catalog_items")
      .insert({
        organization_id: organizationId,
        name: parsed.data.name,
        code: parsed.data.code,
        category_name: parsed.data.categoryName,
        main_unit: parsed.data.mainUnit,
        retail_price: parsed.data.retailPrice,
        wholesale_price: parsed.data.retailPrice,
        tax_rate: parsed.data.taxRate,
        status: "active",
        created_by: userId,
      })
      .select("id")
      .single();

    if (itemError) return invalid(itemError.message);

    if (parsed.data.barcode) {
      const { error: barcodeError } = await admin
        .from("item_barcodes")
        .insert({
          organization_id: organizationId,
          catalog_item_id: createdItem.id,
          barcode: parsed.data.barcode,
          unit_name: parsed.data.mainUnit,
          unit_factor: 1,
          is_primary: true,
          created_by: userId,
        });

      if (barcodeError) return invalid(barcodeError.message);
    }
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ الصنف في Supabase.");
  }

  revalidatePath("/dashboard/items");
  return ok("تم حفظ الصنف في الكتالوج بنجاح.");
}


export async function saveInvoiceAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = invoiceSchema.safeParse({
    supplierId: formData.get("supplierId"),
    branchId: formData.get("branchId"),
    invoiceNumber: formData.get("invoiceNumber"),
    issuedAt: formData.get("issuedAt"),
    itemId: formData.get("itemId"),
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
    expiryDate: formData.get("expiryDate") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    paymentMethod: formData.get("paymentMethod") || undefined,
    purchaseOrderId: formData.get("purchaseOrderId") || undefined,
    idempotencyKey: formData.get("idempotencyKey"),
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات الفاتورة غير صحيحة");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("purchasing");
    requireSensitiveActionCapability(auth, "purchasing_write", parsed.data.branchId);

    const [supplier, branch, item] = await Promise.all([
      admin.from("suppliers").select("id").eq("id", parsed.data.supplierId).eq("organization_id", organizationId).maybeSingle(),
      admin.from("branches").select("id").eq("id", parsed.data.branchId).eq("organization_id", organizationId).maybeSingle(),
      admin.from("inventory_items").select("id, average_cost").eq("id", parsed.data.itemId).eq("organization_id", organizationId).maybeSingle(),
    ]);

    if (!supplier.data?.id) return invalid("المورد غير موجود.");
    if (!branch.data?.id) return invalid("القسم غير موجود.");
    if (!item.data?.id) return invalid("المادة غير موجودة.");

    const dueDate = parsed.data.dueDate || addDaysLocal(parsed.data.issuedAt, 30);
    const { data: invoiceResult, error: invoiceError } = await admin.rpc("create_supplier_invoice_atomic", {
      p_organization_id: organizationId,
      p_supplier_id: parsed.data.supplierId,
      p_branch_id: parsed.data.branchId,
      p_invoice_number: parsed.data.invoiceNumber,
      p_issued_at: parsed.data.issuedAt,
      p_due_date: dueDate,
      p_item_id: parsed.data.itemId,
      p_quantity: parsed.data.quantity,
      p_unit_price: parsed.data.unitPrice,
      p_purchase_order_id: parsed.data.purchaseOrderId || null,
      p_payment_method: parsed.data.paymentMethod || null,
      p_expiry_date: parsed.data.expiryDate || null,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_created_by: userId,
    });

    if (invoiceError) return invalid(invoiceError.message);
    const response = invoiceResult as { success?: boolean; duplicate?: boolean } | null;
    if (!response?.success) return invalid("تعذر حفظ فاتورة المورد وترحيلها.");
    if (response.duplicate) return ok("تم حفظ الفاتورة مسبقاً (تم تجاهل التكرار).");
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ الفاتورة في Supabase.");
  }

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movements");
  revalidatePath("/dashboard/accounting/ledger");
  revalidatePath("/dashboard/reports");
  return ok("تم حفظ فاتورة التوريد بنجاح.");
}

const supplierPaymentSchema = z.object({
  invoiceId: z.string().uuid("اختر الفاتورة"),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  paymentMethod: z.string().min(1, "طريقة الدفع مطلوبة"),
  paymentDate: z.string().min(1, "تاريخ الدفع مطلوب"),
  reference: z.string().optional(),
  idempotencyKey: z.string().min(8, "مفتاح منع التكرار غير صالح"),
});

export async function paySupplierInvoiceAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = supplierPaymentSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    amount: formData.get("amount"),
    paymentMethod: formData.get("paymentMethod"),
    paymentDate: formData.get("paymentDate"),
    reference: formData.get("reference") || undefined,
    idempotencyKey: formData.get("idempotencyKey"),
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات الدفع غير صحيحة");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("purchasing");
    requireSensitiveActionCapability(auth, "purchasing_write");

    const { data: invoice, error: invoiceError } = await admin
      .from("invoices")
      .select("id, invoice_number, supplier_id, branch_id, total, paid_amount, balance_due, status")
      .eq("id", parsed.data.invoiceId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (invoiceError) return invalid(invoiceError.message);
    if (!invoice) return invalid("الفاتورة غير موجودة.");

    const balanceDue = Number(invoice.balance_due ?? invoice.total ?? 0);
    const amount = Math.round(parsed.data.amount * 100) / 100;
    if (amount > balanceDue + 0.001) {
      return invalid(`المبلغ أكبر من الرصيد المستحق (${balanceDue}).`);
    }

    requireSensitiveActionCapability(auth, "purchasing_write", invoice.branch_id);

    const { data: paymentResult, error: paymentError } = await admin.rpc("record_supplier_payment_atomic", {
      p_organization_id: organizationId,
      p_invoice_id: invoice.id,
      p_amount: amount,
      p_payment_method: parsed.data.paymentMethod,
      p_payment_date: parsed.data.paymentDate,
      p_reference: parsed.data.reference ?? null,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_created_by: userId,
    });

    if (paymentError) return invalid(paymentError.message);

    const result = paymentResult as { success?: boolean } | null;
    if (!result?.success) return invalid("تعذر تسجيل دفعة المورد محاسبياً.");
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر تسجيل دفعة المورد في Supabase.");
  }

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/bill-payments");
  revalidatePath("/dashboard/accounting/ledger");
  revalidatePath("/dashboard/suppliers");
  return ok("تم تسجيل دفعة المورد وتحديث الرصيد المستحق.");
}

export async function saveTransferAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let lines: unknown = [];
  try {
    lines = JSON.parse(String(formData.get("linesJson") || "[]"));
  } catch {
    return invalid("بنود التحويل غير صالحة.");
  }
  const parsed = transferSchema.safeParse({
    fromBranchId: formData.get("fromBranchId"),
    toBranchId: formData.get("toBranchId"),
    lines,
    notes: formData.get("notes") || undefined,
    idempotencyKey: formData.get("idempotencyKey"),
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات التحويل غير صحيحة");

  if (parsed.data.fromBranchId === parsed.data.toBranchId) {
    return invalid("لا يمكن التحويل لنفس القسم.");
  }

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("transfers");
    requireSensitiveActionCapability(auth, "inventory_movement_write", parsed.data.fromBranchId);
    const { data, error } = await (admin as any).rpc("create_inventory_transfer_atomic", {
      p_organization_id: organizationId,
      p_from_branch_id: parsed.data.fromBranchId,
      p_to_branch_id: parsed.data.toBranchId,
      p_lines: parsed.data.lines.map((line) => ({
        item_id: line.itemId,
        quantity: line.quantity,
        source_warehouse: line.sourceWarehouse,
        source_location: line.sourceLocation || null,
        destination_warehouse: line.destinationWarehouse,
        destination_location: line.destinationLocation || null,
        batch_number: line.batchNumber || null,
        expiry_date: line.expiryDate || null,
      })),
      p_notes: parsed.data.notes || null,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_actor_user_id: userId,
    });
    if (error) return invalid(error.message);
    if (!(data as { success?: boolean } | null)?.success) return invalid("تعذر إنشاء التحويل.");

  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ التحويل في Supabase.");
  }

  revalidatePath("/dashboard/transfers");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movements");
  revalidatePath("/dashboard/reports");
  return ok("حُفظت مسودة التحويل دون تحريك المخزون.");
}

const transferTransitionSchema = z.object({
  transferId: z.string().uuid("التحويل غير صالح"),
  transition: z.enum(["submit", "approve", "ship", "cancel", "close"]),
  reason: z.string().optional(),
});

export async function transitionTransferAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = transferTransitionSchema.safeParse({
    transferId: formData.get("transferId"),
    transition: formData.get("transition"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "إجراء التحويل غير صالح");
  if (!hasSupabaseAdminEnv()) return invalid("مفتاح Supabase الإداري غير موجود.");
  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("transfers");
    requireSensitiveActionCapability(auth, "inventory_movement_write");
    const { data, error } = await (admin as any).rpc("transition_inventory_transfer_atomic", {
      p_organization_id: organizationId,
      p_transfer_id: parsed.data.transferId,
      p_action: parsed.data.transition,
      p_reason: parsed.data.reason || null,
      p_actor_user_id: userId,
    });
    if (error) return invalid(error.message);
    if (!(data as { success?: boolean } | null)?.success) return invalid("تعذر تحديث التحويل.");
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر تحديث التحويل.");
  }
  revalidatePath("/dashboard/transfers");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movements");
  return ok("تم تحديث مرحلة التحويل بنجاح.");
}

export async function receiveTransferAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const transferId = String(formData.get("transferId") || "");
  if (!z.string().uuid().safeParse(transferId).success) return invalid("التحويل غير صالح.");
  let lines: unknown;
  try { lines = JSON.parse(String(formData.get("linesJson") || "[]")); }
  catch { return invalid("بيانات الاستلام غير صالحة."); }
  const parsedLines = z.array(z.object({
    transferItemId: z.string().uuid(),
    receivedQuantity: z.coerce.number().nonnegative(),
    varianceReason: z.string().optional(),
  })).min(1).safeParse(lines);
  if (!parsedLines.success) return invalid("بيانات الاستلام غير صالحة.");
  if (!hasSupabaseAdminEnv()) return invalid("مفتاح Supabase الإداري غير موجود.");
  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("transfers");
    requireSensitiveActionCapability(auth, "inventory_movement_write");
    const { data, error } = await (admin as any).rpc("receive_inventory_transfer_atomic", {
      p_organization_id: organizationId,
      p_transfer_id: transferId,
      p_lines: parsedLines.data.map((line) => ({
        transfer_item_id: line.transferItemId,
        received_quantity: line.receivedQuantity,
        variance_reason: line.varianceReason || null,
      })),
      p_actor_user_id: userId,
    });
    if (error) return invalid(error.message);
    if (!(data as { success?: boolean } | null)?.success) return invalid("تعذر استلام التحويل.");
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر استلام التحويل.");
  }
  revalidatePath("/dashboard/transfers");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movements");
  return ok("سُجل الاستلام ولم يدخل إلى المخزون إلا المقدار المستلم فعليًا.");
}

export async function saveReturnAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = returnSchema.safeParse({
    branchId: formData.get("branchId"),
    itemId: formData.get("itemId"),
    quantity: formData.get("quantity"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات المرتجع غير صحيحة");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("inventory");
    requireSensitiveActionCapability(auth, "inventory_movement_write", parsed.data.branchId);

    const [branch, item] = await Promise.all([
      admin.from("branches").select("id").eq("id", parsed.data.branchId).eq("organization_id", organizationId).maybeSingle(),
      admin.from("inventory_items").select("id, name, average_cost").eq("id", parsed.data.itemId).eq("organization_id", organizationId).maybeSingle(),
    ]);

    if (!branch.data?.id) return invalid("القسم غير موجود.");
    if (!item.data?.id) return invalid("المادة غير موجودة.");

    const unitCost = Number(item.data.average_cost ?? 0);

    const { data: stockRow } = await admin
      .from("branch_stock")
      .select("quantity")
      .eq("organization_id", organizationId)
      .eq("branch_id", parsed.data.branchId)
      .eq("item_id", parsed.data.itemId)
      .maybeSingle();

    const currentStock = Number(stockRow?.quantity ?? 0);
    if (currentStock < parsed.data.quantity) {
      return invalid(`رصيد المادة لا يكفي في القسم المختار. الرصيد الحالي: ${currentStock}`);
    }

    await addToBranchStock(admin, organizationId, parsed.data.branchId, parsed.data.itemId, -parsed.data.quantity, userId);

    const { error: movementError } = await admin.from("stock_movements").insert({
      organization_id: organizationId,
      branch_id: parsed.data.branchId,
      item_id: parsed.data.itemId,
      movement_type: "return",
      quantity: -parsed.data.quantity,
      unit_cost: unitCost,
      notes: parsed.data.notes || "مرتجع مخزن",
      created_by: userId,
    });

    if (movementError) return invalid(movementError.message);

  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ المرتجع في Supabase.");
  }

  revalidatePath("/dashboard/sales-returns");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movements");
  revalidatePath("/dashboard/reports");
  return ok("تم تسجيل مرتجع المخزن وتحديث المخزون بنجاح.");
}

export async function saveBranchAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = branchSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "اسم القسم غير صحيح");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("administration");
    requireSensitiveActionCapability(auth, "branch_write");

    const { error } = await admin.from("branches").insert({
      organization_id: organizationId,
      name: parsed.data.name,
      status: "active",
      created_by: userId,
    });

    if (error) return invalid(error.message);
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ القسم.");
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/purchase-orders");
  revalidatePath("/dashboard/transfers");
  revalidatePath("/dashboard/waste");
  revalidatePath("/dashboard/sales-returns");
  revalidatePath("/dashboard/reports");
  return ok("تم حفظ القسم بنجاح.");
}

export async function closeSalesShiftAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = closeShiftSchema.safeParse({
    shiftId: formData.get("shiftId"),
    actualCash: formData.get("actualCash"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return invalid(parsed.error.issues[0]?.message ?? "بيانات إغلاق الوردية غير صحيحة");
  }

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("shifts");
    requireSensitiveActionCapability(auth, "shift_close");
    const { data: shift, error: shiftError } = await (admin as any)
      .from("sales_shifts")
      .select("*")
      .eq("id", parsed.data.shiftId)
      .eq("organization_id", organizationId)
      .single();

    if (shiftError || !shift) {
      return invalid(shiftError?.message ?? "لم يتم العثور على الوردية.");
    }
    requireSensitiveActionCapability(auth, "shift_close", shift.branch_id);

    if (shift.status === "closed") {
      return invalid("هذه الوردية مغلقة مسبقاً.");
    }

    const expectedCash = Number(shift.expected_cash ?? 0);
    const actualCash = parsed.data.actualCash;
    const difference = actualCash - expectedCash;

    const { error: updateError } = await (admin as any)
      .from("sales_shifts")
      .update({
        actual_cash: actualCash,
        difference,
        status: "closed",
        closed_at: new Date().toISOString(),
        closed_by: userId,
        notes: parsed.data.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shift.id)
      .eq("organization_id", organizationId);

    if (updateError) {
      return invalid(updateError.message);
    }

    await addCashDrawerEntry(admin, {
      organizationId,
      branchId: shift.branch_id,
      shiftId: shift.id,
      entryType: "closing_adjustment",
      amount: difference,
      memo: parsed.data.notes || "إغلاق وردية الكاشير",
      createdBy: userId,
    });

    await postCashVarianceJournal(admin, {
      organizationId,
      branchId: shift.branch_id,
      shiftId: shift.id,
      shiftLabel: shift.cashier_name ?? shift.id,
      difference,
      entryDate: todayLocal(),
      createdBy: userId,
    });

    await logAuditEvent({
      organizationId,
      branchId: shift.branch_id,
      userId,
      action: "close_shift",
      entityType: "sales_shift",
      entityId: shift.id,
      oldData: { expectedCash: shift.expected_cash, status: shift.status },
      newData: { actualCash, difference, status: "closed" },
    });
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر إغلاق الوردية.");
  }

  revalidatePath("/dashboard/shifts");
  revalidatePath("/dashboard/accounting/ledger");
  return ok("تم إغلاق الوردية وتسجيل فرق الصندوق محاسبياً.");
}

async function nextJournalEntryNumber(admin: ReturnType<typeof createAdminClient>, organizationId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const compactDate = today.replaceAll("-", "");
  const { count, error } = await (admin as any)
    .from("journal_entries")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", `${today}T00:00:00.000Z`)
    .lt("created_at", `${today}T23:59:59.999Z`);

  if (error) throw new Error(error.message);

  return `JV-${compactDate}-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export async function saveJournalEntryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const entryDate = String(formData.get("entryDate") ?? "");
  const memo = String(formData.get("memo") ?? "");
  const reference = String(formData.get("reference") ?? "").trim();
  const branchId = String(formData.get("branchId") ?? "").trim();
  const linesJson = String(formData.get("lines") ?? "[]");

  if (!entryDate) return invalid("التاريخ مطلوب");
  if (!memo) return invalid("البيان مطلوب");

  let lines: any[] = [];
  try {
    lines = JSON.parse(linesJson);
  } catch {
    return invalid("صيغة خطوط القيد المحاسبي غير صالحة.");
  }

  if (!Array.isArray(lines) || lines.length < 2) {
    return invalid("القيد المحاسبي يجب أن يحتوي على سطرين (مدين ودائن) على الأقل.");
  }

  let debitSum = 0;
  let creditSum = 0;

  for (const line of lines) {
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);
    if (!line.accountId) return invalid("يجب تحديد حساب لكل سطر.");
    if (debit < 0 || credit < 0) return invalid("المبالغ لا يمكن أن تكون سالبة.");
    if (debit > 0 && credit > 0) return invalid("لا يمكن إدخال مبلغ مدين ودائن في نفس السطر.");
    if (debit === 0 && credit === 0) return invalid("يجب إدخال مبلغ مدين أو دائن في السطر.");
    debitSum += debit;
    creditSum += credit;
  }

  if (Math.abs(debitSum - creditSum) > 0.01) {
    return invalid(`القيد المحاسبي غير متزن. إجمالي المدين (${debitSum.toFixed(2)}) لا يساوي إجمالي الدائن (${creditSum.toFixed(2)}).`);
  }

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود.");
  }

  try {
    const { admin, organizationId, userId, auth } = await resolveMutationScope("accounting");
    requireSensitiveActionCapability(auth, "accounting_write");

    // Closed accounting periods reject new entries (also enforced by DB trigger).
    const { data: periodClosed } = await (admin as any).rpc("is_accounting_period_closed", {
      target_org_id: organizationId,
      target_date: entryDate,
    });
    if (periodClosed === true) {
      return invalid("هذه الفترة المحاسبية مقفلة. أعد فتحها من صفحة الإقفال الشهري قبل تسجيل قيود فيها.");
    }

    const entryNumber = await nextJournalEntryNumber(admin, organizationId);

    const { data: entry, error: entryError } = await (admin as any)
      .from("journal_entries")
      .insert({
        organization_id: organizationId,
        branch_id: branchId || null,
        entry_number: entryNumber,
        entry_date: entryDate,
        memo: reference ? `${memo} (مرجع: ${reference})` : memo,
        // Start as draft; only mark posted after the lines are confirmed.
        // We never delete a financial record to recover from a failure.
        status: "draft",
        created_by: userId,
      })
      .select("id")
      .single();

    if (entryError || !entry) return invalid(entryError?.message ?? "تعذر إنشاء القيد المحاسبي.");

    const { error: linesError } = await (admin as any).from("journal_lines").insert(
      lines.map((line) => ({
        organization_id: organizationId,
        journal_entry_id: entry.id,
        account_id: line.accountId,
        branch_id: branchId || null,
        cost_center_id: line.costCenterId || null,
        debit: Number(line.debit ?? 0),
        credit: Number(line.credit ?? 0),
        memo: line.memo || null,
      }))
    );

    if (linesError) {
      // Do NOT delete the header — destroying financial records is forbidden.
      // Leave the draft entry; it is excluded from all posted-only reports.
      return invalid(linesError.message);
    }

    const { error: postError } = await (admin as any)
      .from("journal_entries")
      .update({ status: "posted" })
      .eq("id", entry.id)
      .eq("organization_id", organizationId);

    if (postError) return invalid(postError.message);

  } catch (error) {
    return invalid(error instanceof Error ? error.message : "حدث خطأ أثناء حفظ القيد المحاسبي.");
  }

  revalidatePath("/dashboard/accounting/ledger");
  return ok("تم حفظ القيد المحاسبي بنجاح.");
}
