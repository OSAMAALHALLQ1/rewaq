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
  supplyInvoiceSchema,
  salesReturnSchema,
} from "@/lib/validation/schemas";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createAdminClient, createAdminClientWithContext, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  postCashVarianceJournal,
  postCustomerInvoiceJournal,
  postInventoryWriteOffJournal,
  postPurchaseReceiptJournal,
  postSupplierInvoiceJournal,
} from "@/lib/accounting/posting";
import { addCashDrawerEntry } from "@/lib/sales/shift-posting";
import type { Tables } from "@/types/database";
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
  reason: z.enum(["تلف", "محاريق"]),
  notes: z.string().optional(),
});

const stockCountSchema = z.object({
  branchId: z.string().uuid("اختر الفرع"),
  notes: z.string().optional(),
});

const closeShiftSchema = z.object({
  shiftId: z.string().uuid("وردية غير صحيحة"),
  actualCash: z.coerce.number().nonnegative("الكاش الفعلي يجب أن يكون صفر أو أكثر"),
  notes: z.string().optional(),
});

const productionOrderSchema = z.object({
  recipeId: z.string().uuid("اختر الوصفة"),
  branchId: z.string().uuid("اختر مستودع/فرع الإنتاج"),
  sourceBranchId: z.string().uuid("اختر مستودع صرف المواد"),
  plannedQuantity: z.coerce.number().positive("الكمية المخططة يجب أن تكون أكبر من صفر"),
  completedQuantity: z.coerce.number().positive("الكمية المنتجة يجب أن تكون أكبر من صفر"),
  allowNegativeStock: z.boolean().default(false),
  notes: z.string().optional(),
});

