import Link from "next/link";
import { ClipboardCheck, Download, Plus, Search, Trash2 } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/utils";
import { saveInventoryItemAction } from "@/server/actions/mutations";
import { getInventoryData } from "@/server/queries/app";

export default async function InventoryPage() {
  const { items, categories, branchStock, suppliers, branches } = await getInventoryData();

  return (
    <>
      <PageHeader
        title="مخطط المخزن"
        description="متابعة المواد والكميات وحركات المخزن عبر الأقسام. كل تغيير يجب أن يولد حركة مخزون واضحة."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/stock-counts">
                <ClipboardCheck className="h-4 w-4" />
                بدء جرد
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/waste">
                <Trash2 className="h-4 w-4" />
                تسجيل تالف
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_360px]">
        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>مواد المخزون</CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-0 flex-1 sm:min-w-64">
                  <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="ps-9" placeholder="بحث..." />
                </div>
                <Select className="w-32 sm:w-40" defaultValue="all">
                  <option value="all">كل الفئات</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
                <Select className="w-32 sm:w-48" defaultValue="all">
                  <option value="all">كل الفروع</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
                <Button variant="outline" size="icon" aria-label="تصدير CSV">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">المادة</TableHead>
                  <TableHead className="hidden md:table-cell">الفئة</TableHead>
                  <TableHead className="hidden lg:table-cell">المورد</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const totalQuantity = branchStock
                    .filter((stock) => stock.itemId === item.id)
                    .reduce((sum, stock) => sum + stock.quantity, 0);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link href={`/dashboard/inventory/${item.id}`} className="font-semibold text-primary">
                          {item.name}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground md:hidden">{item.sku ?? ""}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{item.categoryName}</TableCell>
                      <TableCell className="hidden lg:table-cell">{item.primarySupplierName ?? "-"}</TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {formatNumber(totalQuantity)} {item.usageUnit}
                        </div>
                        <p className="text-xs text-muted-foreground">كمية حالية</p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.isActive ? "active" : "inactive"} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              إضافة مادة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveInventoryItemAction} submitLabel="حفظ المادة" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">الاسم</Label>
                <Input id="name" name="name" placeholder="مثال: دجاج" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="categoryId">الفئة</Label>
                <Select id="categoryId" name="categoryId" required>
                  <option value="">اختر</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="purchaseUnit">وحدة الشراء</Label>
                  <Input id="purchaseUnit" name="purchaseUnit" placeholder="كرتونة" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="usageUnit">وحدة الاستخدام</Label>
                  <Input id="usageUnit" name="usageUnit" placeholder="كغم" required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="lastPurchasePrice">آخر سعر</Label>
                  <Input id="lastPurchasePrice" name="lastPurchasePrice" type="number" step="0.01" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="averageCost">المتوسط</Label>
                  <Input id="averageCost" name="averageCost" type="number" step="0.01" required />
                </div>
              </div>
              <input type="hidden" name="minimumQuantity" value="0" />
              <div className="grid gap-2">
                <Label htmlFor="primarySupplierId">المورد الأساسي</Label>
                <Select id="primarySupplierId" name="primarySupplierId">
                  <option value="">غير محدد</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea id="notes" name="notes" />
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
