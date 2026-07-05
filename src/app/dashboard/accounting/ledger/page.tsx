import Link from "next/link";
import { BookOpenCheck, FileSpreadsheet, Scale, Plus } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { getAccountingLedgerData } from "@/server/queries/accounting";

const accountTypeLabels: Record<string, string> = {
  asset: "أصول",
  liability: "التزامات",
  equity: "حقوق ملكية",
  revenue: "إيرادات",
  expense: "مصروفات",
  cogs: "تكلفة مبيعات",
};

export default async function AccountingLedgerPage() {
  const { accounts, entries } = await getAccountingLedgerData();
  const debitTotal = entries.reduce((sum, entry) => sum + entry.debitTotal, 0);
  const creditTotal = entries.reduce((sum, entry) => sum + entry.creditTotal, 0);
  const balanced = Math.abs(debitTotal - creditTotal) < 0.01;

  return (
    <>
      <PageHeader
        title="دفتر الأستاذ والقيود"
        description="ترحيل محاسبي تلقائي لفواتير الكاشير: صندوق/بنك، مبيعات، ضريبة، تكلفة بضاعة ومخزون."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild className="border-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-50">
              <Link href="/dashboard/accounting/p-and-l">
                تقرير الأرباح والخسائر
              </Link>
            </Button>
            <Button variant="outline" asChild className="border-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-50">
              <Link href="/dashboard/accounting/balance-sheet">
                الميزانية العمومية
              </Link>
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

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="عدد الحسابات" value={String(accounts.length)} description="دليل الحسابات الافتراضي" icon={BookOpenCheck} tone="default" />
        <MetricCard label="إجمالي المدين" value={formatCurrency(debitTotal)} description="آخر القيود المرحلة" icon={FileSpreadsheet} tone="success" />
        <MetricCard label="اتزان القيود" value={balanced ? "متزن" : "يحتاج مراجعة"} description={formatCurrency(Math.abs(debitTotal - creditTotal))} icon={Scale} tone={balanced ? "success" : "danger"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)] text-right" dir="rtl">
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50 py-3.5 px-5">
            <CardTitle className="text-sm font-black text-slate-900">دليل الحسابات</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="border-b text-slate-400">
                  <TableHead className="text-right py-2.5 px-5">الكود</TableHead>
                  <TableHead className="text-right py-2.5 px-5">الحساب</TableHead>
                  <TableHead className="text-right py-2.5 px-5">النوع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id} className="hover:bg-slate-50/30 transition-colors">
                    <TableCell className="font-mono py-2.5 px-5 text-slate-700">{account.code}</TableCell>
                    <TableCell className="font-bold py-2.5 px-5 text-slate-900">{account.name}</TableCell>
                    <TableCell className="py-2.5 px-5">
                      <Badge tone={account.normalBalance === "debit" ? "success" : "default"} className="rounded-lg px-2 py-0.5">
                        {accountTypeLabels[account.accountType] ?? account.accountType}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50 py-3.5 px-5">
            <CardTitle className="text-sm font-black text-slate-900">آخر القيود المرحلة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {entries.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">لا توجد قيود مرحلة حالياً</div>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="rounded-xl border bg-white/40 shadow-sm overflow-hidden border-slate-200/60">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50/30 p-3.5">
                    <div>
                      <p className="font-mono font-bold text-slate-900 text-xs">{entry.entryNumber}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{entry.entryDate} · {entry.memo ?? "قيد محاسبي"}</p>
                    </div>
                    <Badge tone={Math.abs(entry.debitTotal - entry.creditTotal) < 0.01 ? "success" : "danger"} className="rounded-lg px-2 py-0.5">
                      {Math.abs(entry.debitTotal - entry.creditTotal) < 0.01 ? "متزن" : "غير متزن"}
                    </Badge>
                  </div>
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="border-b text-slate-400">
                        <TableHead className="text-right py-2 px-4">الحساب</TableHead>
                        <TableHead className="text-right py-2 px-4">البيان</TableHead>
                        <TableHead className="text-left py-2 px-4">مدين (+)</TableHead>
                        <TableHead className="text-left py-2 px-4">دائن (-)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entry.lines.map((line) => (
                        <TableRow key={line.id} className="hover:bg-slate-50/20 transition-colors">
                          <TableCell className="py-2 px-4 text-slate-800 font-bold">{line.accountCode} · {line.accountName}</TableCell>
                          <TableCell className="py-2 px-4 text-slate-500">{line.memo ?? "-"}</TableCell>
                          <TableCell className="text-left py-2 px-4 font-mono text-slate-900 font-medium">
                            {line.debit > 0 ? formatCurrency(line.debit) : "-"}
                          </TableCell>
                          <TableCell className="text-left py-2 px-4 font-mono text-slate-900 font-medium">
                            {line.credit > 0 ? formatCurrency(line.credit) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
