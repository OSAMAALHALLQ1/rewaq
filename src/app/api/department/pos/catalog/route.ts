import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateDepartmentDevice, requireDepartmentDeviceCapability } from "@/lib/department/auth";
import { demoCatalogItems, demoCatalogModifiers } from "@/lib/demo-data";
import { canUseDemoFallback } from "@/lib/supabase/env";

export async function GET(request: Request) {
  const auth = await authenticateDepartmentDevice(request, "pos");

  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  if (canUseDemoFallback()) {
    return NextResponse.json({
      success: true,
      device: auth.device,
      items: demoCatalogItems.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.categoryName ?? "عام",
        unit: item.mainUnit ?? "قطعة",
        price: Number(item.retailPrice ?? 0),
        taxRate: Number(item.taxRate ?? 0),
        barcodes: item.barcodes ?? [],
        stockQuantity: Number(item.stockQuantity ?? 0),
        imageUrl: item.imagePath ?? null,
        modifierGroups: demoCatalogModifiers[item.id] ?? [],
      })),
    });
  }

  // الإنتاج: جلب الأصناف + رصيد الفرع (عبر inventory_item_id) + الباركودات
  const branchId = auth.device.branchId;

  const { data: itemRows, error: itemError } = await auth.admin
    .from("catalog_items")
    .select(
      "id, code, name, category_name, main_unit, retail_price, tax_rate, status, image_path, image_url, inventory_item_id",
    )
    .eq("organization_id", auth.device.organizationId)
    .eq("status", "active")
    .order("name")
    .limit(200);

  if (itemError) {
    return NextResponse.json({ success: false, error: itemError.message }, { status: 500 });
  }

  const itemIds = (itemRows ?? []).map((item: any) => item.id);
  const inventoryItemIds = (itemRows ?? [])
    .map((item: any) => item.inventory_item_id)
    .filter(Boolean) as string[];

  // الباركودات
  const { data: barcodeRows } = itemIds.length
    ? await auth.admin
        .from("item_barcodes")
        .select("catalog_item_id, barcode")
        .eq("organization_id", auth.device.organizationId)
        .in("catalog_item_id", itemIds)
    : { data: [] };

  const barcodesByItem = new Map<string, string[]>();
  for (const row of barcodeRows ?? []) {
    barcodesByItem.set(row.catalog_item_id, [
      ...(barcodesByItem.get(row.catalog_item_id) ?? []),
      row.barcode,
    ]);
  }

  // أرصدة الفرع لأصناف الكتالوج المرتبطة بأصناف مخزون
  const stockByInventoryItem = new Map<string, number>();
  if (branchId && inventoryItemIds.length) {
    const { data: stockRows } = await auth.admin
      .from("branch_stock")
      .select("item_id, quantity")
      .eq("organization_id", auth.device.organizationId)
      .eq("branch_id", branchId)
      .in("item_id", inventoryItemIds);

    for (const row of stockRows ?? []) {
      stockByInventoryItem.set(row.item_id, Number(row.quantity ?? 0));
    }
  }

  // مجموعات الإضافات (Modifiers) المرتبطة بأصناف الكتالوج
  const modifierRows = (itemIds.length
    ? await auth.admin
        .from("catalog_item_modifier_groups")
        .select(
          "catalog_item_id, modifier_groups!inner(id, name, selection_type, min_select, max_select, is_required, display_order, status, modifier_options(id, name, price_delta, is_default, is_available, display_order))",
        )
        .eq("organization_id", auth.device.organizationId)
        .in("catalog_item_id", itemIds)
        .eq("modifier_groups.status", "active")
    : { data: [] }) as { data: any[] | null };

  const modifiersByItem = new Map<string, any[]>();
  for (const row of modifierRows.data ?? []) {
    const groups = (row.modifier_groups ?? []) as any[];
    const cleaned = groups
      .map((g) => ({
        id: g.id,
        name: g.name,
        selectionType: g.selection_type,
        minSelect: g.min_select,
        maxSelect: g.max_select,
        isRequired: g.is_required,
        displayOrder: Number(g.display_order ?? 0),
        options: (g.modifier_options ?? [])
          .filter((o: any) => o.is_available)
          .sort((a: any, b: any) => a.display_order - b.display_order)
          .map((o: any) => ({
            id: o.id,
            name: o.name,
            priceDelta: Number(o.price_delta ?? 0),
            isDefault: o.is_default,
          })),
      }))
      .filter((g) => g.options.length > 0)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    if (cleaned.length) modifiersByItem.set(row.catalog_item_id, cleaned);
  }

  return NextResponse.json({
    success: true,
    device: auth.device,
    items: (itemRows ?? []).map((item: any) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      category: item.category_name ?? "عام",
      unit: item.main_unit ?? "قطعة",
      price: Number(item.retail_price ?? 0),
      taxRate: Number(item.tax_rate ?? 0),
      barcodes: barcodesByItem.get(item.id) ?? [],
      // رصيد الفرع إن كان الصنف مرتبطاً بصنف مخزون؛ وإلا null (يُخصم عبر الوصفة).
      stockQuantity: item.inventory_item_id
        ? stockByInventoryItem.get(item.inventory_item_id) ?? 0
        : null,
      imageUrl: item.image_url ?? item.image_path ?? null,
      modifierGroups: modifiersByItem.get(item.id) ?? [],
    })),
  });
}

