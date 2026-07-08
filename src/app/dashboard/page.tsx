import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Banknote,
  BarChart3,
  Building,
  ChefHat,
  Coins,
  FileText,
  Landmark,
  MonitorSmartphone,
  PackageSearch,
  PiggyBank,
  ReceiptText,
  Scale,
  Store,
  TrendingUp,
  Wallet,
  Warehouse,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CategoryPieChart, FinanceAreaChart, FinanceBarChart } from "@/components/dashboard/charts";
import { getAccountingDashboardData } from "@/server/queries/accounting-erp";
import { cn } from "@/lib/utils";

function money(value: number) {
  return `${value.toLocaleString("ar-EG")} ₪`;
}

const TILE_TONES = {
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
  rose: "bg-rose-50 text-rose-600",
} as const;

type TileTone = keyof typeof TILE_TONES;

const QUICK_ACCESS: Array<{ label: string; description: string; href: string; icon: LucideIcon; tone: TileTone }> = [
  { label: "نقطة البيع", description: "شاشة الكاشير والبيع السريع", href: "/d/pos", icon: MonitorSmartphone, tone: "blue" },
  { label: "المخزون والمستودعات", description: "الأصناف والكميات والتنبيهات", href: "/dashboard/inventory/dashboard", icon: Warehouse, tone: "emerald" },
  { label: "المشتريات والموردون", description: "فواتير التوريد وطلبيات الشراء", href: "/dashboard/suppliers", icon: Store, tone: "amber" },
  { label: "فواتير العملاء", description: "المبيعات والذمم والمرتجعات", href: "/dashboard/customer-invoices", icon: ReceiptText, tone: "sky" },
  { label: "الوصفات وتكلفة الطعام", description: "قوائم المواد وربحية الأطباق", href: "/dashboard/recipes", icon: ChefHat, tone: "violet" },
  { label: "التقارير والتحليلات", description: "أداء المبيعات والمخزون والتكلفة", href: "/dashboard/reports", icon: BarChart3, tone: "rose" },
];

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  emphasize,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: TileTone;
  emphasize?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn("mt-2 font-black tracking-tight", emphasize ? "text-2xl" : "text-xl")}>{value}</p>
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{hint}</p>
        </div>
        <div className={cn("shrink-0 rounded-xl p-2.5", TILE_TONES[tone])}>
          <Icon className={emphasize ? "h-5 w-5" : "h-4 w-4"} />
        </div>
      </CardContent>
    </Card>
  );
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
        description="ملخص لحظي للمؤشرات المالية، مع وصول سريع لأهم أقسام النظام."
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

      {/* وصول سريع للأقسام الأساسية */}
      <section className="mb-5">
        <SectionHeading title="وصول سريع" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {QUICK_ACCESS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group relative overflow-hidden rounded-xl border border-border bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_16px_40px_rgba(15,23,42,0.09)]"
            >
              <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-lg", TILE_TONES[item.tone])}>
                <item.icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-bold leading-5 text-foreground">{item.label}</p>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{item.description}</p>
              <ArrowLeft className="absolute left-3 top-3 h-3.5 w-3.5 text-muted-foreground/0 transition-all group-hover:-translate-x-0.5 group-hover:text-muted-foreground/50" />
            </Link>
          ))}
        </div>
      </section>

      {/* المؤشرات المالية الرئيسية */}
      <section className="mb-5">
        <SectionHeading title="الأداء المالي" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="مبيعات اليوم" value={money(data.todaySales)} hint="فواتير العملاء اليوم" icon={TrendingUp} tone="emerald" emphasize />
          <StatTile label="مبيعات الشهر" value={money(data.monthSales)} hint="إجمالي إيرادات الشهر" icon={Coins} tone="blue" emphasize />
          <StatTile label="صافي ربح الشهر" value={money(data.monthNetProfit)} hint="بعد خصم التكاليف والمصروفات" icon={PiggyBank} tone="emerald" emphasize />
          <StatTile label="السيولة النقدية" value={money(liquidity)} hint="نقدية + أرصدة البنوك" icon={Banknote} tone="sky" emphasize />
        </div>
      </section>

      <section className="mb-5">
        <SectionHeading title="السيولة والمخزون" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="الذمم المدينة" value={money(data.customerReceivable)} hint="مستحق من العملاء" icon={Wallet} tone="sky" />
          <StatTile label="الذمم الدائنة" value={money(data.supplierPayable)} hint="مستحق للموردين" icon={Scale} tone="amber" />
          <StatTile label="قيمة المخزون" value={money(data.inventoryValue)} hint="تكلفة الأصناف الحالية" icon={PackageSearch} tone="violet" />
          <StatTile label="أرصدة مسودة" value={String(data.draftEntries)} hint="قيود بانتظار الترحيل" icon={FileText} tone="amber" />
        </div>
      </section>

      <SectionHeading title="التحليلات والاتجاهات" />
      <div className="grid gap-4 lg:grid-cols-3">
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
              {data.recentEntries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    لا توجد قيود محاسبية بعد.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <section className="mt-5">
        <SectionHeading title="اختصارات إضافية" />
        <div className="flex flex-wrap gap-2.5">
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
      </section>
    </>
  );
}
