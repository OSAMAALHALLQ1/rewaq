import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await requireAuth();
    const supabase = await createClient();

    const { data: groups, error: gErr } = await (supabase as any)
      .from("modifier_groups")
      .select("id, name, selection_type, min_select, max_select, is_required, display_order, status, modifier_options(id, name, price_delta, is_default, is_available, display_order)")
      .eq("organization_id", user.organizationId)
      .order("display_order", { ascending: true });

    if (gErr) return NextResponse.json({ success: false, error: gErr.message }, { status: 500 });

    const { data: links, error: lErr } = await (supabase as any)
      .from("catalog_item_modifier_groups")
      .select("catalog_item_id, modifier_group_id")
      .eq("organization_id", user.organizationId);

    if (lErr) return NextResponse.json({ success: false, error: lErr.message }, { status: 500 });

    const { data: items, error: iErr } = await (supabase as any)
      .from("catalog_items")
      .select("id, name, category_name")
      .eq("organization_id", user.organizationId)
      .eq("status", "active")
      .order("name")
      .limit(500);

    if (iErr) return NextResponse.json({ success: false, error: iErr.message }, { status: 500 });

    const linkMap: Record<string, string[]> = {};
    for (const l of links ?? []) {
      linkMap[l.modifier_group_id] = [...(linkMap[l.modifier_group_id] ?? []), l.catalog_item_id];
    }

    return NextResponse.json({
      success: true,
      groups: (groups ?? []).map((g: any) => ({
        id: g.id,
        name: g.name,
        selectionType: g.selection_type,
        minSelect: g.min_select,
        maxSelect: g.max_select,
        isRequired: g.is_required,
        status: g.status,
        options: (g.modifier_options ?? [])
          .sort((a: any, b: any) => a.display_order - b.display_order)
          .map((o: any) => ({
            id: o.id,
            name: o.name,
            priceDelta: Number(o.price_delta ?? 0),
            isDefault: o.is_default,
            isAvailable: o.is_available,
          })),
        catalogItemIds: linkMap[g.id] ?? [],
      })),
      catalogItems: (items ?? []).map((i: any) => ({ id: i.id, name: i.name, category: i.category_name })),
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? "غير مصرح" }, { status: 401 });
  }
}

const optionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  priceDelta: z.coerce.number().min(0).max(100000).default(0),
  isDefault: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
});

const groupSchema = z.object({
  name: z.string().trim().min(1, "اسم المجموعة مطلوب").max(80),
  selectionType: z.enum(["single", "multiple"]).default("single"),
  minSelect: z.coerce.number().int().min(0).max(20).default(0),
  maxSelect: z.coerce.number().int().min(1).max(20).default(1),
  isRequired: z.boolean().default(false),
  options: z.array(optionSchema).min(1, "أضف خيارًا واحدًا على الأقل").max(30),
  catalogItemIds: z.array(z.string()).max(200).default([]),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json().catch(() => ({}));
    const parsed = groupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" }, { status: 400 });
    }
    const supabase = await createClient();
    const g = parsed.data;

    const { data: group, error: gErr } = await (supabase as any)
      .from("modifier_groups")
      .insert({
        organization_id: user.organizationId,
        name: g.name,
        selection_type: g.selectionType,
        min_select: g.minSelect,
        max_select: g.maxSelect,
        is_required: g.isRequired,
        display_order: 0,
      })
      .select("id")
      .single();

    if (gErr) return NextResponse.json({ success: false, error: gErr.message }, { status: 500 });

    const optRows = g.options.map((o, i) => ({
      organization_id: user.organizationId,
      modifier_group_id: group.id,
      name: o.name,
      price_delta: o.priceDelta,
      is_default: o.isDefault,
      is_available: o.isAvailable,
      display_order: i,
    }));
    const { error: oErr } = await (supabase as any).from("modifier_options").insert(optRows);
    if (oErr) return NextResponse.json({ success: false, error: oErr.message }, { status: 500 });

    if (g.catalogItemIds.length > 0) {
      const linkRows = g.catalogItemIds.map((cid, i) => ({
        organization_id: user.organizationId,
        catalog_item_id: cid,
        modifier_group_id: group.id,
        display_order: i,
      }));
      const { error: lErr } = await (supabase as any).from("catalog_item_modifier_groups").insert(linkRows);
      if (lErr) return NextResponse.json({ success: false, error: lErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, groupId: group.id });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? "غير مصرح" }, { status: 401 });
  }
}

