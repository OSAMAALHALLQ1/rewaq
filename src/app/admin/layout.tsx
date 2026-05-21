import { PageShellClient } from "@/components/layout/page-shell";
import { getCurrentSession } from "@/lib/auth/session";
import { getNotifications, getOrganizationContext } from "@/server/queries/app";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();

  if (session.role !== "super_admin") {
    redirect("/dashboard");
  }

  const [context, notifications] = await Promise.all([
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
