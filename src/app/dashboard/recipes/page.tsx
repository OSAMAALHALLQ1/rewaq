import Link from "next/link";
import { ChefHat, Plus } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { saveRecipeAction } from "@/server/actions/mutations";
import { getRecipesData } from "@/server/queries/app";

export default async function RecipesPage() {
  const { recipes } = await getRecipesData();

  return (
    <>
      <PageHeader
        title="الوصفات"
        description="احسب تكلفة كل وصفة من مواد المخزون مع تحذيرات عند تجاوز نسبة تكلفة الطعام المستهدفة."
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
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
            <ActionForm action={saveRecipeAction} submitLabel="حفظ الوصفة" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">اسم الوصفة</Label>
                <Input id="name" name="name" placeholder="مثال: برجر دجاج" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">التصنيف</Label>
                <Input id="category" name="category" placeholder="وجبات" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="servings">عدد الحصص</Label>
                <Input id="servings" name="servings" type="number" defaultValue="1" min="1" required />
              </div>
              <div className="rounded-lg border bg-slate-50 p-3 text-sm leading-6 text-muted-foreground">
                جدول recipe_ingredients في قاعدة البيانات يحفظ المكونات والكميات ووحدات الاستخدام.
              </div>
              <div className="grid gap-2">
                <Label htmlFor="preparation">طريقة التحضير</Label>
                <Textarea id="preparation" name="preparation" />
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
