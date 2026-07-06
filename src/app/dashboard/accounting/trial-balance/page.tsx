import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getTrialBalanceData } from "@/server/queries/accounting-erp";
import { TrialBalanceClient } from "@/components/accounting/trial-balance-client";

type Props = {
  searchParams: Promise<{ from?: string; to?: string }>;
};

export default async function TrialBalancePage({ searchParams }: Props) {
  const session = await getCurrentSession();

  // Allow only super_admin, organization_owner, and accountant
  if (!["super_admin", "organization_owner", "accountant"].includes(session.role)) {
    redirect("/dashboard/accounting");
  }

  const filters = await searchParams;
  const data = await getTrialBalanceData({
    from: filters.from || undefined,
    to: filters.to || undefined,
  });

  return (
    <>
      <PageHeader
        title="تقرير ميزان المراجعة (Trial Balance)"
        description="تقرير يعرض أرصدة الحسابات الدفترية المدينة والدائنة في نهاية الفترة، للتأكد من توازن المعاملات وصحتها قبل القوائم المالية."
      />
      <div className="mt-4">
        <TrialBalanceClient data={data} />
      </div>
    </>
  );
}
