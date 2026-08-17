import { ModuleLocked } from "@/components/billing/module-locked";
import { canRoleAccessPath, roleHomePath } from "@/lib/auth/route-access";
import { getCurrentSession } from "@/lib/auth/session";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  checkDashboardModuleAccess,
  REWAQ_PATHNAME_HEADER,
} from "@/server/billing/module-gate";

// A template (unlike the layout) re-renders on every navigation, so the plan
// gate runs for soft client-side transitions too, not just full page loads.
export default async function DashboardTemplate({ children }: { children: React.ReactNode }) {
  const [session, requestHeaders] = await Promise.all([getCurrentSession(), headers()]);
  const pathname = requestHeaders.get(REWAQ_PATHNAME_HEADER) ?? "/dashboard";

  if (!canRoleAccessPath(session.role, pathname)) {
    redirect(roleHomePath(session.role));
  }

  const moduleAccess = await checkDashboardModuleAccess();

  if (!moduleAccess.allowed) {
    return (
      <ModuleLocked
        moduleLabel={moduleAccess.moduleLabel}
        currentPlanName={moduleAccess.currentPlanName}
        requiredPlanName={moduleAccess.requiredPlanName}
        verificationFailed={moduleAccess.verificationFailed}
        canManageBilling={
          session.role === "organization_owner" || session.role === "super_admin"
        }
        returnHref={pathname === roleHomePath(session.role) ? null : roleHomePath(session.role)}
      />
    );
  }

  return <>{children}</>;
}
