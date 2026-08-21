import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireRoleCapability } from "@/lib/auth/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const stationSchema = z.object({
  action: z.literal("station"),
  branchId: z.string().uuid(),
  stationId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2).max(120),
  isActive: z.boolean().default(true),
});

const routeSchema = z.object({
  action: z.literal("route"),
  branchId: z.string().uuid(),
  catalogItemId: z.string().uuid(),
  stationId: z.string().uuid(),
  isActive: z.boolean().default(true),
});

function stationCode(name: string) {
  const normalized = name
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${normalized || "station"}-${crypto.randomUUID().slice(0, 6)}`.slice(0, 64);
}

async function ownerSession() {
  const session = await requireAuth();
  requireRoleCapability(session, ["super_admin", "organization_owner"]);
  return session;
}

export async function GET() {
  try {
    const session = await ownerSession();
    const admin = createAdminClient();
    const [stationsResult, itemsResult, routesResult] = await Promise.all([
      admin.from("kitchen_stations").select("id,branch_id,code,name,display_order,is_active").eq("organization_id", session.organizationId).order("display_order").order("name"),
      admin.from("catalog_items").select("id,branch_id,code,name,category_name,status").eq("organization_id", session.organizationId).eq("status", "active").order("category_name").order("name").limit(1000),
      admin.from("catalog_item_kitchen_routes").select("id,branch_id,catalog_item_id,station_id,is_active").eq("organization_id", session.organizationId),
    ]);
    const error = stationsResult.error ?? itemsResult.error ?? routesResult.error;
    if (error) throw error;
    return NextResponse.json({
      success: true,
      stations: stationsResult.data ?? [],
      items: itemsResult.data ?? [],
      routes: routesResult.data ?? [],
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "تعذر تحميل إعدادات الأقسام." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await ownerSession();
    const input = await request.json().catch(() => ({}));
    const admin = createAdminClient();

    if (input?.action === "station") {
      const parsed = stationSchema.safeParse(input);
      if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "بيانات القسم غير صحيحة." }, { status: 400 });
      const { data: existing } = parsed.data.stationId
        ? await admin.from("kitchen_stations").select("code,display_order").eq("id", parsed.data.stationId).eq("organization_id", session.organizationId).maybeSingle()
        : { data: null };
      const { data, error } = await admin.rpc("upsert_kitchen_station_atomic", {
        p_organization_id: session.organizationId,
        p_branch_id: parsed.data.branchId,
        p_station_id: parsed.data.stationId ?? null,
        p_code: existing?.code ?? stationCode(parsed.data.name),
        p_name: parsed.data.name,
        p_display_order: existing?.display_order ?? 0,
        p_is_active: parsed.data.isActive,
        p_actor_user_id: session.id,
      });
      if (error) throw error;
      return NextResponse.json({ success: true, result: data });
    }

    const parsed = routeSchema.safeParse(input);
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "بيانات توجيه الوجبة غير صحيحة." }, { status: 400 });
    const { data, error } = await admin.rpc("upsert_catalog_item_kitchen_route_atomic", {
      p_organization_id: session.organizationId,
      p_branch_id: parsed.data.branchId,
      p_catalog_item_id: parsed.data.catalogItemId,
      p_station_id: parsed.data.stationId,
      p_is_active: parsed.data.isActive,
      p_actor_user_id: session.id,
    });
    if (error) throw error;
    return NextResponse.json({ success: true, result: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "تعذر حفظ إعدادات الأقسام." }, { status: 403 });
  }
}
