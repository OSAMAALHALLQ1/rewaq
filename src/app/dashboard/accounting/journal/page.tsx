import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getJournalBrowserData } from "@/server/queries/accounting-erp";
import { JournalBrowserClient } from "@/components/accounting/journal-browser-client";

type Props = {
  searchParams: Promise<{ from?: string; to?: string; q?: string; status?: string; sourceType?: string }>;
};

export default async function GeneralJournalPage({ searchParams }: Props) {
  const session = await getCurrentSession();

  if (!["super_admin", "organization_owner", "accountant"].includes(session.role)) {
    redirect("/dashboard/accounting");
  }

  const params = await searchParams;
  const data = await getJournalBrowserData({
    from: params.from || undefined,
    to: params.to || undefined,
    q: params.q || undefined,
    status: params.status === "draft" || params.status === "posted" ? params.status : undefined,
    sourceType: params.sourceType || undefined,
  });

  return (
    <>
      <PageHeader
        title="دفتر اليومية العامة (General Journal)"
        description="جميع القيود المحاسبية كاملة بأسطرها ومصدرها وحالتها — نقطة المراجعة والتدقيق الأولى للمحاسب."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-lg font-bold border-slate-200">
              <Link href="/dashboard/accounting/ledger">دفتر الأستاذ</Link>
            </Button>
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
        <JournalBrowserClient data={data} />
      </div>
    </>
  );
}
