import Link from "next/link";
import { AlertTriangle, ClipboardCheck, Download, FileBarChart, Flame, PackageMinus, Truck } from "lucide-react";
import { PurchaseAreaChart } from "@/components/dashboard/charts";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { getReportsData } from "@/server/queries/app";
import { ReportsFilter } from "@/components/reports-filter";

const reportOptions = [
  ["daily_movements", "تقرير الصادر والوارد اليومي"],
  ["damaged", "تقرير التالف"],
  ["burns", "تقرير المحاريق"],
  ["department_supply", "تقرير طلبيات الأقسام"],
  ["price_changes", "تقرير تذبذب الأسعار"],
  ["expiry", "تقرير المواد القريبة من انتهاء الصلاحية"],
];

const expiryRows = [
  ["لبنة", "قسم الضيافة", "2026-05-24", "قريب"],
  ["دجاج مبرد", "الشاورمة والمشاوي", "2026-05-25", "قريب"],
];

type SearchParams = Promise<{ type?: string }>;

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const activeReport = params.type || "daily_movements";

  const { dashboard, movements, purchaseOrders, wasteLogs, suppliers, branches } = await getReportsData();
  const incoming = movements.filter((movement) => movement.quantity > 0).length;
  const outgoing = movements.filter((movement) => movement.quantity < 0).length;

  const damagedLogs = wasteLogs.filter((log) => log.reason === "تلف" || log.reason === "سبب آخر");
  const burnsLogs = wasteLogs.filter((log) => log.reason === "محاريق");

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
          <Select className="max-w-64" defaultValue="all">
            <option value="all">كل الأقسام</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <ReportsFilter activeReport={activeReport} reportOptions={reportOptions} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="التالف" value={formatNumber(damagedLogs.length)} description="سجلات تلف" icon={PackageMinus} tone="danger" />
        <MetricCard label="المحاريق" value={formatNumber(burnsLogs.length)} description="سجلات محاريق" icon={Flame} tone="warning" />
        <MetricCard label="الصادر والوارد" value={`${formatNumber(incoming)} / ${formatNumber(outgoing)}`} description="وارد / صادر" icon={Truck} tone="success" />
        <MetricCard label="طلبيات الأقسام" value={formatNumber(purchaseOrders.length)} description="طلبات مفتوحة وسابقة" icon={ClipboardCheck} />
        <MetricCard label="انتهاء الصلاحية" value={formatNumber(expiryRows.length)} description="مواد قريبة" icon={AlertTriangle} tone="warning" />
      </div>

      <div className="mt-4">
        {activeReport === "daily_movements" && (
          <div className="grid gap-4 xl:grid-cols-2">
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
          </div>
        )}

        {activeReport === "damaged" && (
          <Card>
            <CardHeader>
              <CardTitle>تقرير التالف</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>القسم</TableHead>
                    <TableHead>المادة</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>التكلفة</TableHead>
                    <TableHead>الملاحظات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {damagedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{new Date(log.loggedAt).toLocaleDateString("ar-PS")}</TableCell>
                      <TableCell>{log.branchName}</TableCell>
                      <TableCell className="font-bold">{log.itemName}</TableCell>
                      <TableCell>{formatNumber(log.quantity)}</TableCell>
                      <TableCell>{formatCurrency(log.cost)}</TableCell>
                      <TableCell>{log.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {activeReport === "burns" && (
          <Card>
            <CardHeader>
              <CardTitle>تقرير المحاريق</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>القسم</TableHead>
                    <TableHead>المادة</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>التكلفة</TableHead>
                    <TableHead>الملاحظات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {burnsLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{new Date(log.loggedAt).toLocaleDateString("ar-PS")}</TableCell>
                      <TableCell>{log.branchName}</TableCell>
                      <TableCell className="font-bold">{log.itemName}</TableCell>
                      <TableCell>{formatNumber(log.quantity)}</TableCell>
                      <TableCell>{formatCurrency(log.cost)}</TableCell>
                      <TableCell>{log.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {activeReport === "department_supply" && (
          <Card>
            <CardHeader>
              <CardTitle>تقرير طلبيات الأقسام</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الرقم</TableHead>
                    <TableHead>القسم الطالب</TableHead>
                    <TableHead>القسم المستلم</TableHead>
                    <TableHead>المجموع</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders.map((order) => {
                    const toBranchName = order.notes?.match(/\[إلى:\s*([^\]]+)\]/)?.[1] || "المخزن الرئيسي";
                    return (
                      <TableRow key={order.id}>
                        <TableCell>{order.orderDate}</TableCell>
                        <TableCell className="font-bold text-xs truncate max-w-28" title={order.id}>{order.id.slice(0, 8)}</TableCell>
                        <TableCell>{order.branchName}</TableCell>
                        <TableCell>{toBranchName}</TableCell>
                        <TableCell>{formatCurrency(order.total)}</TableCell>
                        <TableCell>
                          <Badge tone="default">{order.status}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {activeReport === "price_changes" && (
          <Card>
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
        )}

        {activeReport === "expiry" && (
          <Card>
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
        )}
      </div>
    </>
  );
}
