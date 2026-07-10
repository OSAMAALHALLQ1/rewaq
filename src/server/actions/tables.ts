"use server";

import { revalidatePath } from "next/cache";
import { isDemoMode, withAdminScope } from "../queries/_shared/utils";
import { demoRestaurantTables } from "@/lib/demo-data";
import type { RestaurantTableStatus } from "@/types/domain";

// Helper to find/update in-memory demo data
function updateDemoTable(tableId: string, updates: Partial<any>) {
  const table = demoRestaurantTables.find(t => t.id === tableId);
  if (table) {
    Object.assign(table, updates);
    return true;
  }
  return false;
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

  return withAdminScope<{ success: boolean; error?: string }>({ success: false, error: "لا يمكن الاتصال بقاعدة البيانات" }, async (admin) => {
    const { error } = await admin
      .from("restaurant_tables")
      .update({
        status: "occupied",
        waiter_name: waiterName,
        guests: guests,
        opened_at: new Date().toISOString(),
        current_total: 0,
      })
      .eq("id", tableId);

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

  return withAdminScope<{ success: boolean; error?: string }>({ success: false, error: "لا يمكن الاتصال بقاعدة البيانات" }, async (admin) => {
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
      .eq("id", tableId);

    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/tables");
    return { success: true };
  });
}

export async function addOrderToTable(tableId: string, items: Array<{ name: string; quantity: number; price: number }>): Promise<{ success: boolean; error?: string }> {
  const newTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (isDemoMode()) {
    const table = demoRestaurantTables.find(t => t.id === tableId);
    if (table) {
      const existingItems = table.orderItems || [];
      for (const item of items) {
        const exist = existingItems.find(i => i.name === item.name);
        if (exist) {
          exist.quantity += item.quantity;
          exist.total += item.price * item.quantity;
        } else {
          existingItems.push({ name: item.name, quantity: item.quantity, total: item.price * item.quantity });
        }
      }
      table.orderItems = existingItems;
      table.currentTotal = (table.currentTotal || 0) + newTotal;
      table.status = "occupied";
    }
    revalidatePath("/dashboard/tables");
    return { success: true };
  }

  return withAdminScope<{ success: boolean; error?: string }>({ success: false, error: "لا يمكن الاتصال بقاعدة البيانات" }, async (admin) => {
    // Get existing table total
    const { data: tableData } = await admin
      .from("restaurant_tables")
      .select("current_total, status")
      .eq("id", tableId)
      .single();

    const currentTotal = Number(tableData?.current_total || 0);

    const { error } = await admin
      .from("restaurant_tables")
      .update({
        current_total: currentTotal + newTotal,
        status: "occupied",
      })
      .eq("id", tableId);

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

  return withAdminScope<{ success: boolean; error?: string }>({ success: false, error: "لا يمكن الاتصال بقاعدة البيانات" }, async (admin) => {
    // 1. Get totals
    const { data: src } = await admin.from("restaurant_tables").select("current_total").eq("id", sourceTableId).single();
    const { data: tgt } = await admin.from("restaurant_tables").select("current_total").eq("id", targetTableId).single();

    const srcTotal = Number(src?.current_total || 0);
    const tgtTotal = Number(tgt?.current_total || 0);

    // 2. Add to target, clean source
    const [res1, res2] = await Promise.all([
      admin.from("restaurant_tables").update({ current_total: tgtTotal + srcTotal, status: "occupied" }).eq("id", targetTableId),
      admin.from("restaurant_tables").update({ current_total: 0, status: "available", waiter_name: null, guests: null, opened_at: null }).eq("id", sourceTableId),
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

  return withAdminScope<{ success: boolean; table?: any; error?: string }>({ success: false, error: "لا يمكن الاتصال بقاعدة البيانات" }, async (admin) => {
    const { data: table, error } = await admin
      .from("restaurant_tables")
      .select("*")
      .eq("id", tableId)
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
