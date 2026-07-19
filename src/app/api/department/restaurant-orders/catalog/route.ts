import { NextResponse } from "next/server";
import { authenticateDepartmentDevice } from "@/lib/department/auth";
import { demoCatalogItems } from "@/lib/demo-data";
import { canUseDemoFallback } from "@/lib/supabase/env";

export async function GET(request: Request) {
  const auth = await authenticateDepartmentDevice(request, "waiter");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  if (!auth.device.branchId) {
    return NextResponse.json(
      { success: false, error: "جهاز النادل يجب أن يكون مربوطاً بفرع محدد." },
      { status: 403 },
    );
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
        imageUrl: item.imagePath ?? null,
      })),
      tables: [
        { id: "00000000-0000-4000-8000-000000000201", number: 1, name: "طاولة 1", zone: "الصالة", seats: 4, status: "available" },
        { id: "00000000-0000-4000-8000-000000000202", number: 2, name: "طاولة 2", zone: "الصالة", seats: 4, status: "available" },
      ],
      stations: [
        { id: "00000000-0000-4000-8000-000000000301", code: "main", name: "المطبخ الرئيسي", displayOrder: 0 },
      ],
    });
  }

  const organizationId = auth.device.organizationId;
  const branchId = auth.device.branchId;
  const [itemsResult, tablesResult, stationsResult] = await Promise.all([
    auth.admin
      .from("catalog_items")
      .select("id, code, name, category_name, main_unit, retail_price, branch_price, tax_rate, image_path, image_url")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .or(`branch_id.is.null,branch_id.eq.${branchId}`)
      .order("category_name")
      .order("name")
      .limit(500),
    auth.admin
      .from("restaurant_tables")
      .select("id, number, name, zone, seats, status")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .order("zone")
      .order("number")
      .limit(300),
    auth.admin
      .from("kitchen_stations")
      .select("id, code, name, display_order")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .order("display_order")
      .order("name"),
  ]);

  const queryError = itemsResult.error ?? tablesResult.error ?? stationsResult.error;
  if (queryError) {
    console.error("Waiter catalog query failed:", queryError);
    return NextResponse.json(
      { success: false, error: "تعذر تحميل المنيو والطاولات ومحطات التحضير." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    device: auth.device,
    items: (itemsResult.data ?? []).map((item: any) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      category: item.category_name ?? "عام",
      unit: item.main_unit ?? "قطعة",
      price: Number(item.branch_price ?? item.retail_price ?? 0),
      taxRate: Number(item.tax_rate ?? 0),
      imageUrl: item.image_url ?? item.image_path ?? null,
    })),
    tables: (tablesResult.data ?? []).map((table: any) => ({
      id: table.id,
      number: table.number,
      name: table.name || `طاولة ${table.number}`,
      zone: table.zone,
      seats: table.seats,
      status: table.status,
    })),
    stations: (stationsResult.data ?? []).map((station: any) => ({
      id: station.id,
      code: station.code,
      name: station.name,
      displayOrder: station.display_order,
    })),
  });
}
