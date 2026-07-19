import { ModuleLocked } from "@/components/billing/module-locked";
import { checkDashboardModuleAccess } from "@/server/billing/module-gate";

// A template (unlike the layout) re-renders on every navigation, so the plan
// gate runs for soft client-side transitions too, not just full page loads.
export default async function DashboardTemplate({ children }: { children: React.ReactNode }) {
  const moduleAccess = await checkDashboardModuleAccess();

  if (!moduleAccess.allowed) {
    return (
      <ModuleLocked
        moduleLabel={moduleAccess.moduleLabel}
        currentPlanName={moduleAccess.currentPlanName}
        requiredPlanName={moduleAccess.requiredPlanName}
        verificationFailed={moduleAccess.verificationFailed}
      />
    );
  }

  return <>{children}</>;
}
