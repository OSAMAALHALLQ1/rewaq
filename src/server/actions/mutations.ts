"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  demoRequestSchema,
  inventoryItemSchema,
  menuItemSchema,
  purchaseOrderSchema,
  recipeSchema,
  supplierSchema,
} from "@/lib/validation/schemas";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { demoOrganization } from "@/lib/demo-data";
import type { Json, Tables } from "@/types/database";
import type { ActionState } from "./auth";

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
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "delivery_app"]).default("cash"),
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
  branchId: z.string().uuid("اختر الفرع"),
  itemId: z.string().uuid("اختر المادة"),
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  reason: z.enum(["تلف", "انتهاء صلاحية", "خطأ تحضير", "كسر/انسكاب", "إرجاع", "سبب آخر"]),
  notes: z.string().optional(),
});

const stockCountSchema = z.object({
  branchId: z.string().uuid("اختر الفرع"),
  notes: z.string().optional(),
});

const catalogItemSchema = z.object({
  code: z.string().min(1, "كود الصنف مطلوب"),
  name: z.string().min(2, "اسم الصنف مطلوب"),
  categoryName: z.string().optional(),
  mainUnit: z.string().min(1, "الوحدة مطلوبة"),
  retailPrice: z.coerce.number().nonnegative("سعر البيع غير صحيح"),
  wholesalePrice: z.coerce.number().nonnegative("سعر الجملة غير صحيح").default(0),
  taxRate: z.coerce.number().nonnegative().default(0),
  inventoryItemId: z.string().uuid().optional(),
  barcode: z.string().optional(),
  branchId: z.string().uuid().optional(),
});

const barcodeSchema = z.object({
  catalogItemId: z.string().uuid("اختر الصنف"),
  barcode: z.string().min(1, "الباركود مطلوب"),
  unitName: z.string().min(1, "اسم الوحدة مطلوب"),
  unitFactor: z.coerce.number().positive("معامل الوحدة يجب أن يكون أكبر من صفر").default(1),
  isPrimary: z.boolean().default(false),
});

const salesReturnSchema = z.object({
  invoiceId: z.string().uuid("اختر الفاتورة"),
  reason: z.string().min(2, "سبب المرتجع مطلوب"),
  notes: z.string().optional(),
});

const openShiftSchema = z.object({
  branchId: z.string().uuid("اختر الفرع"),
  cashierName: z.string().min(2, "اسم الكاشير مطلوب"),
  openingCash: z.coerce.number().nonnegative("الرصيد الافتتاحي غير صحيح").default(0),
});

const closeShiftSchema = z.object({
  shiftId: z.string().uuid("الوردية غير معروفة"),
  actualCash: z.coerce.number().nonnegative("قيمة الصندوق غير صحيحة"),
  notes: z.string().optional(),
});

const recipeIngredientFormSchema = z.object({
  recipeId: z.string().uuid("الوصفة غير معروفة"),
  itemId: z.string().uuid("اختر المكون"),
  quantityGrams: z.coerce.number().positive("كمية المكون بالغرام مطلوبة"),
  yieldPercent: z.coerce.number().positive().max(100).default(100),
});

async function getCurrentUserId() {
  if (!hasSupabaseEnv()) {
    return null;
  }

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    return data?.claims?.sub ? String(data.claims.sub) : null;
  } catch {
    return null;
  }
}

async function resolveMutationScope() {
  const admin = createAdminClient();
  const userId = await getCurrentUserId();

  if (userId) {
    const { data: membership } = await admin
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membership?.organization_id) {
      return { admin, organizationId: membership.organization_id, userId };
    }
  }

  const { data: demoOrg } = await admin
    .from("organizations")
    .select("id")
    .eq("id", demoOrganization.id)
    .maybeSingle();

  if (demoOrg?.id) {
    return { admin, organizationId: demoOrg.id, userId };
  }

  const { data: firstOrg } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstOrg?.id) {
    throw new Error("لا توجد مؤسسة في قاعدة البيانات لحفظ المادة داخلها.");
  }

  return { admin, organizationId: firstOrg.id, userId };
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

