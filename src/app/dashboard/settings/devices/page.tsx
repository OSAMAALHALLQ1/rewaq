import { getCurrentSession } from "@/lib/auth/session";
import { getOrganizationContext } from "@/server/queries/app";
import { DevicesClient } from "@/components/devices/devices-client";

export default async function SettingsDevicesPage() {
  // Safe server-side extraction to guarantee key-generation never fails
  const session = await getCurrentSession();
  const context = await getOrganizationContext();

  return (
    <DevicesClient
      orgId={session.organizationId}
      branches={context.branches}
      currentRole={session.role}
      currentName={session.user.name}
    />
  );
}
