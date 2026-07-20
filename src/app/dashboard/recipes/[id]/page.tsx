import { notFound } from "next/navigation";
import { ChefHat } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getRecipe } from "@/server/queries/app";

export default async function RecipeDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getRecipe(id);
  if (!data) notFound();

  const { recipe, menuItems } = data;
  const foodCosts = menuItems.map((item) => item.foodCostPercent);
  const minFoodCost = foodCosts.length > 0 ? Math.min(...foodCosts) : null;
  const maxFoodCost = foodCosts.length > 0 ? Math.max(...foodCosts) : null;
  const foodCostLabel =
    minFoodCost === null || maxFoodCost === null
      ? "-"
      : minFoodCost === maxFoodCost
        ? formatPercent(minFoodCost)
        : `${formatPercent(minFoodCost)} – ${formatPercent(maxFoodCost)}`;

  return (
    <>
      <PageHeader
        title={recipe.name}
        description="حساب تكلفة الوصفة من مواد المخزون، مع تكلفة كل مكون والحصة الواحدة."
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
            <p className="mt-2 text-2xl font-bold">{foodCostLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">ارتباطات القائمة</p>
            <Badge className="mt-3" tone={menuItems.length > 0 ? "success" : "muted"}>
              {menuItems.length > 0 ? `${menuItems.length} طبق مرتبط` : "لا يوجد طبق مرتبط"}
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
              {menuItems.length > 0 ? (
                <div className="space-y-2">
                  {menuItems.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex justify-between gap-3 font-bold"><span>{item.name}</span><span>{formatCurrency(item.sellingPrice)}</span></div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <span>التكلفة: {formatPercent(item.foodCostPercent)}</span>
                        <span>الربح: {formatCurrency(item.grossProfit)}</span>
                        <span>الهامش: {formatPercent(item.profitMarginPercent)}</span>
                      </div>
                    </div>
                  ))}
                </div>
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
