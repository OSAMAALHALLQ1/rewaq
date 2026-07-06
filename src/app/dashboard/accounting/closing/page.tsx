import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getAccountingPeriodsData } from "@/server/queries/accounting-erp";
import { ClosingClient } from "@/components/accounting/closing-client";

export default async function MonthlyClosingPage() {
  const session = await getCurrentSession();

  // Allow super_admin, organization_owner, and accountant
  if (!["super_admin", "organization_owner", "accountant"].includes(session.role)) {
    redirect("/dashboard/accounting");
  }

  const data = await getAccountingPeriodsData();

  return (
    <>
      <PageHeader
        title="الإقفال المحاسبي الشهري"
        description="إدارة وإقفال الفترات المحاسبية الشهرية لمنع التعديل على الحسابات التاريخية بعد إصدار القوائم المالية."
      />
      <div className="mt-4">
        <ClosingClient data={data} />
      </div>
    </>
  );
}
