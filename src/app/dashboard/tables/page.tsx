import { getTablesData } from "@/server/queries/app";
import TablesWorkspaceClient from "@/components/dashboard/tables-workspace";
import type { RestaurantTable } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function TablesPage() {
  let tables: RestaurantTable[] = [];
  let branches: Array<{ id: string; name: string }> = [];
  let loadError: string | null = null;
  try {
    const data = await getTablesData();
    tables = data.tables;
    branches = data.branches;
  } catch (error) {
    console.error("[tables page]", error);
    loadError = "تعذر تحميل بيانات الطاولات. تحقق من الاتصال والصلاحيات ثم أعد المحاولة.";
  }

  return (
    <TablesWorkspaceClient
      initialTables={tables}
      branches={branches}
      initialLoadError={loadError}
    />
  );
}