async function getScopedCatalogItem(admin: ReturnType<typeof createAdminClient>, organizationId: string, catalogItemId: string) {
  const { data, error } = await admin
    .from("catalog_items")
    .select("*")
    .eq("id", catalogItemId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
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

function unitCostForIngredientUnit(averageCost: number, ingredientUnit: string, usageUnit: string | null | undefined) {
  const oneIngredientUnitInUsageUnit = convertQuantity(1, ingredientUnit, usageUnit);
  return averageCost * oneIngredientUnitInUsageUnit;
}

async function recalculateRecipeCosts(admin: ReturnType<typeof createAdminClient>, organizationId: string, recipeId: string) {
  const [{ data: recipe, error: recipeError }, { data: ingredients, error: ingredientsError }] = await Promise.all([
    admin.from("recipes").select("servings").eq("id", recipeId).eq("organization_id", organizationId).maybeSingle(),
    admin.from("recipe_ingredients").select("quantity,unit_cost,yield_percent").eq("recipe_id", recipeId).eq("organization_id", organizationId),
  ]);

  if (recipeError) throw new Error(recipeError.message);
  if (ingredientsError) throw new Error(ingredientsError.message);

  const totalCost = (ingredients ?? []).reduce((sum, ingredient) => {
    const yieldFactor = Math.max(Number(ingredient.yield_percent ?? 100), 0.0001) / 100;
    return sum + (Number(ingredient.quantity ?? 0) * Number(ingredient.unit_cost ?? 0)) / yieldFactor;
  }, 0);
  const servings = Math.max(Number(recipe?.servings ?? 1), 1);

  const { error } = await admin
    .from("recipes")
    .update({
      total_cost: totalCost,
      cost_per_serving: totalCost / servings,
    })
    .eq("id", recipeId)
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);
}

async function nextDocumentNumber(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  prefix: "فاتورة" | "مرتجع",
) {
  const today = new Date().toISOString().slice(0, 10);
  const compactDate = today.replaceAll("-", "");
  const { count, error } = await admin
    .from("customer_invoices")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("issued_at", `${today}T00:00:00.000Z`)
    .lt("issued_at", `${today}T23:59:59.999Z`);

  if (error) throw new Error(error.message);

  return `${prefix}-${compactDate}-${String((count ?? 0) + 1).padStart(4, "0")}`;
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
    const { admin, organizationId, userId } = await resolveMutationScope();
    const branch = await getScopedBranch(admin, organizationId, parsed.data.branchId);
    if (!branch?.id) return invalid("الفرع المختار غير موجود في المؤسسة الحالية.");

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
    const invoiceNumber = await nextDocumentNumber(admin, organizationId, "فاتورة");

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

    const { error: paymentError } = await admin.from("customer_invoice_payments").insert({
      organization_id: organizationId,
      customer_invoice_id: invoice.id,
      payment_method: parsed.data.paymentMethod,
      amount: total,
      created_by: userId,
    });

    if (paymentError) return invalid(paymentError.message);

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
    purchaseUnit: formData.get("purchaseUnit"),
    usageUnit: formData.get("usageUnit"),
    lastPurchasePrice: formData.get("lastPurchasePrice"),
    averageCost: formData.get("averageCost"),
    minimumQuantity: formData.get("minimumQuantity"),
    primarySupplierId: formData.get("primarySupplierId") || undefined,
    sku: formData.get("sku") || undefined,
    notes: formData.get("notes") || undefined,
    isActive: formData.get("isActive") !== "false",
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات المادة غير صحيحة");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن حفظ مادة المخزون في قاعدة البيانات.");
  }

  try {
    const { admin, organizationId, userId } = await resolveMutationScope();

    const [{ data: category }, supplierResult] = await Promise.all([
      admin
        .from("inventory_categories")
        .select("id")
        .eq("id", parsed.data.categoryId)
        .eq("organization_id", organizationId)
        .maybeSingle(),
      parsed.data.primarySupplierId
        ? admin
            .from("suppliers")
            .select("id")
            .eq("id", parsed.data.primarySupplierId)
            .eq("organization_id", organizationId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (!category?.id) {
      return invalid("الفئة المختارة غير موجودة في المؤسسة الحالية.");
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
      category_id: parsed.data.categoryId,
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
    const { admin, organizationId, userId } = await resolveMutationScope();
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

export async function savePurchaseOrderAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = purchaseOrderSchema.safeParse({
    supplierId: formData.get("supplierId"),
    branchId: formData.get("branchId"),
    status: formData.get("status") || "draft",
    orderDate: formData.get("orderDate"),
    notes: formData.get("notes") || "",
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات طلب الشراء غير صحيحة");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن حفظ طلب الشراء في قاعدة البيانات.");
  }

  try {
    const { admin, organizationId, userId } = await resolveMutationScope();
    const [branch, supplierResult] = await Promise.all([
      getScopedBranch(admin, organizationId, parsed.data.branchId),
      admin
        .from("suppliers")
        .select("id")
        .eq("id", parsed.data.supplierId)
        .eq("organization_id", organizationId)
        .maybeSingle(),
    ]);

    if (!branch?.id) {
      return invalid("الفرع المختار غير موجود في المؤسسة الحالية.");
    }

    if (supplierResult.error) {
      return invalid(supplierResult.error.message);
    }

    if (!supplierResult.data?.id) {
      return invalid("المورد المختار غير موجود في المؤسسة الحالية.");
    }

    const { error } = await admin.from("purchase_orders").insert({
      organization_id: organizationId,
      supplier_id: parsed.data.supplierId,
      branch_id: parsed.data.branchId,
      status: parsed.data.status,
      order_date: parsed.data.orderDate,
      notes: parsed.data.notes || null,
      created_by: userId,
    });

    if (error) {
      return invalid(error.message);
    }
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ طلب الشراء في Supabase.");
  }

  revalidatePath("/dashboard/purchase-orders");
  return ok("تم حفظ طلب الشراء في Supabase.");
}

export async function receivePurchaseOrderAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  if (!purchaseOrderId) return invalid("طلب الشراء غير معروف");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن استلام طلب الشراء.");
  }

  try {
    const { admin, organizationId, userId } = await resolveMutationScope();
    const { data: order, error: orderError } = await admin
      .from("purchase_orders")
      .select("*")
      .eq("id", purchaseOrderId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (orderError) return invalid(orderError.message);
    if (!order) return invalid("طلب الشراء غير موجود في المؤسسة الحالية.");

    const { data: orderItems, error: itemsError } = await admin
      .from("purchase_order_items")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("purchase_order_id", purchaseOrderId);

    if (itemsError) return invalid(itemsError.message);

    for (const item of orderItems ?? []) {
      const quantity = Number(item.quantity ?? 0);
      const unitCost = Number(item.expected_unit_price ?? 0);
      if (quantity <= 0) continue;

      await addToBranchStock(admin, organizationId, order.branch_id, item.item_id, quantity, userId);

      const { error: movementError } = await admin.from("stock_movements").insert({
        organization_id: organizationId,
        branch_id: order.branch_id,
        item_id: item.item_id,
        movement_type: "purchase",
        quantity,
        unit_cost: unitCost,
        source_doc_type: "purchase_order",
        source_doc_id: purchaseOrderId,
        idempotency_key: `${purchaseOrderId}:${item.item_id}:receive`,
        notes: "استلام طلب شراء",
        created_by: userId,
      });

      if (movementError && !movementError.message.includes("duplicate key")) {
        return invalid(movementError.message);
      }

      await admin
        .from("purchase_order_items")
        .update({ received_quantity: quantity })
        .eq("id", item.id);

      await admin.from("supplier_price_history").insert({
        organization_id: organizationId,
        supplier_id: order.supplier_id,
        item_id: item.item_id,
        unit_price: unitCost,
        source_doc_type: "purchase_order",
        source_doc_id: purchaseOrderId,
        created_by: userId,
      });
    }

    const { error: updateError } = await admin
      .from("purchase_orders")
      .update({
        status: "received",
      })
      .eq("id", purchaseOrderId)
      .eq("organization_id", organizationId);

    if (updateError) return invalid(updateError.message);
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر استلام طلب الشراء في Supabase.");
  }

  revalidatePath("/dashboard/purchase-orders");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movements");
  return ok("تم استلام طلب الشراء وتحديث المخزون.");
}

export async function receivePurchaseOrderFormAction(formData: FormData): Promise<void> {
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  if (!purchaseOrderId) return;

  await receivePurchaseOrderAction({ ok: false, message: "" }, formData);
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
    const { admin, organizationId, userId } = await resolveMutationScope();
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
    const { admin, organizationId, userId } = await resolveMutationScope();
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
    if (parsed.data.branchId && !branch?.id) return invalid("الفرع المختار غير موجود في المؤسسة الحالية.");

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
    const { admin, organizationId, userId } = await resolveMutationScope();
    const [branch, item] = await Promise.all([
      getScopedBranch(admin, organizationId, parsed.data.branchId),
      getScopedInventoryItem(admin, organizationId, parsed.data.itemId),
    ]);

    if (!branch?.id) return invalid("الفرع المختار غير موجود في المؤسسة الحالية.");
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
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ الهدر في Supabase.");
  }

  revalidatePath("/dashboard/waste");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/stock-movements");
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

  if (!itemIds.length) {
    return invalid("لا توجد مواد لاعتماد الجرد.");
  }

  if (countedQuantities.some((quantity) => !Number.isFinite(quantity) || quantity < 0)) {
    return invalid("كميات الجرد يجب أن تكون أرقامًا صحيحة أو عشرية غير سالبة.");
  }

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن حفظ الجرد في قاعدة البيانات.");
  }

  try {
    const { admin, organizationId, userId } = await resolveMutationScope();
    const branch = await getScopedBranch(admin, organizationId, parsed.data.branchId);
    if (!branch?.id) return invalid("الفرع المختار غير موجود في المؤسسة الحالية.");

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
