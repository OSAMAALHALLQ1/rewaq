"use server";

import { revalidatePath } from "next/cache";
import { isDemoMode, withAdminScope } from "../queries/_shared/utils";
import { demoRestaurantTables } from "@/lib/demo-data";
import type { RestaurantTable, RestaurantTableStatus } from "@/types/domain";

type TableActionResult = { success: boolean; error?: string; table?: RestaurantTable };

// Helper to find/update in-memory demo data
function updateDemoTable(tableId: string, updates: Partial<any>) {
  const table = demoRestaurantTables.find(t => t.id === tableId);
  if (table) {
    Object.assign(table, updates);
    return true;
  }
  return false;
}

export async function createRestaurantTable(
  branchId: string,
  number: number,
  zone: string,
  seats: number,
): Promise<TableActionResult> {
  const normalizedNumber = Math.floor(number);
  const normalizedSeats = Math.floor(seats);
  if (!branchId || !Number.isFinite(normalizedNumber) || normalizedNumber < 1 || !Number.isFinite(normalizedSeats) || normalizedSeats < 1) {
    return { success: false, error: "أدخل رقم طاولة وعدد مقاعد صحيحين" };
  }

  if (isDemoMode()) {
    const branch = demoRestaurantTables.find((table) => table.branchId === branchId);
    const table = {
      id: crypto.randomUUID(), organizationId: branch?.organizationId ?? "org-demo", branchId,
      branchName: branch?.branchName ?? "الفرع", number: normalizedNumber, zone: zone.trim() || "الصالة",
      seats: normalizedSeats, status: "available" as const, currentTotal: 0, orderItems: [],
    };
    demoRestaurantTables.push(table);
    revalidatePath("/dashboard/tables");
    return { success: true, table };
  }

  return withAdminScope<TableActionResult>({ success: false, error: "لا يمكن الاتصال بقاعدة البيانات" }, async (admin, scope) => {
    const { data: branch, error: branchError } = await admin
      .from("branches")
      .select("id, name")
      .eq("id", branchId)
      .eq("organization_id", scope.organizationId)
      .maybeSingle();
    if (branchError || !branch) return { success: false, error: "الفرع المحدد غير متاح للمؤسسة الحالية" };

    const { data: row, error } = await admin
      .from("restaurant_tables")
      .insert({ organization_id: scope.organizationId, branch_id: branchId, number: normalizedNumber, zone: zone.trim() || "الصالة", seats: normalizedSeats, status: "available" })
      .select("id, organization_id, branch_id, number, zone, seats, status, current_total")
      .single();
    if (error || !row) return { success: false, error: error?.message ?? "تعذر إنشاء الطاولة" };

    revalidatePath("/dashboard/tables");
    return {
      success: true,
      table: {
        id: row.id, organizationId: row.organization_id, branchId: row.branch_id, branchName: branch.name,
        number: Number(row.number), zone: row.zone, seats: row.seats, status: "available",
        currentTotal: Number(row.current_total), orderItems: [],
      },
    };
  });
}

export async function openTableSession(tableId: string, waiterName: string, guests: number): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) {
    updateDemoTable(tableId, {
      status: "occupied",
      waiterName,
      guests,
      openedAt: new Date().toISOString(),
      currentTotal: 0,
      orderItems: [],
    });
    revalidatePath("/dashboard/tables");
    return { success: true };
  }

  return withAdminScope<{ success: boolean; error?: string }>({ success: false, error: "لا يمكن الاتصال بقاعدة البيانات" }, async (admin, scope) => {
    const { error } = await admin
      .from("restaurant_tables")
      .update({
        status: "occupied",
        waiter_name: waiterName,
        guests: guests,
        opened_at: new Date().toISOString(),
        current_total: 0,
      })
      .eq("id", tableId)
      .eq("organization_id", scope.organizationId);

    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/tables");
    return { success: true };
  });
}

