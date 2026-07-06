import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getChartOfAccountsData } from "@/server/queries/accounting-erp";
import { AccountsClient } from "@/components/accounting/accounts-client";

export default async function ChartOfAccountsPage() {
  const session = await getCurrentSession();

  // Allow only super_admin, organization_owner, and accountant
  if (!["super_admin", "organization_owner", "accountant"].includes(session.role)) {
    redirect("/dashboard/accounting");
  }

  const { accounts } = await getChartOfAccountsData();

  return (
    <>
      <PageHeader
        title="دليل الحسابات (Chart of Accounts)"
        description="هيكل الحسابات المالية المفصلة لتوزيع القيود والعمليات الحسابية للأصول، الالتزامات، الإيرادات، والمصروفات."
      />
      <div className="mt-4">
        <AccountsClient accounts={accounts} />
      </div>
    </>
  );
}
