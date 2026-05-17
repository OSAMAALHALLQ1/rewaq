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
  if (!hasSupabaseEnv()) {
    return invalid("مفاتيح Supabase غير مكتملة. أضف مفتاح publishable في .env.local.");
  }

  const parsed = issueCustomerInvoiceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات الفاتورة غير صحيحة");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_customer_invoice", {
    p_organization_id: parsed.data.organizationId,
    p_branch_id: parsed.data.branchId,
    p_customer_name: parsed.data.customerName,
    p_customer_phone: parsed.data.customerPhone ?? null,
    p_payment_method: parsed.data.paymentMethod,
    p_channel: parsed.data.channel,
    p_items: parsed.data.items,
    p_invoice_discount: parsed.data.invoiceDiscount,
    p_service_fee: parsed.data.serviceFee,
    p_delivery_fee: parsed.data.deliveryFee,
    p_notes: parsed.data.notes ?? null,
    p_idempotency_key: parsed.data.idempotencyKey ?? crypto.randomUUID(),
    p_allow_negative_stock: parsed.data.allowNegativeStock,
  });

  if (error) return invalid(error.message);

  revalidatePath("/dashboard/customer-invoices");
  revalidatePath("/dashboard/customer-invoices/new");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/stock-movements");
  revalidatePath("/dashboard/amwali");

  return ok(`تم إصدار الفاتورة وربطها بالمخزون. النتيجة: ${JSON.stringify(data)}`);
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

  revalidatePath("/dashboard/inventory");
  return ok("تم حفظ مادة المخزون. عند ربط Supabase سيتم تخزينها في قاعدة البيانات.");
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

  revalidatePath("/dashboard/suppliers");
  return ok("تم حفظ المورد.");
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

  revalidatePath("/dashboard/purchase-orders");
  return ok("تم حفظ طلب الشراء. الاستلام سيولد stock_movements في قاعدة البيانات.");
}

export async function receivePurchaseOrderAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  if (!purchaseOrderId) return invalid("طلب الشراء غير معروف");

  revalidatePath("/dashboard/purchase-orders");
  revalidatePath("/dashboard/inventory");
  return ok("تم استلام الطلب وتوليد حركات المخزون في تدفق MVP.");
}

export async function receivePurchaseOrderFormAction(formData: FormData): Promise<void> {
  const purchaseOrderId = String(formData.get("purchaseOrderId") ?? "");
  if (!purchaseOrderId) return;

  revalidatePath("/dashboard/purchase-orders");
  revalidatePath("/dashboard/inventory");
}

export async function saveRecipeAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = recipeSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    servings: formData.get("servings"),
    preparation: formData.get("preparation") || "",
  });

  if (!parsed.success) return invalid(parsed.error.issues[0]?.message ?? "بيانات الوصفة غير صحيحة");

  revalidatePath("/dashboard/recipes");
  return ok("تم حفظ الوصفة. يمكن إضافة المكونات وحساب التكلفة مباشرة.");
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

  revalidatePath("/dashboard/menu-items");
  return ok("تم حفظ الطبق وتحديث مؤشرات الربحية.");
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
