import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  ClipboardCheck,
  Flame,
  PackageCheck,
  PackageMinus,
  SprayCan,
  Truck,
} from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";
import { getDashboardData, getOperationsData, getPurchasingData } from "@/server/queries/app";

const focusCards = [
  { title: "التالف", value: "3 مواد", body: "مواد خرجت من المخزن بسبب تلف أو انتهاء صلاحية.", href: "/dashboard/waste", icon: PackageMinus, tone: "danger" as const },
  { title: "المحاريق", value: "2 تسجيل", body: "مواد استهلكت خارج الصرف الطبيعي وتحتاج متابعة.", href: "/dashboard/waste", icon: Flame, tone: "warning" as const },
  { title: "المنظفات", value: "5 مواد", body: "منظفات وتعقيم ضمن سجل مستقل عن مواد الطعام.", href: "/dashboard/waste", icon: SprayCan, tone: "default" as const },
  { title: "الصادر والوارد", value: "18 حركة", body: "حركة يومية لكل إدخال أو صرف أو تحويل.", href: "/dashboard/stock-movements", icon: Truck, tone: "success" as const },
  { title: "طلبيات الأقسام", value: "7 طلبيات", body: "طلبات صرف داخلية بانتظار التجهيز أو الاعتماد.", href: "/dashboard/purchase-orders", icon: ClipboardCheck, tone: "warning" as const },
  { title: "انتهاء الصلاحية", value: "4 قريبة", body: "مواد تحتاج استخدامًا أو إرجاعًا قبل انتهاء الصلاحية.", href: "/dashboard/reports", icon: AlertTriangle, tone: "danger" as const },
];

export default async function DashboardPage() {
  const [data, operations, purchasing] = await Promise.all([getDashboardData(), getOperationsData(), getPurchasingData()]);

  return (
    <>
      <PageHeader
        title="لوحة المخزن"
        description="واجهة مركزة لإدارة المخزن: التالف، المحاريق، المنظفات، الصادر والوارد، طلبيات الأقسام، وانتهاء الصلاحية."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/reports">تقارير المخزن</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/invoices">فاتورة توريد</Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {focusCards.map((item) => {
          const Icon = item.icon;

          return (
            <Link key={item.title} href={item.href} className="group rounded-lg border bg-white p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-slate-100 text-slate-700 group-hover:bg-teal-50 group-hover:text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <Badge tone={item.tone}>{item.value}</Badge>
              </div>
              <h2 className="mt-4 font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                فتح الصفحة
                <ArrowLeft className="h-4 w-4" />
              </span>
            </Link>
          );
        })}
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="مواد تحتاج متابعة" value={formatNumber(data.lowStockCount)} description="حسب حركة المخزن اليومية" icon={Boxes} tone="warning" />
        <MetricCard label="طلبيات مفتوحة" value={formatNumber(data.openPurchaseOrders)} description="طلبيات أقسام وتوريد" icon={ClipboardCheck} />
        <MetricCard label="سجلات تالف" value={formatNumber(operations.wasteLogs.length)} description="تالف ومحاريق ومنظفات" icon={PackageMinus} tone="danger" />
        <MetricCard label="فواتير توريد" value={formatNumber(purchasing.invoices.length)} description="فواتير موردين مسجلة" icon={PackageCheck} tone="success" />
      </div>



      <Card className="mt-4">
        <CardHeader>
          <CardTitle>آخر تنبيهات المخزن</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {data.alerts.slice(0, 4).map((alert) => (
            <div key={alert.id} className="rounded-lg border bg-white p-4">
              <h3 className="font-semibold">{alert.title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
