import { NextResponse } from "next/server";
import { authenticateDepartmentDevice } from "@/lib/department/auth";
import { demoCatalogItems } from "@/lib/demo-data";
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
    })),
  });
}
