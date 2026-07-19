"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/require-auth";
import { createAdminClientWithContext, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { requireOrganizationModule } from "@/server/billing/entitlements";
import type { ActionState } from "./auth";

const siteSchema = z.object({
  siteId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(80),
  displayName: z.string().trim().min(1).max(160),
  tagline: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  logoUrl: z.string().trim().max(1000).optional(),
  coverUrl: z.string().trim().max(1000).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  contactPhone: z.string().trim().max(40).optional(),
  whatsappPhone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(500).optional(),
  status: z.enum(["draft", "published", "archived"]),
});

const publicationSchema = z.object({
  siteId: z.string().uuid(),
  menuItemId: z.string().uuid(),
  categoryName: z.string().trim().min(1).max(100),
  publicDescription: z.string().trim().max(1000).optional(),
  imageUrl: z.string().trim().max(1000).optional(),
  displayOrder: z.coerce.number().int().min(-10000).max(10000),
  isFeatured: z.boolean(),
  isVisible: z.boolean(),
});

async function resolveDigitalPresenceScope() {
  const auth = await requireAuth();
  if (!auth.organizationId) {
    throw new Error("اختر المؤسسة النشطة أولاً.");
  }
  if (!["super_admin", "organization_owner", "branch_manager", "marketing_manager"].includes(auth.role)) {
    throw new Error("دورك لا يسمح بإدارة الموقع والمنيو الإلكتروني.");
  }
  if (!hasSupabaseAdminEnv()) {
    throw new Error("إعداد Supabase الإداري غير مكتمل؛ لم يتم حفظ التغييرات.");
  }
  const admin = createAdminClientWithContext("digital-presence/resolve-scope");
  await requireOrganizationModule(admin, auth.organizationId, "digital_presence", { write: true });
  return { admin, organizationId: auth.organizationId, userId: auth.id };
}

export async function saveRestaurantSiteAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = siteSchema.safeParse({
    siteId: String(formData.get("siteId") || "") || null,
    branchId: String(formData.get("branchId") || "") || null,
    slug: String(formData.get("slug") || ""),
    displayName: String(formData.get("displayName") || ""),
    tagline: String(formData.get("tagline") || ""),
    description: String(formData.get("description") || ""),
    logoUrl: String(formData.get("logoUrl") || ""),
    coverUrl: String(formData.get("coverUrl") || ""),
    primaryColor: String(formData.get("primaryColor") || "#0f766e"),
    contactPhone: String(formData.get("contactPhone") || ""),
    whatsappPhone: String(formData.get("whatsappPhone") || ""),
    address: String(formData.get("address") || ""),
    status: String(formData.get("status") || "draft"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "بيانات الموقع غير صحيحة." };
  }

  try {
    const scope = await resolveDigitalPresenceScope();
    const { data, error } = await (scope.admin as any).rpc("save_restaurant_site_atomic", {
      p_organization_id: scope.organizationId,
      p_site_id: parsed.data.siteId,
      p_branch_id: parsed.data.branchId,
      p_slug: parsed.data.slug,
      p_display_name: parsed.data.displayName,
      p_tagline: parsed.data.tagline || null,
      p_description: parsed.data.description || null,
      p_logo_url: parsed.data.logoUrl || null,
      p_cover_url: parsed.data.coverUrl || null,
      p_primary_color: parsed.data.primaryColor,
      p_contact_phone: parsed.data.contactPhone || null,
      p_whatsapp_phone: parsed.data.whatsappPhone || null,
      p_address: parsed.data.address || null,
      p_status: parsed.data.status,
      p_actor_user_id: scope.userId,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/digital-presence");
    revalidatePath(`/m/${data?.slug ?? parsed.data.slug}`);
    return {
      ok: true,
      message: parsed.data.status === "published" ? "تم نشر الموقع والمنيو." : "تم حفظ إعدادات الموقع.",
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "تعذر حفظ الموقع." };
  }
}

export async function setRestaurantSiteMenuItemAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = publicationSchema.safeParse({
    siteId: String(formData.get("siteId") || ""),
    menuItemId: String(formData.get("menuItemId") || ""),
    categoryName: String(formData.get("categoryName") || "القائمة"),
    publicDescription: String(formData.get("publicDescription") || ""),
    imageUrl: String(formData.get("imageUrl") || ""),
    displayOrder: formData.get("displayOrder") || 0,
    isFeatured: formData.get("isFeatured") === "on",
    isVisible: formData.get("isVisible") === "on",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "بيانات نشر الصنف غير صحيحة." };
  }

  try {
    const scope = await resolveDigitalPresenceScope();
    const { error } = await (scope.admin as any).rpc("set_restaurant_site_menu_item_atomic", {
      p_organization_id: scope.organizationId,
      p_site_id: parsed.data.siteId,
      p_menu_item_id: parsed.data.menuItemId,
      p_category_name: parsed.data.categoryName,
      p_public_description: parsed.data.publicDescription || null,
      p_image_url: parsed.data.imageUrl || null,
      p_display_order: parsed.data.displayOrder,
      p_is_featured: parsed.data.isFeatured,
      p_is_visible: parsed.data.isVisible,
      p_actor_user_id: scope.userId,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/digital-presence");
    return { ok: true, message: parsed.data.isVisible ? "تم ربط الصنف بالموقع." : "تم إخفاء الصنف من الموقع." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "تعذر تحديث نشر الصنف." };
  }
}
