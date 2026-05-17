import { notFound } from "next/navigation";
import { ChefHat, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getRecipe } from "@/server/queries/app";

export default async function RecipeDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getRecipe(id);
  if (!data) notFound();

  const { recipe, menuItems } = data;
  const firstMenuItem = menuItems[0];
  const foodCost = firstMenuItem?.foodCostPercent ?? 0;

  return (
    <>
      <PageHeader
        title={recipe.name}
        description="حساب تكلفة الوصفة من مواد المخزون، مع تكلفة كل مكون والحصة الواحدة."
        actions={
          firstMenuItem ? (
            <Button>
              <Megaphone className="h-4 w-4" />
              حوّل هذا الطبق إلى منشور
            </Button>
          ) : null
        }
      />
      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">تكلفة الوصفة</p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(recipe.totalCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">تكلفة الحصة</p>
            <p className="mt-2 text-2xl font-bold">{formatCurrency(recipe.costPerServing)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">تكلفة الطعام</p>
            <p className="mt-2 text-2xl font-bold">{firstMenuItem ? formatPercent(foodCost) : "-"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">الحالة</p>
            <Badge className="mt-3" tone={foodCost > 35 ? "danger" : "success"}>
              {foodCost > 35 ? "أعلى من 35%" : "ضمن الهدف"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-primary" />
              المكونات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المكون</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>تكلفة الوحدة</TableHead>
                  <TableHead>التكلفة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipe.ingredients.map((ingredient) => (
                  <TableRow key={ingredient.itemId}>
                    <TableCell className="font-medium">{ingredient.itemName}</TableCell>
                    <TableCell>
                      {ingredient.quantity} {ingredient.unit}
                    </TableCell>
                    <TableCell>{formatCurrency(ingredient.unitCost)}</TableCell>
                    <TableCell>{formatCurrency(ingredient.totalCost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>التكلفة والربح</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span>تكلفة الوصفة</span>
                  <span>{formatCurrency(recipe.costPerServing)}</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100">
                  <div className="h-3 rounded-full bg-accent" style={{ width: `${Math.min(foodCost, 100)}%` }} />
                </div>
              </div>
              {firstMenuItem ? (
                <>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">سعر البيع</p>
                    <p className="text-2xl font-bold">{formatCurrency(firstMenuItem.sellingPrice)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">الربح الإجمالي</p>
                      <p className="font-bold">{formatCurrency(firstMenuItem.grossProfit)}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground">الهامش</p>
                      <p className="font-bold">{formatPercent(firstMenuItem.profitMarginPercent)}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">لا يوجد طبق قائمة مرتبط بهذه الوصفة بعد.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
