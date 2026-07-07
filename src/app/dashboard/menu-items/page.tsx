import Link from "next/link";
import { Megaphone, Plus, Utensils } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { saveMenuItemAction } from "@/server/actions/mutations";
import { getRecipesData } from "@/server/queries/app";

export default async function MenuItemsPage() {
  const { menuItems, recipes, branches } = await getRecipesData();

  return (
    <>
      <PageHeader
        title="أطباق القائمة"
        description="ربط أطباق البيع بالوصفات لحساب الربحية ونسبة تكلفة الطعام تلقائيًا."
      />
      <div className="mb-4">
        <Link href="/dashboard/modifiers" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <Plus className="h-4 w-4" /> إدارة مجموعات الإضافات (Modifiers) للأصناف
        </Link>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5 text-primary" />
              القائمة والربحية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطبق</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead>تكلفة الوصفة</TableHead>
                  <TableHead>تكلفة الطعام</TableHead>
                  <TableHead>الربح</TableHead>
                  <TableHead>إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {menuItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link href={`/dashboard/menu-items/${item.id}`} className="font-semibold text-primary">
                        {item.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{item.recipeName}</p>
                    </TableCell>
                    <TableCell>{formatCurrency(item.sellingPrice)}</TableCell>
                    <TableCell>{formatCurrency(item.recipeCost)}</TableCell>
                    <TableCell>
                      <Badge tone={item.foodCostPercent > 35 ? "danger" : "success"}>
                        {formatPercent(item.foodCostPercent)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(item.grossProfit)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/dashboard/marketing/create?menuItem=${item.id}`}>
                          <Megaphone className="h-4 w-4" />
                          منشور
                        </Link>
                      </Button>
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
              إضافة طبق
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveMenuItemAction} submitLabel="حفظ الطبق" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">اسم الطبق</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="recipeId">الوصفة</Label>
                <Select id="recipeId" name="recipeId" required>
                  <option value="">اختر</option>
                  {recipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sellingPrice">سعر البيع</Label>
                <Input id="sellingPrice" name="sellingPrice" type="number" step="0.01" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="branchId">الفرع</Label>
                <Select id="branchId" name="branchId">
                  <option value="">كل الفروع</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">الحالة</Label>
                <Select id="status" name="status" defaultValue="active">
                  <option value="active">نشط</option>
                  <option value="inactive">متوقف</option>
                </Select>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
