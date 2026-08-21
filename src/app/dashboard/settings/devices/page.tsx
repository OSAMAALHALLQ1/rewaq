import { getCurrentSession } from "@/lib/auth/session";
import { getOrganizationContext } from "@/server/queries/app";
import { DevicesClient } from "@/components/devices/devices-client";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function SettingsDevicesPage() {
  // Safe server-side extraction to guarantee key-generation never fails
  const session = await getCurrentSession();
  const context = await getOrganizationContext();
  const { data: stations } = await createAdminClient()
    .from("kitchen_stations")
    .select("id,branch_id,name,is_active")
    .eq("organization_id", session.organizationId)
    .order("name");

  return (
    <DevicesClient
      orgId={session.organizationId}
      branches={context.branches}
      initialStations={(stations ?? []).map((station) => ({ id: station.id, branchId: station.branch_id, name: station.name, isActive: station.is_active }))}
      currentRole={session.role}
      currentName={session.user.name}
      initialTab="list"
    />
  );
}
