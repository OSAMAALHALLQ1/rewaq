import { z } from "zod";

export const authSchema = z.object({
  email: z.email("أدخل بريدًا صحيحًا"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

export const registerSchema = authSchema.extend({
  name: z.string().min(2, "أدخل الاسم"),
  organizationName: z.string().min(2, "أدخل اسم المطعم أو الشركة"),
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
  categoryId: z.string().min(1, "اختر الفئة"),
  purchaseUnit: z.string().min(1, "وحدة الشراء مطلوبة"),
  usageUnit: z.string().min(1, "وحدة الاستخدام مطلوبة"),
  lastPurchasePrice: z.coerce.number().nonnegative(),
  averageCost: z.coerce.number().nonnegative(),
  minimumQuantity: z.coerce.number().nonnegative(),
  primarySupplierId: z.string().optional(),
  sku: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "اختر المورد"),
  branchId: z.string().min(1, "اختر الفرع"),
  status: z.enum(["draft", "sent", "received", "partially_received", "cancelled"]),
  orderDate: z.string().min(1, "التاريخ مطلوب"),
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
  platforms: z.array(z.enum(["facebook", "instagram", "telegram"])).min(1, "اختر منصة واحدة على الأقل"),
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
