import "server-only";

import { requireAuth } from "@/lib/auth/require-auth";
import { createAdminClientWithContext, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { canUseDemoFallback } from "@/lib/supabase/env";
import { requireOrganizationModule } from "@/server/billing/entitlements";

export type DigitalPresenceSite = {
  id: string;
  branchId: string | null;
  slug: string;
  displayName: string;
  tagline: string;
  description: string;
  logoUrl: string;
  coverUrl: string;
  primaryColor: string;
  contactPhone: string;
  whatsappPhone: string;
  address: string;
  status: "draft" | "published" | "archived";
};

export type DigitalPresenceMenuItem = {
  id: string;
  name: string;
  sellingPrice: number;
  status: string;
  branchId: string | null;
  imagePath: string;
  publication: null | {
    categoryName: string;
    publicDescription: string;
    imageUrl: string;
    displayOrder: number;
    isFeatured: boolean;
    isVisible: boolean;
  };
};

export async function getDigitalPresenceData(): Promise<{
  site: DigitalPresenceSite | null;
  menuItems: DigitalPresenceMenuItem[];
  branches: Array<{ id: string; name: string }>;
}> {
  const auth = await requireAuth();
  if (!auth.organizationId) throw new Error("اختر المؤسسة النشطة أولاً.");
  if (!hasSupabaseAdminEnv()) {
    if (canUseDemoFallback()) return { site: null, menuItems: [], branches: [] };
    throw new Error("إعداد Supabase الإداري غير مكتمل.");
  }

  const admin = createAdminClientWithContext("digital-presence/query");
  await requireOrganizationModule(admin, auth.organizationId, "digital_presence");
  const organizationId = auth.organizationId;
  const [siteResult, menuResult, branchResult] = await Promise.all([
    admin
      .from("restaurant_sites")
      .select("id, branch_id, slug, display_name, tagline, description, logo_url, cover_url, primary_color, contact_phone, whatsapp_phone, address, status")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    admin
      .from("menu_items")
      .select("id, name, selling_price, status, branch_id, image_path")
      .eq("organization_id", organizationId)
      .order("name")
      .limit(1000),
    admin
      .from("branches")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("name"),
  ]);
  const baseError = siteResult.error ?? menuResult.error ?? branchResult.error;
  if (baseError) throw new Error(baseError.message);

  const siteRow = siteResult.data as any;
  const publicationResult = siteRow?.id
    ? await admin
        .from("restaurant_site_menu_items")
        .select("menu_item_id, category_name, public_description, image_url, display_order, is_featured, is_visible")
        .eq("organization_id", organizationId)
        .eq("site_id", siteRow.id)
    : { data: [], error: null };
  if (publicationResult.error) throw new Error(publicationResult.error.message);

  const publicationByItem = new Map<string, any>();
  for (const publication of publicationResult.data ?? []) {
    publicationByItem.set(publication.menu_item_id, publication);
  }

  return {
    site: siteRow
      ? {
          id: siteRow.id,
          branchId: siteRow.branch_id,
          slug: siteRow.slug,
          displayName: siteRow.display_name,
          tagline: siteRow.tagline ?? "",
          description: siteRow.description ?? "",
          logoUrl: siteRow.logo_url ?? "",
          coverUrl: siteRow.cover_url ?? "",
          primaryColor: siteRow.primary_color ?? "#0f766e",
          contactPhone: siteRow.contact_phone ?? "",
          whatsappPhone: siteRow.whatsapp_phone ?? "",
          address: siteRow.address ?? "",
          status: siteRow.status,
        }
      : null,
    menuItems: (menuResult.data ?? []).map((item: any) => {
      const publication = publicationByItem.get(item.id);
      return {
        id: item.id,
        name: item.name,
        sellingPrice: Number(item.selling_price ?? 0),
        status: item.status,
        branchId: item.branch_id,
        imagePath: item.image_path ?? "",
        publication: publication
          ? {
              categoryName: publication.category_name,
              publicDescription: publication.public_description ?? "",
              imageUrl: publication.image_url ?? "",
              displayOrder: Number(publication.display_order ?? 0),
              isFeatured: Boolean(publication.is_featured),
              isVisible: Boolean(publication.is_visible),
            }
          : null,
      };
    }),
    branches: (branchResult.data ?? []).map((branch: any) => ({ id: branch.id, name: branch.name })),
  };
}
