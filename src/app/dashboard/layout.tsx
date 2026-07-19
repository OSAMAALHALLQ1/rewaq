import { ResponsivePageShell } from "@/components/layout/responsive-page-shell";
import { getCurrentSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getOrganizationPlanSelection } from "@/server/billing/plan-selection";
import { getNotifications, getOrganizationContext } from "@/server/queries/app";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  const planSelection = await getOrganizationPlanSelection({
    email: session.user.email,
    organizationId: session.organizationId,
  });

  if (!planSelection.selected) {
    redirect("/select-plan");
  }

  const [context, notifications] = await Promise.all([
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
