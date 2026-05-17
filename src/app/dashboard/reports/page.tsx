import Link from "next/link";
import { CalendarDays, CircleDollarSign, Download, FileBarChart } from "lucide-react";
import { FoodCostLineChart, PurchaseAreaChart, WasteBarChart } from "@/components/dashboard/charts";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getReportsData } from "@/server/queries/app";

export default async function ReportsPage() {
  const { dashboard, menuItems, suppliers, branches } = await getReportsData();

  return (
    <>
      <PageHeader
        title="التقارير"
        description="تقارير قيمة المخزون، انخفاض المواد، المشتريات، تغير الأسعار، الهدر، ربحية الوصفات، ومقارنة الفروع."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/dashboard/amwali">
                <CircleDollarSign className="h-4 w-4" />
                أموالي
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/financial-calendar">
                <CalendarDays className="h-4 w-4" />
                التقويم المالي
              </Link>
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4" />
              تصدير ملف
            </Button>
          </div>
        }
      />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-3 p-4">
          <Input className="max-w-44" type="date" defaultValue="2026-05-01" />
          <Input className="max-w-44" type="date" defaultValue="2026-05-16" />
          <Select className="max-w-64" defaultValue="all">
            <option value="all">كل الفروع</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <Select className="max-w-64" defaultValue="inventory_value">
            <option value="inventory_value">تقرير قيمة المخزون</option>
            <option value="low_stock">تقرير المواد المنخفضة</option>
            <option value="purchases">تقرير المشتريات</option>
            <option value="supplier_price_changes">تقرير تغير أسعار الموردين</option>
            <option value="waste">تقرير الهدر</option>
            <option value="recipe_profitability">تقرير ربحية الوصفات</option>
            <option value="food_cost">تقرير تكلفة الطعام</option>
            <option value="branch_comparison">مقارنة الفروع</option>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="قيمة المخزون" value={formatCurrency(dashboard.inventoryValue)} description="تقرير قيمة المخزون" icon={FileBarChart} />
        <MetricCard label="تكلفة الطعام" value={formatPercent(dashboard.foodCostPercent)} description="آخر 30 يوم" icon={FileBarChart} tone="warning" />
        <MetricCard label="الهدر" value={formatCurrency(670)} description="تقرير الهدر" icon={FileBarChart} tone="danger" />
        <MetricCard label="موردون ارتفع سعرهم" value="2" description="تغير أسعار الموردين" icon={FileBarChart} tone="warning" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>تقرير المشتريات</CardTitle>
          </CardHeader>
          <CardContent>
            <PurchaseAreaChart data={dashboard.purchaseCost30Days} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>تقرير تكلفة الطعام</CardTitle>
          </CardHeader>
          <CardContent>
            <FoodCostLineChart data={dashboard.foodCostTrend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>تقرير الهدر</CardTitle>
          </CardHeader>
          <CardContent>
            <WasteBarChart data={dashboard.wasteByBranch} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ربحية الوصفات</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطبق</TableHead>
                  <TableHead>تكلفة الطعام</TableHead>
                  <TableHead>الهامش</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {menuItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{formatPercent(item.foodCostPercent)}</TableCell>
                    <TableCell>{formatPercent(item.profitMarginPercent)}</TableCell>
                    <TableCell>
                      <Badge tone={item.foodCostPercent > 35 ? "danger" : "success"}>
                        {item.foodCostPercent > 35 ? "راجع السعر" : "مربح"}
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
            <CardTitle>تغير أسعار الموردين</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المورد</TableHead>
                  <TableHead>المخاطر</TableHead>
                  <TableHead>التوصية</TableHead>
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
                    <TableCell>{supplier.priceRisk > 15 ? "راجع البدائل" : "راقب الفاتورة القادمة"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
