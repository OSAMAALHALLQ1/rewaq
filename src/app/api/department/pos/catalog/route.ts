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
      })),
    });
  }

  const { data: itemRows, error: itemError } = await auth.admin
    .from("catalog_items")
    .select("id, code, name, category_name, main_unit, retail_price, tax_rate, status")
    .eq("organization_id", auth.device.organizationId)
    .eq("status", "active")
    .order("name")
    .limit(200);

  if (itemError) {
    return NextResponse.json({ success: false, error: itemError.message }, { status: 500 });
  }

  const itemIds = (itemRows ?? []).map((item) => item.id);
  const { data: barcodeRows } = itemIds.length
    ? await auth.admin
        .from("item_barcodes")
        .select("catalog_item_id, barcode")
        .eq("organization_id", auth.device.organizationId)
        .in("catalog_item_id", itemIds)
    : { data: [] };

  const barcodesByItem = new Map<string, string[]>();
  for (const row of barcodeRows ?? []) {
    barcodesByItem.set(row.catalog_item_id, [...(barcodesByItem.get(row.catalog_item_id) ?? []), row.barcode]);
  }

  return NextResponse.json({
    success: true,
    device: auth.device,
    items: (itemRows ?? []).map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      category: item.category_name ?? "عام",
      unit: item.main_unit ?? "قطعة",
      price: Number(item.retail_price ?? 0),
      taxRate: Number(item.tax_rate ?? 0),
      barcodes: barcodesByItem.get(item.id) ?? [],
    })),
  });
}
