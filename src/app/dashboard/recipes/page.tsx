import Link from "next/link";
import { ChefHat, Plus } from "lucide-react";
import { RecipeVersionEditor } from "@/components/recipes/recipe-version-editor";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { getRecipesData } from "@/server/queries/app";

export default async function RecipesPage() {
  const { recipes, inventoryItems } = await getRecipesData();

  return (
    <>
      <PageHeader
        title="الوصفات"
        description="احسب تكلفة كل وصفة من مواد المخزون مع تحذيرات عند تجاوز نسبة تكلفة الطعام المستهدفة."
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_520px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-primary" />
              وصفات التشغيل
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الوصفة</TableHead>
                  <TableHead>التصنيف</TableHead>
                  <TableHead>الحصص</TableHead>
                  <TableHead>التكلفة</TableHead>
                  <TableHead>تكلفة الحصة</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipes.map((recipe) => (
                  <TableRow key={recipe.id}>
                    <TableCell>
                      <Link href={`/dashboard/recipes/${recipe.id}`} className="font-semibold text-primary">
                        {recipe.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{recipe.ingredients.length} مكونات</p>
                    </TableCell>
                    <TableCell>{recipe.category}</TableCell>
                    <TableCell>{recipe.servings}</TableCell>
                    <TableCell>{formatCurrency(recipe.totalCost)}</TableCell>
                    <TableCell>{formatCurrency(recipe.costPerServing)}</TableCell>
                    <TableCell>
                      {recipe.costPerServing > 5.2 ? <Badge tone="warning">راجع الربحية</Badge> : <StatusBadge status={recipe.status} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              إضافة وصفة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RecipeVersionEditor
              inventoryItems={inventoryItems.map((item) => ({
                id: item.id,
                name: item.name,
                averageCost: item.averageCost,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
