import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getCostCentersData } from "@/server/queries/accounting-erp";
import { CostCentersClient } from "@/components/accounting/cost-centers-client";

export default async function CostCentersPage() {
  const session = await getCurrentSession();

  // Allow super_admin, organization_owner, and accountant
  if (!["super_admin", "organization_owner", "accountant"].includes(session.role)) {
    redirect("/dashboard/accounting");
  }

  const data = await getCostCentersData();

  return (
    <>
      <PageHeader
        title="مراكز التكلفة (Cost Centers)"
        description="تتبع نفقات وإيرادات المطعم موزعة على أقسام معينة (المطبخ، الصالة، التوصيل) لقياس كفاءة كل قسم بشكل مستقل."
      />
      <div className="mt-4">
        <CostCentersClient data={data} />
      </div>
    </>
  );
}
