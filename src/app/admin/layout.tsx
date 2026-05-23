import { PageShellClient } from "@/components/layout/page-shell";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { getNotifications, getOrganizationContext } from "@/server/queries/app";
import type { AppSession } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminSession = await requireAdminSession();

  const [context, notifications] = await Promise.all([
    getOrganizationContext(),
    getNotifications(),
  ]);

  const sessionMock: AppSession = {
    user: {
      id: "admin-local",
      email: "admin@local",
      name: adminSession.username,
    },
    organizationId: context.organization.id,
    organizationName: context.organization.name,
    role: "super_admin",
  };

  return (
    <PageShellClient
      session={sessionMock}
      branches={context.branches}
      notifications={notifications}
      mode="admin"
    >
      {children}
    </PageShellClient>
  );
}
