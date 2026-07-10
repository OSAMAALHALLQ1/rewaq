import { getTablesData } from "@/server/queries/app";
import TablesWorkspaceClient from "@/components/dashboard/tables-workspace";
import type { RestaurantTable } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function TablesPage() {
  let tables: RestaurantTable[] = [];
  let branches: Array<{ id: string; name: string }> = [];
  try {
    const data = await getTablesData();
    tables = data.tables;
    branches = data.branches;
  } catch (error) {
    console.error("[tables page]", error);
  }

  return (
    <TablesWorkspaceClient
      initialTables={tables}
      branches={branches}
    />
  );
}
