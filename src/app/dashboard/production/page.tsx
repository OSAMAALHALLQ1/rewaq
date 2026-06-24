import { Factory, Plus, Utensils } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { saveProductionOrderAction } from "@/server/actions/mutations";
import { getProductionData } from "@/server/queries/production";

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  completed: "منجز",
  cancelled: "ملغي",
};

export default async function ProductionPage() {
  const { orders, recipes, branches } = await getProductionData();

  return (
    <>
      <PageHeader
        title="أوامر الإنتاج وصرف المطبخ"
        description="إنتاج دفعات من الوصفات مع خصم المواد الخام من مستودع المطبخ أو المستودع العام وتسجيل حركات المخزون."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-primary" />
              سجل أوامر الإنتاج
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الأمر</TableHead>
                  <TableHead>الوصفة</TableHead>
                  <TableHead>فرع الإنتاج</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>تكلفة المواد</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>تاريخ الإنجاز</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      لا توجد أوامر إنتاج بعد.
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-semibold">{order.orderNumber}</TableCell>
                      <TableCell>
                        <span className="font-medium">{order.recipeName}</span>
                        {order.materials.length > 0 ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {order.materials.map((material) => material.itemName).join("، ")}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>{order.branchName}</TableCell>
                      <TableCell>
                        {formatNumber(order.completedQuantity)} / {formatNumber(order.plannedQuantity)}
                      </TableCell>
                      <TableCell>{formatCurrency(order.materialCost)}</TableCell>
                      <TableCell>
                        <Badge tone={order.status === "completed" ? "success" : order.status === "cancelled" ? "danger" : "warning"}>
                          {statusLabels[order.status] ?? order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{order.completedAt ? new Date(order.completedAt).toLocaleString("ar-PS") : "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              أمر إنتاج جديد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveProductionOrderAction} submitLabel="تنفيذ أمر الإنتاج" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="recipeId">الوصفة</Label>
                <Select id="recipeId" name="recipeId" required>
                  <option value="">اختر الوصفة</option>
                  {recipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.name} - {formatNumber(recipe.servings)} حصة أساس
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="branchId">فرع/مستودع الإنتاج</Label>
                <Select id="branchId" name="branchId" required>
                  <option value="">اختر مكان الإنتاج</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sourceBranchId">مستودع صرف المواد</Label>
                <Select id="sourceBranchId" name="sourceBranchId" required>
                  <option value="">اختر مستودع الصرف</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="plannedQuantity">الكمية المخططة</Label>
                  <Input id="plannedQuantity" name="plannedQuantity" type="number" min="0.01" step="0.01" defaultValue="1" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="completedQuantity">الكمية المنتجة</Label>
                  <Input id="completedQuantity" name="completedQuantity" type="number" min="0.01" step="0.01" defaultValue="1" required />
                </div>
              </div>

              <label className="flex items-center gap-2 rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
                <input name="allowNegativeStock" type="checkbox" value="true" className="h-4 w-4 rounded border-slate-300" />
                السماح بالصرف حتى لو الرصيد غير كاف
              </label>

              <div className="grid gap-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea id="notes" name="notes" placeholder="مثال: إنتاج تجهيز صباحي للغداء" />
              </div>

              <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm leading-6 text-teal-900">
                <div className="mb-1 flex items-center gap-2 font-semibold">
                  <Utensils className="h-4 w-4" />
                  طريقة الاحتساب
                </div>
                يتم ضرب مكونات الوصفة بنسبة الكمية المنتجة إلى حصص الوصفة، مع تحميل نسبة التصافي، ثم تسجيل صرف مخزون لكل مادة.
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
