import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getExpensesData } from "@/server/queries/accounting-erp";
import { ExpensesClient } from "@/components/accounting/expenses-client";

export default async function ExpensesPage() {
  const session = await getCurrentSession();

  // Allow super_admin, organization_owner, accountant, and branch_manager
  if (!["super_admin", "organization_owner", "accountant", "branch_manager"].includes(session.role)) {
    redirect("/dashboard/accounting");
  }

  const data = await getExpensesData();

  return (
    <>
      <PageHeader
        title="إدارة المصروفات التشغيلية"
        description="تسجيل المصاريف اليومية وتوزيعها على الفروع ومراكز التكلفة، مع ترحيل قيد محاسبي تلقائي لكل حركة."
      />
      <div className="mt-4">
        <ExpensesClient data={data} />
      </div>
    </>
  );
}
