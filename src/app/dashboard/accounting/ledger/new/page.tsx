import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { JournalEntryForm } from "@/components/accounting/journal-entry-form";
import { getAccountingLedgerData } from "@/server/queries/accounting";
import { getJournalFormLookups } from "@/server/queries/accounting-erp";

export default async function NewJournalEntryPage() {
  const [{ accounts }, lookups] = await Promise.all([getAccountingLedgerData(), getJournalFormLookups()]);

  return (
    <>
      <div className="flex items-center gap-3 mb-2" dir="rtl">
        <Button variant="outline" size="sm" asChild className="rounded-lg gap-1 border-slate-200 hover:bg-slate-50 text-slate-700">
          <Link href="/dashboard/accounting/ledger">
            <ArrowRight className="h-4 w-4" />
            رجوع لدفتر الأستاذ
          </Link>
        </Button>
      </div>

      <PageHeader
        title="إضافة قيد محاسبي يدوي"
        description="تسجيل قيد مالي مزدوج وتوزيعه على أسطر المدين والدائن في الحسابات العامة."
      />

      <div className="mt-4 max-w-5xl">
        <JournalEntryForm accounts={accounts} costCenters={lookups.costCenters} branches={lookups.branches} />
      </div>
    </>
  );
}
