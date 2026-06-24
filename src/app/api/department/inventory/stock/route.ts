import { NextResponse } from "next/server";
import { authenticateDepartmentDevice } from "@/lib/department/auth";

type StockRow = {
  item_id: string;
  branch_id: string;
  quantity: number | string | null;
  reserved_quantity: number | string | null;
};

type ItemRow = {
  id: string;
  name: string;
  sku: string | null;
  minimum_quantity: number | string | null;
  average_cost: number | string | null;
  status: string;
  units: { name: string | null } | { name: string | null }[] | null;
  inventory_categories: { name: string | null } | { name: string | null }[] | null;
};

async function resolveBranchId(auth: Awaited<ReturnType<typeof authenticateDepartmentDevice>>) {
  if (!auth.ok) return null;
  if (auth.device.branchId) return auth.device.branchId;

  const { data } = await auth.admin
    .from("branches")
    .select("id")
    .eq("organization_id", auth.device.organizationId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstRelated<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function GET(request: Request) {
  const auth = await authenticateDepartmentDevice(request, "inventory");

  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const branchId = await resolveBranchId(auth);
  if (!branchId) {
    return NextResponse.json({ success: false, error: "لا يوجد فرع مربوط بجهاز المستودع." }, { status: 400 });
  }

  const [itemsResult, stockResult] = await Promise.all([
    auth.admin
      .from("inventory_items")
      .select(
        `
        id,
        name,
        sku,
        minimum_quantity,
        average_cost,
        status,
        units:usage_unit_id ( name ),
        inventory_categories:category_id ( name )
      `,
      )
      .eq("organization_id", auth.device.organizationId)
      .eq("status", "active")
      .order("name")
      .limit(500),
    auth.admin
      .from("branch_stock")
      .select("item_id, branch_id, quantity, reserved_quantity")
      .eq("organization_id", auth.device.organizationId)
      .eq("branch_id", branchId),
  ]);

  if (itemsResult.error) {
    return NextResponse.json({ success: false, error: itemsResult.error.message }, { status: 500 });
  }

  if (stockResult.error) {
    return NextResponse.json({ success: false, error: stockResult.error.message }, { status: 500 });
  }

  const stockByItem = new Map<string, StockRow>();
  for (const row of (stockResult.data ?? []) as StockRow[]) {
    stockByItem.set(row.item_id, row);
  }

  const items = ((itemsResult.data ?? []) as unknown as ItemRow[]).map((item) => {
    const stock = stockByItem.get(item.id);
    const quantity = numeric(stock?.quantity);
    const reservedQuantity = numeric(stock?.reserved_quantity);
    const minimum = numeric(item.minimum_quantity);
    const availableQuantity = quantity - reservedQuantity;
    const averageCost = numeric(item.average_cost);
    const usageUnit = firstRelated(item.units);
    const category = firstRelated(item.inventory_categories);

    return {
      id: item.id,
      name: item.name,
      sku: item.sku,
      category: category?.name ?? "بدون تصنيف",
      unit: usageUnit?.name ?? "وحدة",
      quantity,
      reservedQuantity,
      availableQuantity,
      minimum,
      averageCost,
      value: quantity * averageCost,
      status: availableQuantity <= minimum ? "low" : "ok",
    };
  });

  return NextResponse.json({
    success: true,
    device: auth.device,
    branchId,
    items,
    totals: {
      itemsCount: items.length,
      lowStockCount: items.filter((item) => item.status === "low").length,
      totalValue: items.reduce((sum, item) => sum + item.value, 0),
    },
  });
}