// ── إنشاء صنف جديد من شاشة الكاشير ──
const createItemSchema = z.object({
  name: z.string().trim().min(2, "اسم الصنف مطلوب (حرفان على الأقل)").max(120),
  price: z.coerce.number().min(0, "السعر يجب أن يكون صفرًا أو أكثر"),
  category: z.string().trim().max(60).optional(),
  unit: z.string().trim().max(30).optional(),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  barcode: z.string().trim().max(64).optional(),
});

export async function POST(request: Request) {
  const auth = await authenticateDepartmentDevice(request, "pos");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const cap = requireDepartmentDeviceCapability(auth, "pos_write");
  if (!cap.ok) {
    return NextResponse.json({ success: false, error: cap.error }, { status: cap.status });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "بيانات الصنف غير صحيحة" },
      { status: 400 },
    );
  }

  const { name, price, category, unit, taxRate, barcode } = parsed.data;
  const code = `POS-${Date.now().toString(36).toUpperCase()}`;

  if (canUseDemoFallback()) {
    const demoItem = {
      id: `catalog-pos-${Date.now()}`,
      organizationId: auth.device.organizationId,
      code,
      name,
      barcodes: barcode ? [barcode] : [],
      categoryName: category || "عام",
      mainUnit: unit || "قطعة",
      units: [{ name: unit || "قطعة", factor: 1 }],
      purchasePrice: 0,
      retailPrice: price,
      wholesalePrice: price,
      branchPrice: price,
      customerPrice: price,
      minimumQuantity: 0,
      taxRate,
      isActive: true,
    };
    demoCatalogItems.push(demoItem as any);
    return NextResponse.json({
      success: true,
      item: {
        id: demoItem.id,
        code,
        name,
        category: demoItem.categoryName,
        unit: demoItem.mainUnit,
        price,
        taxRate,
        barcodes: demoItem.barcodes,
        stockQuantity: null,
        imageUrl: null,
      },
    });
  }

  const { data: created, error } = await auth.admin
    .from("catalog_items")
    .insert({
      organization_id: auth.device.organizationId,
      branch_id: auth.device.branchId || null,
      code,
      name,
      category_name: category || "عام",
      main_unit: unit || "قطعة",
      retail_price: price,
      tax_rate: taxRate,
      status: "active",
    })
    .select("id, code, name, category_name, main_unit, retail_price, tax_rate")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (barcode) {
    await auth.admin.from("item_barcodes").insert({
      organization_id: auth.device.organizationId,
      catalog_item_id: created.id,
      barcode,
    });
  }

  return NextResponse.json({
    success: true,
    item: {
      id: created.id,
      code: created.code,
      name: created.name,
      category: created.category_name ?? "عام",
      unit: created.main_unit ?? "قطعة",
      price: Number(created.retail_price ?? 0),
      taxRate: Number(created.tax_rate ?? 0),
      barcodes: barcode ? [barcode] : [],
      stockQuantity: null,
      imageUrl: null,
    },
  });
}
