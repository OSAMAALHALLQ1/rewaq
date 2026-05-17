import Link from "next/link";
import { notFound } from "next/navigation";
import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getMenuItem } from "@/server/queries/app";

export default async function MenuItemDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getMenuItem(id);
  if (!item) notFound();

  return (
    <>
      <PageHeader
        title={item.name}
        description="تحليل ربحية الطبق وسرعة تحويله إلى منشور تسويقي."
        actions={
          <Button asChild>
            <Link href={`/dashboard/marketing/create?menuItem=${item.id}`}>
              <Megaphone className="h-4 w-4" />
              حوّل هذا الطبق إلى منشور
            </Link>
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">سعر البيع</p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(item.sellingPrice)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">تكلفة الوصفة</p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(item.recipeCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">الربح الإجمالي</p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(item.grossProfit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">تكلفة الطعام</p>
            <Badge className="mt-3" tone={item.foodCostPercent > 35 ? "danger" : "success"}>
              {formatPercent(item.foodCostPercent)}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">هامش الربح</p>
            <p className="mt-2 text-2xl font-bold">{formatPercent(item.profitMarginPercent)}</p>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardContent className="p-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>تكلفة الطبق من السعر</span>
            <span>{formatPercent(item.foodCostPercent)}</span>
          </div>
          <div className="h-4 rounded-full bg-slate-100">
            <div
              className={`h-4 rounded-full ${item.foodCostPercent > 35 ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${Math.min(item.foodCostPercent, 100)}%` }}
            />
          </div>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            المعادلات: الربح الإجمالي = سعر البيع - تكلفة الوصفة، ونسبة تكلفة الطعام = تكلفة الوصفة / سعر البيع × 100.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
