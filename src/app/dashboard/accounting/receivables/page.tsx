import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getReceivablesData } from "@/server/queries/accounting-treasury";
import { ReceivablesClient } from "@/components/accounting/receivables-client";

type Props = {
  searchParams: Promise<{ customerId?: string }>;
};

export const dynamic = "force-dynamic";

export default async function ReceivablesPage({ searchParams }: Props) {
  const session = await getCurrentSession();
  if (!["super_admin", "organization_owner", "accountant"].includes(session.role)) {
    redirect("/dashboard/accounting");
  }

  const params = await searchParams;
  const data = await getReceivablesData(params.customerId || undefined);

  return (
    <>
      <PageHeader
        title="الذمم المدينة وأعمار ديون العملاء (Accounts Receivable)"
        description="الفواتور غير المحصلة موزعة حسب أعمار الاستحقاق، مع كشف حساب تفصيلي لكل عميل (فواتير ورصيد جارٍ)."
      />
      <div className="mt-4">
        <ReceivablesClient data={data} />
      </div>
    </>
  );
}
