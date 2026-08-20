import PermissionsWorkspaceClient from "@/components/dashboard/permissions-workspace";
import { getTeamAccessWorkspaceData } from "@/server/queries/team-access";

export default async function UsersRolesPage() {
  const data = await getTeamAccessWorkspaceData();
  return <PermissionsWorkspaceClient {...data} />;
}
