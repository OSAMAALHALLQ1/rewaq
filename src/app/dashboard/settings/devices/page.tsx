import { getCurrentSession } from "@/lib/auth/session";
import { getOrganizationContext } from "@/server/queries/app";
import { DevicesClient } from "@/components/devices/devices-client";

export default async function SettingsDevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // Safe server-side extraction to guarantee key-generation never fails
  const session = await getCurrentSession();
  const context = await getOrganizationContext();
  const params = await searchParams;
  const initialTab = params.tab === "staff" ? "staff" : "list";

  return (
    <DevicesClient
      key={initialTab}
      orgId={session.organizationId}
      branches={context.branches}
      currentRole={session.role}
      currentName={session.user.name}
      initialTab={initialTab}
    />
  );
}
