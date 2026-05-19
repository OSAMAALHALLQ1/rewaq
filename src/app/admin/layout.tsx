import { PageShellClient } from "@/components/layout/page-shell";
import { getCurrentSession } from "@/lib/auth/session";
import { getNotifications, getOrganizationContext } from "@/server/queries/app";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [session, context, notifications] = await Promise.all([
    getCurrentSession(),
    getOrganizationContext(),
    getNotifications(),
  ]);

  return (
    <PageShellClient
      session={session}
      branches={context.branches}
      notifications={notifications}
      mode="admin"
    >
      {children}
    </PageShellClient>
  );
}