async function resolveMutationScope() {
  const auth = await requireAuth();
  const admin = createAdminClientWithContext("mutations.ts/resolveMutationScope");

  // Use the user's org from auth (populated by requireAuth via membership lookup)
  if (auth.organizationId) {
    return { admin, organizationId: auth.organizationId, userId: auth.id };
  }

  // Fallback: direct membership lookup
  const { data: membership } = await (admin as any)
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", auth.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membership?.organization_id) {
    return { admin, organizationId: membership.organization_id, userId: auth.id };
  }

  // Super-admin can access any org
  if (auth.role === "super_admin") {
    const { data: firstOrg } = await admin
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstOrg?.id) {
      return { admin, organizationId: firstOrg.id, userId: auth.id };
    }
  }

  throw new Error("لم يتم العثور على مؤسسة مرتبطة بحسابك.");
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

    await postCustomerInvoiceJournal(admin, {
      organizationId,
      branchId: parsed.data.branchId,
      invoiceId: invoice.id,
      invoiceNumber,
      paymentMethod: parsed.data.paymentMethod,
      subtotal: total - taxTotal,
      taxTotal,
      total,
      costTotal,
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
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات المادة غير صحيحة");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن حفظ مادة المخزون في قاعدة البيانات.");
  }

  try {
    const { admin, organizationId, userId } = await resolveMutationScope();

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

export async function saveSupplyInvoiceAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = supplyInvoiceSchema.safeParse({
    supplierId: formData.get("supplierId"),
    branchId: formData.get("branchId"),
    invoiceNumber: formData.get("invoiceNumber"),
    issuedAt: formData.get("issuedAt"),
    itemId: formData.get("itemId"),
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
    expirationDate: formData.get("expirationDate") || "",
    notes: formData.get("notes") || "",
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات الفاتورة غير صحيحة");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود. لا يمكن حفظ الفاتورة في قاعدة البيانات.");
  }

  try {
    const { admin, organizationId, userId } = await resolveMutationScope();
    const [supplierResult, branch, item] = await Promise.all([
      admin
        .from("suppliers")
        .select("id")
        .eq("id", parsed.data.supplierId)
        .eq("organization_id", organizationId)
        .maybeSingle(),
      getScopedBranch(admin, organizationId, parsed.data.branchId),
      getScopedInventoryItem(admin, organizationId, parsed.data.itemId),
    ]);

    if (supplierResult.error) return invalid(supplierResult.error.message);
    if (!supplierResult.data?.id) return invalid("المورد المختار غير موجود في المؤسسة الحالية.");
    if (!branch?.id) return invalid("الفرع المختار غير موجود في المؤسسة الحالية.");
    if (!item?.id) return invalid("المادة المختارة غير موجودة في المؤسسة الحالية.");

    const invoiceTotal = Math.round(parsed.data.quantity * parsed.data.unitPrice * 100) / 100;
    const { data: invoice, error: invoiceError } = await admin
      .from("invoices")
      .insert({
        organization_id: organizationId,
        supplier_id: parsed.data.supplierId,
        branch_id: parsed.data.branchId,
        invoice_number: parsed.data.invoiceNumber,
        issued_at: parsed.data.issuedAt,
        status: "draft",
        total: invoiceTotal,
        created_by: userId,
      })
      .select("id")
      .single();

    if (invoiceError) return invalid(invoiceError.message);
    if (!invoice?.id) return invalid("تعذر إنشاء فاتورة التوريد.");

    const { error: itemError } = await admin.from("invoice_items").insert({
      organization_id: organizationId,
      invoice_id: invoice.id,
      item_id: parsed.data.itemId,
      quantity: parsed.data.quantity,
      unit_price: parsed.data.unitPrice,
      created_by: userId,
    });

    if (itemError) return invalid(itemError.message);
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ فاتورة التوريد في Supabase.");
  }

  revalidatePath("/dashboard/invoices");
  return ok("تم حفظ فاتورة التوريد.");
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
    const { admin, organizationId, userId } = await resolveMutationScope();
    const [branch, item] = await Promise.all([
      getScopedBranch(admin, organizationId, parsed.data.branchId),
      getScopedInventoryItem(admin, organizationId, parsed.data.itemId),
    ]);

    if (!branch?.id) return invalid("الفرع المختار غير موجود في المؤسسة الحالية.");
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

    let receiptTotal = 0;

    for (const item of orderItems ?? []) {
      const quantity = Number(item.quantity ?? 0);
      const alreadyReceived = Number(item.received_quantity ?? 0);
      const quantityToReceive = Math.max(0, quantity - alreadyReceived);
      const unitCost = Number(item.expected_unit_price ?? 0);
      if (quantityToReceive <= 0) continue;

      await addToBranchStock(admin, organizationId, order.branch_id, item.item_id, quantityToReceive, userId);

      const { error: movementError } = await admin.from("stock_movements").insert({
        organization_id: organizationId,
        branch_id: order.branch_id,
        item_id: item.item_id,
        movement_type: "purchase",
        quantity: quantityToReceive,
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
        .update({ received_quantity: alreadyReceived + quantityToReceive })
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

      receiptTotal += quantityToReceive * unitCost;
    }

    if (receiptTotal <= 0) {
      return invalid("لا توجد كميات جديدة لاستلامها في هذا الطلب.");
    }

    const { error: updateError } = await admin
      .from("purchase_orders")
      .update({
        status: "received",
      })
      .eq("id", purchaseOrderId)
      .eq("organization_id", organizationId);

    if (updateError) return invalid(updateError.message);

    await postPurchaseReceiptJournal(admin, {
      organizationId,
      branchId: order.branch_id,
      purchaseOrderId,
      orderLabel: `PO-${purchaseOrderId.slice(0, 8)}`,
      total: receiptTotal,
      createdBy: userId,
    });
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر استلام طلب الشراء في Supabase.");
  }

  revalidatePath("/dashboard/purchase-orders");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movements");
  revalidatePath("/dashboard/accounting/ledger");
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
    const { admin, organizationId, userId } = await resolveMutationScope();
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
    if (!branchResult.data?.id) return invalid("فرع الإنتاج غير موجود.");
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

    await postInventoryWriteOffJournal(admin, {
      organizationId,
      branchId: parsed.data.branchId,
      sourceDocType: "waste_log",
      sourceDocId: wasteLog.id,
      label: `هدر ${item.name ?? parsed.data.itemId} - ${parsed.data.reason}`,
      totalCost: cost,
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

// New Schemas for Rewaq SaaS fixes
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
  branchId: z.string().uuid("اختر القسم / الفرع"),
  invoiceNumber: z.string().min(1, "رقم الفاتورة مطلوب"),
  issuedAt: z.string().min(1, "التاريخ مطلوب"),
  itemId: z.string().uuid("اختر الصنف"),
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  unitPrice: z.coerce.number().positive("السعر يجب أن يكون أكبر من صفر"),
  expiryDate: z.string().optional(),
});

const transferSchema = z.object({
  fromBranchId: z.string().uuid("اختر القسم المرسل"),
  toBranchId: z.string().uuid("اختر القسم المستقبل"),
  itemId: z.string().uuid("اختر المادة"),
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  notes: z.string().optional(),
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
    const { admin, organizationId, userId } = await resolveMutationScope();

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
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات الفاتورة غير صحيحة");

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود.");
  }

  try {
    const { admin, organizationId, userId } = await resolveMutationScope();

    const [supplier, branch, item] = await Promise.all([
      admin.from("suppliers").select("id").eq("id", parsed.data.supplierId).eq("organization_id", organizationId).maybeSingle(),
      admin.from("branches").select("id").eq("id", parsed.data.branchId).eq("organization_id", organizationId).maybeSingle(),
      admin.from("inventory_items").select("id, average_cost").eq("id", parsed.data.itemId).eq("organization_id", organizationId).maybeSingle(),
    ]);

    if (!supplier.data?.id) return invalid("المورد غير موجود.");
    if (!branch.data?.id) return invalid("القسم/الفرع غير موجود.");
    if (!item.data?.id) return invalid("المادة غير موجودة.");

    const total = parsed.data.quantity * parsed.data.unitPrice;

    const { data: invoice, error: invoiceError } = await admin
      .from("invoices")
      .insert({
        organization_id: organizationId,
        supplier_id: parsed.data.supplierId,
        branch_id: parsed.data.branchId,
        invoice_number: parsed.data.invoiceNumber,
        total,
        issued_at: parsed.data.issuedAt,
        status: "paid",
        created_by: userId,
      })
      .select("id")
      .single();

    if (invoiceError) return invalid(invoiceError.message);

    const { error: itemError } = await admin
      .from("invoice_items")
      .insert({
        organization_id: organizationId,
        invoice_id: invoice.id,
        item_id: parsed.data.itemId,
        quantity: parsed.data.quantity,
        unit_price: parsed.data.unitPrice,
        created_by: userId,
      });

    if (itemError) return invalid(itemError.message);

    await addToBranchStock(admin, organizationId, parsed.data.branchId, parsed.data.itemId, parsed.data.quantity, userId);

    const { error: movementError } = await admin.from("stock_movements").insert({
      organization_id: organizationId,
      branch_id: parsed.data.branchId,
      item_id: parsed.data.itemId,
      movement_type: "purchase",
      quantity: parsed.data.quantity,
      unit_cost: parsed.data.unitPrice,
      source_doc_type: "invoice",
      source_doc_id: invoice.id,
      idempotency_key: `${invoice.id}:${parsed.data.itemId}:receive`,
      notes: `فاتورة توريد رقم ${parsed.data.invoiceNumber}${parsed.data.expiryDate ? ` - انتهاء: ${parsed.data.expiryDate}` : ""}`,
      created_by: userId,
    });

    if (movementError && !movementError.message.includes("duplicate key")) return invalid(movementError.message);

    await admin.from("supplier_price_history").insert({
      organization_id: organizationId,
      supplier_id: parsed.data.supplierId,
      item_id: parsed.data.itemId,
      unit_price: parsed.data.unitPrice,
      source_doc_type: "invoice",
      source_doc_id: invoice.id,
      created_by: userId,
    });

    const { data: stockRows } = await admin
      .from("branch_stock")
      .select("quantity")
      .eq("organization_id", organizationId)
      .eq("item_id", parsed.data.itemId);
    
    const currentStock = stockRows?.reduce((sum, s) => sum + Number(s.quantity ?? 0), 0) ?? 0;
    const oldStock = Math.max(0, currentStock - parsed.data.quantity);
    const oldCost = Number(item.data.average_cost ?? 0);
    const newAverageCost = (oldCost * oldStock + total) / Math.max(1, currentStock);

    await admin
      .from("inventory_items")
      .update({
        average_cost: newAverageCost,
        last_purchase_price: parsed.data.unitPrice,
      })
      .eq("id", parsed.data.itemId);

    await postSupplierInvoiceJournal(admin, {
      organizationId,
      branchId: parsed.data.branchId,
      invoiceId: invoice.id,
      invoiceNumber: parsed.data.invoiceNumber,
      total,
      createdBy: userId,
    });
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ الفاتورة في Supabase.");
  }

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movements");
  revalidatePath("/dashboard/accounting/ledger");
  revalidatePath("/dashboard/reports");
  return ok("تم حفظ فاتورة التوريد وتحديث كميات وأسعار المخزون بنجاح.");
}

export async function saveTransferAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = transferSchema.safeParse({
    fromBranchId: formData.get("fromBranchId"),
    toBranchId: formData.get("toBranchId"),
    itemId: formData.get("itemId"),
    quantity: formData.get("quantity"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات التحويل غير صحيحة");

  if (parsed.data.fromBranchId === parsed.data.toBranchId) {
    return invalid("لا يمكن التحويل لنفس القسم.");
  }

  if (!hasSupabaseAdminEnv()) {
    return invalid("مفتاح Supabase الإداري غير موجود.");
  }

  try {
    const { admin, organizationId, userId } = await resolveMutationScope();

    const [fromBranch, toBranch, item] = await Promise.all([
      admin.from("branches").select("id").eq("id", parsed.data.fromBranchId).eq("organization_id", organizationId).maybeSingle(),
      admin.from("branches").select("id").eq("id", parsed.data.toBranchId).eq("organization_id", organizationId).maybeSingle(),
      admin.from("inventory_items").select("id, name, average_cost").eq("id", parsed.data.itemId).eq("organization_id", organizationId).maybeSingle(),
    ]);

    if (!fromBranch.data?.id) return invalid("القسم المرسل غير موجود.");
    if (!toBranch.data?.id) return invalid("القسم المستقبل غير موجود.");
    if (!item.data?.id) return invalid("المادة غير موجودة.");

    const { data: stockRow } = await admin
      .from("branch_stock")
      .select("quantity")
      .eq("organization_id", organizationId)
      .eq("branch_id", parsed.data.fromBranchId)
      .eq("item_id", parsed.data.itemId)
      .maybeSingle();

    const currentStock = Number(stockRow?.quantity ?? 0);
    if (currentStock < parsed.data.quantity) {
      return invalid(`رصيد المادة لا يكفي في القسم المرسل. الرصيد الحالي: ${currentStock}`);
    }

    const { data: transfer, error: transferError } = await admin
      .from("transfers")
      .insert({
        organization_id: organizationId,
        from_branch_id: parsed.data.fromBranchId,
        to_branch_id: parsed.data.toBranchId,
        status: "received",
        sent_at: new Date().toISOString(),
        received_at: new Date().toISOString(),
        notes: parsed.data.notes || null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (transferError) return invalid(transferError.message);

    const unitCost = Number(item.data.average_cost ?? 0);

    const { error: itemError } = await admin
      .from("transfer_items")
      .insert({
        organization_id: organizationId,
        transfer_id: transfer.id,
        item_id: parsed.data.itemId,
        quantity: parsed.data.quantity,
        unit_cost: unitCost,
        created_by: userId,
      });

    if (itemError) return invalid(itemError.message);

    await addToBranchStock(admin, organizationId, parsed.data.fromBranchId, parsed.data.itemId, -parsed.data.quantity, userId);
    await addToBranchStock(admin, organizationId, parsed.data.toBranchId, parsed.data.itemId, parsed.data.quantity, userId);

    const { error: movementOutError } = await admin.from("stock_movements").insert({
      organization_id: organizationId,
      branch_id: parsed.data.fromBranchId,
      item_id: parsed.data.itemId,
      movement_type: "transfer_out",
      quantity: -parsed.data.quantity,
      unit_cost: unitCost,
      source_doc_type: "transfer",
      source_doc_id: transfer.id,
      idempotency_key: `${transfer.id}:${parsed.data.itemId}:out`,
      notes: `تحويل صادر إلى ${toBranch.data.id}`,
      created_by: userId,
    });
    if (movementOutError) return invalid(movementOutError.message);

    const { error: movementInError } = await admin.from("stock_movements").insert({
      organization_id: organizationId,
      branch_id: parsed.data.toBranchId,
      item_id: parsed.data.itemId,
      movement_type: "transfer_in",
      quantity: parsed.data.quantity,
      unit_cost: unitCost,
      source_doc_type: "transfer",
      source_doc_id: transfer.id,
      idempotency_key: `${transfer.id}:${parsed.data.itemId}:in`,
      notes: `تحويل وارد من ${fromBranch.data.id}`,
      created_by: userId,
    });
    if (movementInError) return invalid(movementInError.message);

  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر حفظ التحويل في Supabase.");
  }

  revalidatePath("/dashboard/transfers");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movements");
  revalidatePath("/dashboard/reports");
  return ok("تم تسجيل التحويل الداخلي وتحديث رصيد المخزن بنجاح.");
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
    const { admin, organizationId, userId } = await resolveMutationScope();

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
    const { admin, organizationId, userId } = await resolveMutationScope();

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
    const { admin, organizationId, userId } = await resolveMutationScope();
    const { data: shift, error: shiftError } = await (admin as any)
      .from("sales_shifts")
      .select("*")
      .eq("id", parsed.data.shiftId)
      .eq("organization_id", organizationId)
      .single();

    if (shiftError || !shift) {
      return invalid(shiftError?.message ?? "لم يتم العثور على الوردية.");
    }

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
      createdBy: userId,
    });
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "تعذر إغلاق الوردية.");
  }

  revalidatePath("/dashboard/shifts");
  revalidatePath("/dashboard/accounting/ledger");
  return ok("تم إغلاق الوردية وتسجيل فرق الصندوق محاسبياً.");
}