export async function updateTableStatus(tableId: string, status: RestaurantTableStatus): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) {
    const updates: Partial<any> = { status };
    if (status === "available") {
      updates.waiterName = undefined;
      updates.guests = undefined;
      updates.openedAt = undefined;
      updates.currentTotal = 0;
      updates.orderItems = [];
    }
    updateDemoTable(tableId, updates);
    revalidatePath("/dashboard/tables");
    return { success: true };
  }

  return withAdminScope<{ success: boolean; error?: string }>({ success: false, error: "لا يمكن الاتصال بقاعدة البيانات" }, async (admin, scope) => {
    const updates: Record<string, any> = { status };
    if (status === "available") {
      updates.waiter_name = null;
      updates.guests = null;
      updates.opened_at = null;
      updates.current_total = 0;
    }

    const { error } = await admin
      .from("restaurant_tables")
      .update(updates)
      .eq("id", tableId)
      .eq("organization_id", scope.organizationId);

    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/tables");
    return { success: true };
  });
}

export async function mergeTables(sourceTableId: string, targetTableId: string): Promise<{ success: boolean; error?: string }> {
  if (isDemoMode()) {
    const src = demoRestaurantTables.find(t => t.id === sourceTableId);
    const tgt = demoRestaurantTables.find(t => t.id === targetTableId);
    if (src && tgt) {
      tgt.currentTotal = (tgt.currentTotal || 0) + (src.currentTotal || 0);
      tgt.orderItems = [...(tgt.orderItems || []), ...(src.orderItems || [])];
      tgt.status = "occupied";

      src.status = "available";
      src.currentTotal = 0;
      src.orderItems = [];
      src.waiterName = undefined;
      src.guests = undefined;
      src.openedAt = undefined;
    }
    revalidatePath("/dashboard/tables");
    return { success: true };
  }

  return withAdminScope<{ success: boolean; error?: string }>({ success: false, error: "لا يمكن الاتصال بقاعدة البيانات" }, async (admin, scope) => {
    // 1. Get totals
    const { data: src, error: sourceError } = await admin.from("restaurant_tables").select("current_total").eq("id", sourceTableId).eq("organization_id", scope.organizationId).single();
    const { data: tgt, error: targetError } = await admin.from("restaurant_tables").select("current_total").eq("id", targetTableId).eq("organization_id", scope.organizationId).single();

    if (sourceError || !src || targetError || !tgt) {
      return { success: false, error: "تعذر العثور على الطاولتين ضمن المؤسسة الحالية" };
    }

    const srcTotal = Number(src?.current_total || 0);
    const tgtTotal = Number(tgt?.current_total || 0);

    // 2. Add to target, clean source
    const [res1, res2] = await Promise.all([
      admin.from("restaurant_tables").update({ current_total: tgtTotal + srcTotal, status: "occupied" }).eq("id", targetTableId).eq("organization_id", scope.organizationId),
      admin.from("restaurant_tables").update({ current_total: 0, status: "available", waiter_name: null, guests: null, opened_at: null }).eq("id", sourceTableId).eq("organization_id", scope.organizationId),
    ]);

    if (res1.error) return { success: false, error: res1.error.message };
    if (res2.error) return { success: false, error: res2.error.message };

    revalidatePath("/dashboard/tables");
    return { success: true };
  });
}

export async function getTableDetails(tableId: string): Promise<{ success: boolean; table?: any; error?: string }> {
  if (isDemoMode()) {
    const table = demoRestaurantTables.find(t => t.id === tableId);
    if (!table) return { success: false, error: "الطاولة غير موجودة" };
    return { success: true, table };
  }

  return withAdminScope<{ success: boolean; table?: any; error?: string }>({ success: false, error: "لا يمكن الاتصال بقاعدة البيانات" }, async (admin, scope) => {
    const { data: table, error } = await admin
      .from("restaurant_tables")
      .select("*")
      .eq("id", tableId)
      .eq("organization_id", scope.organizationId)
      .single();

    if (error || !table) return { success: false, error: error?.message || "الطاولة غير موجودة" };

    const mappedTable = {
      id: table.id,
      organizationId: table.organization_id,
      branchId: table.branch_id,
      number: Number(table.number ?? table.name ?? 0),
      zone: table.zone ?? "الصالة",
      seats: table.seats ?? table.capacity ?? 4,
      status: table.status ?? "available",
      openedAt: table.opened_at ?? undefined,
      waiterName: table.waiter_name ?? undefined,
      guests: table.guests ?? undefined,
      currentTotal: Number(table.current_total || 0),
      orderItems: [],
    };

    return { success: true, table: mappedTable };
  });
}
