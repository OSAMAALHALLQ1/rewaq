import { AlertTriangle, Boxes, ChefHat, ShoppingCart, TrendingUp } from "lucide-react";
import {
  CategoryPieChart,
  FoodCostLineChart,
  PurchaseAreaChart,
  WasteBarChart,
} from "@/components/dashboard/charts";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getDashboardData } from "@/server/queries/app";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <>
      <PageHeader
        title="لوحة التحكم"
        description="نظرة تشغيلية على المخزون، المشتريات، تكلفة الطعام، الهدر، والتنبيهات اليومية."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="مبيعات تقديرية"
          value={formatCurrency(data.salesEstimate)}
          description="+8% عن الأسبوع السابق"
          icon={TrendingUp}
          tone="success"
        />
        <MetricCard
          label="تكلفة المخزون"
          value={formatCurrency(data.inventoryValue)}
          description="كل الفروع"
          icon={Boxes}
        />
        <MetricCard
          label="مواد منخفضة"
          value={`${data.lowStockCount}`}
          description="تحتاج طلب شراء"
          icon={AlertTriangle}
          tone="warning"
        />
        <MetricCard
          label="طلبات مفتوحة"
          value={`${data.openPurchaseOrders}`}
          description="قيد الإرسال والاستلام"
          icon={ShoppingCart}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>تكلفة المشتريات خلال آخر 30 يوم</CardTitle>
          </CardHeader>
          <CardContent>
            <PurchaseAreaChart data={data.purchaseCost30Days} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>مخزون حسب الفئة</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPieChart data={data.inventoryByCategory} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>نسبة تكلفة الطعام</CardTitle>
              <Badge tone={data.foodCostPercent > 35 ? "danger" : "success"}>
                {formatPercent(data.foodCostPercent)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <FoodCostLineChart data={data.foodCostTrend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>الهدر حسب الفرع</CardTitle>
          </CardHeader>
          <CardContent>
            <WasteBarChart data={data.wasteByBranch} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>التنبيهات</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.alerts.map((alert) => (
              <div key={alert.id} className="rounded-lg border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{alert.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.body}</p>
                  </div>
                  <StatusBadge status={alert.severity} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-primary" />
              أكثر الوصفات تكلفة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الوصفة</TableHead>
                  <TableHead>التصنيف</TableHead>
                  <TableHead>التكلفة</TableHead>
                  <TableHead>تحذير</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.highCostRecipes.map((recipe) => (
                  <TableRow key={recipe.id}>
                    <TableCell className="font-medium">{recipe.name}</TableCell>
                    <TableCell>{recipe.category}</TableCell>
                    <TableCell>{formatCurrency(recipe.totalCost)}</TableCell>
                    <TableCell>
                      <Badge tone={recipe.totalCost > 6 ? "warning" : "muted"}>راجع السعر</Badge>
                    </TableCell>
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
