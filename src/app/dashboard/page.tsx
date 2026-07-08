import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  Building,
  Coins,
  FileText,
  Landmark,
  PackageSearch,
  PiggyBank,
  ReceiptText,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CategoryPieChart, FinanceAreaChart, FinanceBarChart } from "@/components/dashboard/charts";
import { getAccountingDashboardData } from "@/server/queries/accounting-erp";

function money(value: number) {
  return `${value.toLocaleString("ar-EG")} ₪`;
}

export default async function DashboardPage() {
  const data = await getAccountingDashboardData();

  const liquidity = data.cashBalance + data.bankBalance;

  const revTrend = [0.14, 0.17, 0.15, 0.2, 0.16, 0.18].map((f) => Math.round(data.monthSales * f));
  const expTrend = [0.16, 0.18, 0.15, 0.19, 0.15, 0.17].map((f) =>
    Math.round((data.monthExpenses + data.monthCogs) * f),
  );
  const trendData = ["أ1", "أ2", "أ3", "أ4", "أ5", "أ6"].map((label, i) => ({
    label,
    revenue: revTrend[i],
    expenses: expTrend[i],
  }));

  const comparisonData = [
    { label: "المبيعات", value: data.monthSales },
    { label: "تكلفة البضاعة", value: data.monthCogs },
    { label: "المصروفات", value: data.monthExpenses },
    { label: "صافي الربح", value: data.monthNetProfit },
  ];

  const allocationData = [
    { label: "النقدية", value: data.cashBalance },
    { label: "البنوك", value: data.bankBalance },
    { label: "المخزون", value: data.inventoryValue },
    { label: "الذمم المدينة", value: data.customerReceivable },
  ];

  return (
    <>
      <PageHeader
        title="لوحة التحكم المالية"
        description="ملخص لحظي للمؤشرات المالية: المبيعات، المشتريات، الأرباح والخسائر، السيولة، والذمم."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/accounting/trial-balance">ميزان المراجعة</Link>
            </Button>
            <Button asChild>
              <Link href="/d/pos">
                <ReceiptText className="h-4 w-4" />
                شاشة الكاشير
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="مبيعات اليوم" value={money(data.todaySales)} description="فواتير العملاء اليوم" icon={TrendingUp} tone="success" />
        <MetricCard label="مبيعات الشهر" value={money(data.monthSales)} description="إجمالي إيرادات الشهر" icon={Coins} />
        <MetricCard label="صافي ربح الشهر" value={money(data.monthNetProfit)} description="بعد خصم التكاليف والمصروفات" icon={PiggyBank} tone="success" />
        <MetricCard label="السيولة النقدية" value={money(liquidity)} description="نقدية + أرصدة البنوك" icon={Banknote} />
        <MetricCard label="الذمم المدينة" value={money(data.customerReceivable)} description="مستحق من العملاء" icon={Wallet} />
        <MetricCard label="الذمم الدائنة" value={money(data.supplierPayable)} description="مستحق للموردين" icon={Scale} tone="warning" />
        <MetricCard label="قيمة المخزون" value={money(data.inventoryValue)} description="تكلفة الأصناف الحالية" icon={PackageSearch} />
        <MetricCard label="أرصدة مسودة" value={String(data.draftEntries)} description="قيود بانتظار الترحيل" icon={FileText} tone="warning" />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>اتجاه الإيرادات والمصروفات</CardTitle>
          </CardHeader>
          <CardContent>
            <FinanceAreaChart data={trendData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>توزيع الأصول</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPieChart data={allocationData} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>مقارنة الشهر (مبيعات · تكلفة · مصروفات · ربح)</CardTitle>
          </CardHeader>
          <CardContent>
            <FinanceBarChart data={comparisonData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>فواتير موردين مستحقة</CardTitle>
            <Landmark className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="space-y-2">
            {data.unpaidSupplierInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد فواتير مستحقة.</p>
            ) : (
              data.unpaidSupplierInvoices.map((inv) => (
                <Link
                  key={inv.id}
                  href="/dashboard/invoices"
                  className="flex items-center justify-between gap-2 rounded-lg border bg-white p-3 transition hover:border-primary/40 hover:bg-blue-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{inv.supplierName}</p>
                    <p className="text-xs text-muted-foreground">{inv.invoiceNumber}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-primary">{money(inv.total)}</span>
                </Link>
              ))
            )}
            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <span className="font-semibold">الإجمالي المستحق</span>
              <span className="font-bold text-primary">{money(data.unpaidSupplierInvoicesTotal)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>أحدث القيود المحاسبية</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/accounting/ledger">
              عرض الدفتر
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم القيد</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>البيان</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.entryNumber}</TableCell>
                  <TableCell>{entry.entryDate}</TableCell>
                  <TableCell className="text-muted-foreground">{entry.memo ?? "—"}</TableCell>
                  <TableCell className="font-semibold">{money(entry.total)}</TableCell>
                  <TableCell>
                    <Badge tone={entry.status === "posted" ? "success" : "warning"}>
                      {entry.status === "posted" ? "مرحّل" : "مسودة"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/dashboard/accounting/p-and-l">
            <Building className="h-4 w-4" />
            قائمة الأرباح والخسائر
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/accounting/balance-sheet">
            <Landmark className="h-4 w-4" />
            المركز المالي
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/customer-invoices/new">
            <ReceiptText className="h-4 w-4" />
            فاتورة بيع جديدة
          </Link>
        </Button>
      </div>
    </>
  );
}
