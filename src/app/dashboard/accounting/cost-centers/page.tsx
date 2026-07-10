import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getCostCentersData } from "@/server/queries/accounting-erp";
import { CostCentersClient } from "@/components/accounting/cost-centers-client";
import { PeriodFilter } from "@/components/accounting/report-filters";

type Props = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function CostCentersPage({ searchParams }: Props) {
  const session = await getCurrentSession();

  // Allow super_admin, organization_owner, and accountant
  if (!["super_admin", "organization_owner", "accountant"].includes(session.role)) {
    redirect("/dashboard/accounting");
  }

  const params = await searchParams;
  const data = await getCostCentersData({ from: params.from || undefined, to: params.to || undefined });

  return (
    <>
      <PageHeader
        title="مراكز التكلفة (Cost Centers)"
        description="ربحية كل قسم (صالة، توصيل، مطبخ...) من واقع أسطر القيود: إيرادات، تكلفة بضاعة، مصروفات وصافي ربح لكل مركز."
      />
      <div className="mt-4 space-y-4" dir="rtl">
        <PeriodFilter basePath="/dashboard/accounting/cost-centers" from={data.from} to={data.to} />
        <CostCentersClient data={data} />
      </div>
    </>
  );
}
