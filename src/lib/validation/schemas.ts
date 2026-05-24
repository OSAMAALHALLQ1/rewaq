import { z } from "zod";
import { SOCIAL_PLATFORM_IDS } from "@/lib/social/platforms";

export const authSchema = z.object({
  email: z.email("أدخل بريدًا صحيحًا"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

export const registerSchema = authSchema.extend({
  name: z.string().min(2, "أدخل الاسم"),
  organizationName: z.string().min(2, "أدخل اسم المطعم أو الشركة"),
  businessType: z.string().min(2, "اختر نوع النشاط"),
  phone: z.string().optional(),
});

export const teamInviteSchema = z.object({
  email: z.email("أدخل بريدًا صحيحًا"),
  role: z.enum(["cashier", "inventory_manager", "branch_manager", "accountant", "marketing_manager", "chef", "staff"]),
  branchId: z.string().optional(),
});

export const supplierSchema = z.object({
  name: z.string().min(2, "اسم المورد مطلوب"),
  phone: z.string().min(5, "رقم الهاتف مطلوب"),
  email: z.email("البريد غير صحيح").optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["active", "inactive"]),
});

export const inventoryItemSchema = z.object({
  name: z.string().min(2, "اسم المادة مطلوب"),
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
  purchaseUnit: z.string().min(1, "وحدة الشراء مطلوبة"),
  usageUnit: z.string().min(1, "وحدة الاستخدام مطلوبة"),
  lastPurchasePrice: z.coerce.number().nonnegative(),
  averageCost: z.coerce.number().nonnegative(),
  minimumQuantity: z.coerce.number().nonnegative(),
  primarySupplierId: z.string().optional(),
  sku: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
}).refine((value) => Boolean(value.categoryId || value.categoryName?.trim()), {
  message: "اختر الفئة أو أضف فئة جديدة",
  path: ["categoryId"],
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "اختر المورد"),
  branchId: z.string().min(1, "اختر الفرع"),
  status: z.enum(["draft", "sent", "received", "partially_received", "cancelled"]),
  orderDate: z.string().min(1, "التاريخ مطلوب"),
  notes: z.string().optional(),
});

export const transferSchema = z.object({
  fromBranchId: z.string().min(1, "اختر القسم المرسل"),
  toBranchId: z.string().min(1, "اختر القسم المستقبل"),
  itemId: z.string().min(1, "اختر المادة"),
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  notes: z.string().optional(),
});

export const supplyInvoiceSchema = z.object({
  supplierId: z.string().min(1, "اختر المورد"),
  branchId: z.string().min(1, "اختر الفرع"),
  invoiceNumber: z.string().min(1, "رقم الفاتورة مطلوب"),
  issuedAt: z.string().min(1, "تاريخ الفاتورة مطلوب"),
  itemId: z.string().min(1, "اختر الصنف"),
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  unitPrice: z.coerce.number().nonnegative("السعر يجب أن يكون صفر أو أكثر"),
  expirationDate: z.string().optional(),
  notes: z.string().optional(),
});

export const salesReturnSchema = z.object({
  branchId: z.string().min(1, "اختر القسم"),
  itemId: z.string().min(1, "اختر المادة"),
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  reason: z.string().min(2, "سبب المرتجع مطلوب"),
  notes: z.string().optional(),
});

export const recipeSchema = z.object({
  name: z.string().min(2, "اسم الوصفة مطلوب"),
  category: z.string().min(1, "تصنيف الوصفة مطلوب"),
  servings: z.coerce.number().positive(),
  preparation: z.string().optional(),
});

export const menuItemSchema = z.object({
  name: z.string().min(2, "اسم الطبق مطلوب"),
  recipeId: z.string().min(1, "اختر الوصفة"),
  sellingPrice: z.coerce.number().positive(),
  branchId: z.string().optional(),
  status: z.enum(["active", "inactive"]),
});

export const socialPostSchema = z.object({
  title: z.string().min(2, "عنوان داخلي مطلوب"),
  body: z.string().min(5, "نص المنشور مطلوب"),
  platforms: z.array(z.enum(SOCIAL_PLATFORM_IDS)).min(1, "اختر منصة واحدة على الأقل"),
  publishMode: z.enum(["now", "schedule", "draft"]),
  scheduledAt: z.string().optional(),
});

export const demoRequestSchema = z.object({
  name: z.string().min(2),
  restaurant: z.string().min(2),
  phone: z.string().min(5),
  email: z.email().optional().or(z.literal("")),
  message: z.string().optional(),
});
