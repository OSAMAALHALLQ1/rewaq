import { getTablesData } from "@/server/queries/app";
import TablesWorkspaceClient from "@/components/dashboard/tables-workspace";

export default async function TablesPage() {
  const { tables, branches } = await getTablesData();

  return (
    <TablesWorkspaceClient
      initialTables={tables}
      branches={branches}
    />
  );
}
