import { Barcode, ImageIcon, Plus, Search, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { getCatalogData } from "@/server/queries/app";

export default async function ItemsPage() {
  const { items, categories, permissions } = await getCatalogData();
  const activeItems = items.filter((item) => item.isActive).length;
  const lowStockItems = items.filter((item) => item.stockQuantity <= item.minimumQuantity).length;

  return (
    <>
      <PageHeader
        title="الأصناف والباركود"
        description="إدارة كود الصنف، الباركود، الوحدات، تحويل الوحدات، الأسعار، الضريبة، والحد الأدنى."
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            صنف جديد
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="إجمالي الأصناف" value={formatNumber(items.length)} />
        <SummaryCard title="أصناف نشطة" value={formatNumber(activeItems)} />
        <SummaryCard title="تحت الحد الأدنى" value={formatNumber(lowStockItems)} tone="warning" />
        <SummaryCard title="باركودات مسجلة" value={formatNumber(items.reduce((sum, item) => sum + item.barcodes.length, 0))} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Barcode className="h-5 w-5 text-primary" />
              دفتر الأصناف
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative w-full max-w-72">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="ps-9" placeholder="بحث بالصنف أو الباركود" />
              </div>
              <Select className="max-w-60" defaultValue="all">
                <option value="all">كل الفئات</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
              <Button variant="outline">
                <SlidersHorizontal className="h-4 w-4" />
                فلاتر
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الصورة</TableHead>
                <TableHead>كود الصنف</TableHead>
                <TableHead>اسم الصنف</TableHead>
                <TableHead>باركود</TableHead>
                <TableHead>الفئة</TableHead>
                <TableHead>الوحدات</TableHead>
                <TableHead>سعر الشراء</TableHead>
                <TableHead>سعر المفرق</TableHead>
                <TableHead>سعر الجملة</TableHead>
                <TableHead>ضريبة</TableHead>
                <TableHead>المخزون</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="grid h-11 w-11 place-items-center rounded-lg border bg-slate-50 text-muted-foreground">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                  </TableCell>
                  <TableCell className="font-bold">{item.code}</TableCell>
                  <TableCell>
                    <div className="font-semibold">{item.name}</div>
                    <p className="text-xs text-muted-foreground">
                      حد أدنى {formatNumber(item.minimumQuantity)} {item.mainUnit}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {item.barcodes.map((barcode) => (
                        <Badge key={barcode} tone="muted">
                          {barcode}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{item.categoryName}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {item.units.map((unit) => (
                        <p key={unit.name} className="text-xs">
                          {unit.name} = {formatNumber(unit.factor)} {item.mainUnit}
                        </p>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(item.purchasePrice)}</TableCell>
                  <TableCell>{formatCurrency(item.retailPrice)}</TableCell>
                  <TableCell>{formatCurrency(item.wholesalePrice)}</TableCell>
                  <TableCell>{item.taxRate ? `${formatNumber(item.taxRate)}٪` : "بدون"}</TableCell>
                  <TableCell>
                    <Badge tone={item.stockQuantity <= item.minimumQuantity ? "warning" : "success"}>
                      {formatNumber(item.stockQuantity)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge tone={item.isActive ? "success" : "muted"}>{item.isActive ? "نشط" : "غير نشط"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>الأسعار الخاصة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {items.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-bold">{item.name}</p>
                  <p className="text-muted-foreground">عميل خاص وفرع خاص</p>
                </div>
                <div className="text-end">
                  <p>{formatCurrency(item.customerPrice ?? item.retailPrice)}</p>
                  <p className="text-muted-foreground">{formatCurrency(item.branchPrice ?? item.retailPrice)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>صلاحيات الأصناف والبيع</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {permissions.map((permission) => (
              <div key={permission.key} className="flex items-center justify-between rounded-lg border p-3">
                <p className="font-bold">{permission.label}</p>
                <p className="text-muted-foreground">{permission.roles.length} أدوار</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function SummaryCard({ title, value, tone = "default" }: { title: string; value: string; tone?: "default" | "warning" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className={tone === "warning" ? "mt-2 text-2xl font-black text-amber-600" : "mt-2 text-2xl font-black text-primary"}>{value}</p>
      </CardContent>
    </Card>
  );
}
