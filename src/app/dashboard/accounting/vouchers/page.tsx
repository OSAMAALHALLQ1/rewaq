import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getVoucherData } from "@/server/queries/accounting-treasury";
import { VouchersClient } from "@/components/accounting/vouchers-client";

export default async function VouchersPage() {
  const session = await getCurrentSession();
  if (!["super_admin", "organization_owner", "accountant"].includes(session.role)) {
    redirect("/dashboard/accounting");
  }

  const data = await getVoucherData();

  return (
    <>
      <PageHeader
        title="سند القبض والصرف (Receipt & Payment Vouchers)"
        description="تسجيل حركات الصندوق والبنك كقيود محاسبية متوازنة: سند القبض (مدين نقد/بنك) وسند الصرف (دائن نقد/بنك)، مع إمكانية تطبيق الصرف على فاتورة مورد."
      />
      <div className="mt-4">
        <VouchersClient data={data} />
      </div>
    </>
  );
}
