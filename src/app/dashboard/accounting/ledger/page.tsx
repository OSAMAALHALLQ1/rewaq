import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getGeneralLedgerData } from "@/server/queries/accounting-erp";
import { LedgerClient } from "@/components/accounting/ledger-client";

type Props = {
  searchParams: Promise<{ accountId?: string }>;
};

export default async function GeneralLedgerPage({ searchParams }: Props) {
  const session = await getCurrentSession();

  // Allow only super_admin, organization_owner, and accountant
  if (!["super_admin", "organization_owner", "accountant"].includes(session.role)) {
    redirect("/dashboard/accounting");
  }

  const { accountId } = await searchParams;
  const data = await getGeneralLedgerData(accountId);

  return (
    <>
      <PageHeader
        title="دفتر الأستاذ العام (General Ledger)"
        description="عرض تفصيلي للعمليات المالية والحركة اليومية الجارية لكل حساب وتحديد الأرصدة الختامية وتصحيحها."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-md shadow-teal-500/10">
              <Link href="/dashboard/accounting/ledger/new">
                <Plus className="me-2 h-4 w-4 inline" />
                إضافة قيد يدوي
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mt-4">
        <LedgerClient data={data} />
      </div>
    </>
  );
}