const updateSchema = groupSchema.partial().extend({
  id: z.string(),
  options: z.array(optionSchema.extend({ id: z.string().optional() })).max(30).optional(),
  catalogItemIds: z.array(z.string()).max(200).optional(),
});

export async function PUT(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" }, { status: 400 });
    }
    const supabase = await createClient();
    const g = parsed.data;
    const groupId = g.id;

    const { error: ownErr } = await (supabase as any)
      .from("modifier_groups")
      .select("id")
      .eq("organization_id", user.organizationId)
      .eq("id", groupId)
      .single();
    if (ownErr) return NextResponse.json({ success: false, error: "المجموعة غير موجودة" }, { status: 404 });

    const patch: any = {};
    if (g.name !== undefined) patch.name = g.name;
    if (g.selectionType !== undefined) patch.selection_type = g.selectionType;
    if (g.minSelect !== undefined) patch.min_select = g.minSelect;
    if (g.maxSelect !== undefined) patch.max_select = g.maxSelect;
    if (g.isRequired !== undefined) patch.is_required = g.isRequired;
    if (Object.keys(patch).length) {
      const { error: uErr } = await (supabase as any).from("modifier_groups").update(patch).eq("id", groupId);
      if (uErr) return NextResponse.json({ success: false, error: uErr.message }, { status: 500 });
    }

    if (g.options !== undefined) {
      const { error: dErr } = await (supabase as any).from("modifier_options").delete().eq("modifier_group_id", groupId);
      if (dErr) return NextResponse.json({ success: false, error: dErr.message }, { status: 500 });
      if (g.options.length) {
        const optRows = g.options.map((o: any, i: number) => ({
          organization_id: user.organizationId,
          modifier_group_id: groupId,
          name: o.name,
          price_delta: o.priceDelta ?? 0,
          is_default: o.isDefault ?? false,
          is_available: o.isAvailable ?? true,
          display_order: i,
        }));
        const { error: iErr } = await (supabase as any).from("modifier_options").insert(optRows);
        if (iErr) return NextResponse.json({ success: false, error: iErr.message }, { status: 500 });
      }
    }

    if (g.catalogItemIds !== undefined) {
      const { error: dlErr } = await (supabase as any)
        .from("catalog_item_modifier_groups")
        .delete()
        .eq("modifier_group_id", groupId);
      if (dlErr) return NextResponse.json({ success: false, error: dlErr.message }, { status: 500 });
      if (g.catalogItemIds.length) {
        const linkRows = g.catalogItemIds.map((cid: string, i: number) => ({
          organization_id: user.organizationId,
          catalog_item_id: cid,
          modifier_group_id: groupId,
          display_order: i,
        }));
        const { error: ilErr } = await (supabase as any).from("catalog_item_modifier_groups").insert(linkRows);
        if (ilErr) return NextResponse.json({ success: false, error: ilErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? "غير مصرح" }, { status: 401 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "معرف مفقود" }, { status: 400 });
    const supabase = await createClient();

    const { error: ownErr } = await (supabase as any)
      .from("modifier_groups")
      .select("id")
      .eq("organization_id", user.organizationId)
      .eq("id", id)
      .single();
    if (ownErr) return NextResponse.json({ success: false, error: "المجموعة غير موجودة" }, { status: 404 });

    const { error } = await (supabase as any).from("modifier_groups").delete().eq("id", id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message ?? "غير مصرح" }, { status: 401 });
  }
}
