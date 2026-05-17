import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { getCurrentSession } from "@/lib/auth/session";
import { getNotifications, getOrganizationContext } from "@/server/queries/app";

export async function PageShell({
  children,
  mode = "app",
}: {
  children: React.ReactNode;
  mode?: "app" | "admin";
}) {
  const [session, context, notifications] = await Promise.all([
    getCurrentSession(),
    getOrganizationContext(),
    getNotifications(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <AppSidebar mode={mode} />
        <div className="min-w-0 flex-1">
          <AppHeader session={session} branches={context.branches} notifications={notifications} />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
