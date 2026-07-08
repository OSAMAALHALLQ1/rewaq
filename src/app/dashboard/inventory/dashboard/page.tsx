import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ClipboardCheck,
  PackageMinus,
  PackageOpen,
  Plus,
  TrendingDown,
  TrendingUp,
  Truck,
  Warehouse,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { getInventoryData, getOperationsData } from "@/server/queries/app";

export default async function InventoryDashboardPage() {
  const [{ items, branchStock, movements, branches }, { wasteLogs, transfers }] = await Promise.all([
    getInventoryData(),
    getOperationsData(),
  ]);

  // إجمالي الكمية لكل مادة
  const qtyByItem = new Map<string, number>();
  for (const s of branchStock) {
    qtyByItem.set(s.itemId, (qtyByItem.get(s.itemId) ?? 0) + s.quantity);
  }

  const totalValue = items.reduce((sum, it) => sum + (qtyByItem.get(it.id) ?? 0) * (it.averageCost || 0), 0);
  const outOfStock = items.filter((it) => (qtyByItem.get(it.id) ?? 0) <= 0);
  const lowStock = items.filter((it) => {
    const q = qtyByItem.get(it.id) ?? 0;
    return q > 0 && q <= it.minimumQuantity;
  });

  const wasteTotal = wasteLogs.reduce((sum, w) => sum + (w.cost || 0), 0);
  const pendingTransfers = transfers.filter((t) => t.status === "draft" || t.status === "sent").length;

  // حركات واردة/صادرة
  const incoming = movements.filter((m) => m.quantity > 0);
  const outgoing = movements.filter((m) => m.quantity < 0);
  const inValue = incoming.reduce((sum, m) => sum + Math.abs(m.totalCost || 0), 0);
  const outValue = outgoing.reduce((sum, m) => sum + Math.abs(m.totalCost || 0), 0);

  // أكثر المواد استهلاكاً (بناءً على الحركات الصادرة)
  const usageByItem = new Map<string, { name: string; qty: number; cost: number }>();
  for (const m of outgoing) {
    const prev = usageByItem.get(m.itemId) ?? { name: m.itemName, qty: 0, cost: 0 };
    prev.qty += Math.abs(m.quantity);
    prev.cost += Math.abs(m.totalCost || 0);
    usageByItem.set(m.itemId, prev);
  }
  const topConsumed = [...usageByItem.values()].sort((a, b) => b.cost - a.cost).slice(0, 6);

  const stats = [
    { label: "إجمالي المواد", value: formatNumber(items.length), icon: Boxes, tone: "bg-primary/10 text-primary" },
    { label: "قيمة المخزون", value: formatCurrency(totalValue), icon: TrendingUp, tone: "bg-emerald-50 text-emerald-600" },
    { label: "عدد المستودعات", value: formatNumber(branches.length), icon: Warehouse, tone: "bg-sky-50 text-sky-600" },
    { label: "مواد نافدة", value: formatNumber(outOfStock.length), icon: PackageOpen, tone: "bg-rose-50 text-rose-600" },
    { label: "أقل من الحد الأدنى", value: formatNumber(lowStock.length), icon: AlertTriangle, tone: "bg-amber-50 text-amber-600" },
    { label: "تحويلات معلّقة", value: formatNumber(pendingTransfers), icon: Truck, tone: "bg-indigo-50 text-indigo-600" },
    { label: "قيمة التالف", value: formatCurrency(wasteTotal), icon: PackageMinus, tone: "bg-rose-50 text-rose-600" },
    { label: "إجمالي الحركات", value: formatNumber(movements.length), icon: ClipboardCheck, tone: "bg-violet-50 text-violet-600" },
  ];

  const quickLinks = [
    { label: "إضافة مادة", href: "/dashboard/inventory", icon: Plus },
    { label: "المستودعات", href: "/dashboard/warehouses", icon: Warehouse },
    { label: "بدء جرد", href: "/dashboard/stock-counts", icon: ClipboardCheck },
    { label: "تحويل مخزني", href: "/dashboard/transfers", icon: Truck },
    { label: "تسجيل تالف", href: "/dashboard/waste", icon: PackageMinus },
    { label: "حركات المخزن", href: "/dashboard/stock-movements", icon: ClipboardCheck },
  ];

  return (
    <>
      <PageHeader
        title="لوحة تحكم المخزون"
        description="نظرة شاملة على حالة المخزون: القيمة، التنبيهات، الحركة، والاستهلاك."
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/inventory">
              <ArrowRight className="h-4 w-4" />
              مخطط المخزن
            </Link>
          </Button>
        }
      />

      {/* بطاقات الإحصائيات */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-xl font-black">{s.value}</p>
              </div>
              <div className={`rounded-lg p-2 ${s.tone}`}>
                <s.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* اختصارات سريعة */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-2 p-4">
          {quickLinks.map((q) => (
            <Button key={q.href + q.label} variant="outline" size="sm" asChild>
              <Link href={q.href}>
                <q.icon className="h-4 w-4" />
                {q.label}
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* حركة الإدخال والإخراج */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-bold text-emerald-700">إجمالي الإدخال</p>
              <p className="mt-1 text-2xl font-black">{formatCurrency(inValue)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatNumber(incoming.length)} حركة واردة</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600"><TrendingUp className="h-7 w-7" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-bold text-rose-700">إجمالي الإخراج</p>
              <p className="mt-1 text-2xl font-black">{formatCurrency(outValue)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatNumber(outgoing.length)} حركة صادرة</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 text-rose-600"><TrendingDown className="h-7 w-7" /></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* تنبيهات المخزون */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              تنبيهات المخزون
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المادة</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>الحد الأدنى</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...outOfStock, ...lowStock].slice(0, 10).map((it) => {
                  const q = qtyByItem.get(it.id) ?? 0;
                  const isOut = q <= 0;
                  return (
                    <TableRow key={it.id}>
                      <TableCell>
                        <Link href={`/dashboard/inventory/${it.id}`} className="font-semibold text-primary hover:underline">
                          {it.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{it.categoryName}</TableCell>
                      <TableCell>{formatNumber(q)} {it.usageUnit}</TableCell>
                      <TableCell>{formatNumber(it.minimumQuantity)}</TableCell>
                      <TableCell>{isOut ? <Badge tone="danger">نافد</Badge> : <Badge tone="warning">منخفض</Badge>}</TableCell>
                    </TableRow>
                  );
                })}
                {outOfStock.length === 0 && lowStock.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      لا توجد تنبيهات حالياً — حالة المخزون جيدة.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* أكثر المواد استهلاكاً */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-primary" />
              أكثر المواد استهلاكاً
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topConsumed.map((c) => (
              <div key={c.name} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-bold">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">{formatNumber(c.qty)} وحدة مصروفة</p>
                </div>
                <p className="text-sm font-bold text-rose-600">{formatCurrency(c.cost)}</p>
              </div>
            ))}
            {topConsumed.length === 0 && (
              <p className="rounded-lg border bg-slate-50 p-3 text-sm text-muted-foreground">لا توجد حركات صرف مسجلة.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* آخر الحركات والتالف */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              آخر الحركات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المادة</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>التكلفة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.slice(0, 8).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{new Date(m.createdAt).toLocaleDateString("ar-PS")}</TableCell>
                    <TableCell className="font-medium">{m.itemName}</TableCell>
                    <TableCell className={m.quantity < 0 ? "font-bold text-rose-600" : "font-bold text-emerald-700"}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </TableCell>
                    <TableCell>{formatCurrency(Math.abs(m.totalCost || 0))}</TableCell>
                  </TableRow>
                ))}
                {movements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">لا توجد حركات.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageMinus className="h-5 w-5 text-rose-600" />
              آخر التالف والهدر
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {wasteLogs.slice(0, 8).map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-bold">{w.itemName}</p>
                  <p className="text-[11px] text-muted-foreground">{w.reason} — {w.branchName}</p>
                </div>
                <p className="text-sm font-bold text-rose-600">{formatCurrency(w.cost)}</p>
              </div>
            ))}
            {wasteLogs.length === 0 && (
              <p className="rounded-lg border bg-slate-50 p-3 text-sm text-muted-foreground">لا يوجد تالف مسجل.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
