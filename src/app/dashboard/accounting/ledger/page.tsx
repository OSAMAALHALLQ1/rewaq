import { BookOpenCheck, FileSpreadsheet, Scale } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="عدد الحسابات" value={String(accounts.length)} description="دليل الحسابات الافتراضي" icon={BookOpenCheck} tone="default" />
        <MetricCard label="إجمالي المدين" value={formatCurrency(debitTotal)} description="آخر القيود المرحلة" icon={FileSpreadsheet} tone="success" />
        <MetricCard label="اتزان القيود" value={balanced ? "متزن" : "يحتاج مراجعة"} description={formatCurrency(Math.abs(debitTotal - creditTotal))} icon={Scale} tone={balanced ? "success" : "danger"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>دليل الحسابات</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الكود</TableHead>
                  <TableHead>الحساب</TableHead>
                  <TableHead>النوع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-mono">{account.code}</TableCell>
                    <TableCell className="font-semibold">{account.name}</TableCell>
                    <TableCell>
                      <Badge tone={account.normalBalance === "debit" ? "success" : "default"}>
                        {accountTypeLabels[account.accountType] ?? account.accountType}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>آخر القيود</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-lg border bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
                  <div>
                    <p className="font-bold">{entry.entryNumber}</p>
                    <p className="text-xs text-muted-foreground">{entry.entryDate} · {entry.memo ?? "قيد محاسبي"}</p>
                  </div>
                  <Badge tone={Math.abs(entry.debitTotal - entry.creditTotal) < 0.01 ? "success" : "danger"}>
                    {Math.abs(entry.debitTotal - entry.creditTotal) < 0.01 ? "متزن" : "غير متزن"}
                  </Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الحساب</TableHead>
                      <TableHead>البيان</TableHead>
                      <TableHead>مدين</TableHead>
                      <TableHead>دائن</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entry.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.accountCode} · {line.accountName}</TableCell>
                        <TableCell>{line.memo ?? "-"}</TableCell>
                        <TableCell>{line.debit > 0 ? formatCurrency(line.debit) : "-"}</TableCell>
                        <TableCell>{line.credit > 0 ? formatCurrency(line.credit) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
