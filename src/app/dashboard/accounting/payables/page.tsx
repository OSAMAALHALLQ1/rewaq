import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getPayablesData } from "@/server/queries/accounting-erp";
import { PayablesClient } from "@/components/accounting/payables-client";

type Props = {
  searchParams: Promise<{ supplierId?: string }>;
};

export const dynamic = "force-dynamic";

export default async function PayablesPage({ searchParams }: Props) {
  const session = await getCurrentSession();

  if (!["super_admin", "organization_owner", "accountant"].includes(session.role)) {
    redirect("/dashboard/accounting");
  }

  const params = await searchParams;
  const data = await getPayablesData(params.supplierId || undefined);

  return (
    <>
      <PageHeader
        title="الذمم الدائنة وأعمار ديون الموردين (Accounts Payable)"
        description="الفواتير غير المسددة موزعة حسب أعمار الاستحقاق، مع كشف حساب تفصيلي لكل مورد (فواتير ودفعات ورصيد جارٍ)."
      />
      <div className="mt-4">
        <PayablesClient data={data} />
      </div>
    </>
  );
}
