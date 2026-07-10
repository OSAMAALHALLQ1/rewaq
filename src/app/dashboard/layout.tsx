import { ResponsivePageShell } from "@/components/layout/responsive-page-shell";
import { getCurrentSession } from "@/lib/auth/session";
import { getNotifications, getOrganizationContext } from "@/server/queries/app";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [session, context, notifications] = await Promise.all([
    getCurrentSession(),
    getOrganizationContext(),
    getNotifications(),
  ]);

  return (
    <ResponsivePageShell
      session={session}
      branches={context.branches}
      notifications={notifications}
    >
      {children}
    </ResponsivePageShell>
  );
}
