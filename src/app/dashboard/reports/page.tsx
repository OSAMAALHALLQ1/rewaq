import Link from "next/link";
import { AlertTriangle, ClipboardCheck, Download, FileBarChart, Flame, PackageMinus, SprayCan, Truck } from "lucide-react";
import { ReportSelector } from "@/components/dashboard/report-selector";
import { PurchaseAreaChart, WasteBarChart } from "@/components/dashboard/charts";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";
import { getReportsData } from "@/server/queries/app";

const reportOptions = [
  { value: "daily_movements", label: "تقرير الصادر والوارد اليومي" },
  { value: "damaged", label: "تقرير التالف" },
  { value: "burns", label: "تقرير المحاريق" },
  { value: "department_supply", label: "تقرير التوريد للأقسام" },
  { value: "price_changes", label: "تقرير تذبذب الأسعار" },
  { value: "expiry", label: "تقرير المواد القريبة من انتهاء الصلاحية" },
];

const expiryRows = [
  ["لبنة", "قسم الضيافة", "2026-05-24", "قريب"],
  ["دجاج مبرد", "الشاورمة والمشاوي", "2026-05-25", "قريب"],
  ["منظف أسطح", "قسم الخدمات", "2026-06-02", "متابعة"],
];

export default async function ReportsPage() {
  const { dashboard, movements, purchaseOrders, wasteLogs, suppliers, branches } = await getReportsData();
  const incoming = movements.filter((movement) => movement.quantity > 0).length;
  const outgoing = movements.filter((movement) => movement.quantity < 0).length;

  return (
    <>
      <PageHeader
        title="تقارير المخزن"
        description="تقارير المخزن المطلوبة: التالف، المحاريق، الصادر والوارد، طلبيات الأقسام، انتهاء الصلاحية، وتذبذب الأسعار."
        actions={
          <Button variant="outline">
            <Download className="h-4 w-4" />
            تصدير ملف
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-3 p-4">
          <Input className="max-w-44" type="date" defaultValue="2026-05-01" />
          <Input className="max-w-44" type="date" defaultValue="2026-05-20" />
          <ReportSelector options={reportOptions} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="التالف" value={formatNumber(wasteLogs.filter((log) => log.reason.includes("تلف")).length)} description="سجلات تلف" icon={PackageMinus} tone="danger" />
        <MetricCard label="المحاريق" value={formatNumber(wasteLogs.filter((log) => log.reason.includes("محاريق")).length)} description="سجلات محاريق" icon={Flame} tone="warning" />
        <MetricCard label="الصادر والوارد" value={`${formatNumber(incoming)} / ${formatNumber(outgoing)}`} description="وارد / صادر" icon={Truck} tone="success" />
        <MetricCard label="طلبيات الأقسام" value={formatNumber(purchaseOrders.length)} description="طلبات مفتوحة وسابقة" icon={ClipboardCheck} />
        <MetricCard label="انتهاء الصلاحية" value={formatNumber(expiryRows.length)} description="مواد قريبة" icon={AlertTriangle} tone="warning" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>تقرير الصادر والوارد اليومي</CardTitle>
          </CardHeader>
          <CardContent>
            <PurchaseAreaChart data={dashboard.purchaseCost30Days} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>تقرير التالف والمحاريق</CardTitle>
          </CardHeader>
          <CardContent>
            <WasteBarChart data={dashboard.wasteByBranch} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>آخر حركات الصادر والوارد</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المادة</TableHead>
                  <TableHead>القسم</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الكمية</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.slice(0, 8).map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>{new Date(movement.createdAt).toLocaleDateString("ar-PS")}</TableCell>
                    <TableCell className="font-medium">{movement.itemName}</TableCell>
                    <TableCell>{movement.branchName}</TableCell>
                    <TableCell>{movement.movementType}</TableCell>
                    <TableCell>
                      <Badge tone={movement.quantity > 0 ? "success" : "warning"}>{formatNumber(movement.quantity)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card id="price_changes">
          <CardHeader>
            <CardTitle>تقرير تذبذب الأسعار</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المورد</TableHead>
                  <TableHead>نسبة التذبذب</TableHead>
                  <TableHead>الإجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>
                      <Badge tone={supplier.priceRisk > 15 ? "danger" : supplier.priceRisk > 8 ? "warning" : "success"}>
                        {supplier.priceRisk}%
                      </Badge>
                    </TableCell>
                    <TableCell>{supplier.priceRisk > 15 ? "مراجعة المورد" : "مراقبة الفاتورة القادمة"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4" id="expiry">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <FileBarChart className="h-5 w-5 text-primary" />
              تقرير المواد القريبة من انتهاء الصلاحية
            </CardTitle>
            <Button variant="outline" asChild>
              <Link href="/dashboard/inventory">فتح المواد</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المادة</TableHead>
                <TableHead>القسم</TableHead>
                <TableHead>تاريخ الانتهاء</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expiryRows.map(([item, department, date, status]) => (
                <TableRow key={`${item}-${date}`}>
                  <TableCell className="font-medium">{item}</TableCell>
                  <TableCell>{department}</TableCell>
                  <TableCell>{date}</TableCell>
                  <TableCell>
                    <Badge tone={status === "قريب" ? "danger" : "warning"}>{status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
