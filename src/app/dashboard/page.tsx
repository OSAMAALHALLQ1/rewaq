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

const TILE_STYLES = {
  blue: { card: "light", icon: "bg-white text-primary", text: "text-foreground", muted: "text-muted-foreground" },
  emerald: { card: "dark", icon: "bg-white/10 text-accent", text: "text-white", muted: "text-white/70" },
  amber: { card: "primary", icon: "bg-white/15 text-white", text: "text-white", muted: "text-white/75" },
  sky: { card: "default", icon: "bg-primary-light text-primary", text: "text-foreground", muted: "text-muted-foreground" },
  violet: { card: "muted", icon: "bg-white text-primary", text: "text-foreground", muted: "text-muted-foreground" },
  rose: { card: "light", icon: "bg-secondary text-white", text: "text-foreground", muted: "text-muted-foreground" },
} as const;

type TileTone = keyof typeof TILE_STYLES;

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
      <h2 className="text-sm font-extrabold text-foreground">{title}</h2>
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
  const style = TILE_STYLES[tone];

  return (
    <Card variant={style.card}>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className={cn("text-xs font-bold", style.muted)}>{label}</p>
          <p className={cn("mt-2 font-black tracking-tight tabular-nums", emphasize ? "text-3xl" : "text-2xl", style.text)}>{value}</p>
          <p className={cn("mt-2 text-[11px] leading-4", style.muted)}>{hint}</p>
        </div>
        <div className={cn("shrink-0 rounded-full p-3", style.icon)}>
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

      <section className="mb-6">
        <SectionHeading title="وصول سريع" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {QUICK_ACCESS.map((item) => {
            const style = TILE_STYLES[item.tone];

            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative overflow-hidden rounded-3xl border border-border bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift"
              >
                <div className={cn("inline-flex h-11 w-11 items-center justify-center rounded-full", style.icon)}>
                  <item.icon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-extrabold leading-5 text-foreground">{item.label}</p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{item.description}</p>
                <span className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-dashed border-secondary/30 text-muted-foreground/0 transition-all group-hover:-translate-x-0.5 group-hover:text-muted-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mb-6">
        <SectionHeading title="الأداء المالي" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="مبيعات اليوم" value={money(data.todaySales)} hint="فواتير العملاء اليوم" icon={TrendingUp} tone="emerald" emphasize />
          <StatTile label="مبيعات الشهر" value={money(data.monthSales)} hint="إجمالي إيرادات الشهر" icon={Coins} tone="amber" emphasize />
          <StatTile label="صافي ربح الشهر" value={money(data.monthNetProfit)} hint="بعد خصم التكاليف والمصروفات" icon={PiggyBank} tone="blue" emphasize />
          <StatTile label="السيولة النقدية" value={money(liquidity)} hint="نقدية + أرصدة البنوك" icon={Banknote} tone="sky" emphasize />
        </div>
      </section>

      <section className="mb-6">
        <SectionHeading title="السيولة والمخزون" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="الذمم المدينة" value={money(data.customerReceivable)} hint="مستحق من العملاء" icon={Wallet} tone="sky" />
          <StatTile label="الذمم الدائنة" value={money(data.supplierPayable)} hint="مستحق للموردين" icon={Scale} tone="violet" />
          <StatTile label="قيمة المخزون" value={money(data.inventoryValue)} hint="تكلفة الأصناف الحالية" icon={PackageSearch} tone="blue" />
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
        <Card variant="light">
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
        <Card variant="dark">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>فواتير موردين مستحقة</CardTitle>
            <Landmark className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent className="space-y-2">
            {data.unpaidSupplierInvoices.length === 0 ? (
              <p className="text-sm text-white/70">لا توجد فواتير مستحقة.</p>
            ) : (
              data.unpaidSupplierInvoices.map((inv) => (
                <Link
                  key={inv.id}
                  href="/dashboard/invoices"
                  className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/10 p-3 transition hover:bg-white/15"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{inv.supplierName}</p>
                    <p className="text-xs text-white/60">{inv.invoiceNumber}</p>
                  </div>
                  <span className="shrink-0 text-sm font-extrabold text-accent">{money(inv.total)}</span>
                </Link>
              ))
            )}
            <div className="flex items-center justify-between border-t border-white/10 pt-3 text-sm">
              <span className="font-bold">الإجمالي المستحق</span>
              <span className="font-extrabold text-accent">{money(data.unpaidSupplierInvoicesTotal)}</span>
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