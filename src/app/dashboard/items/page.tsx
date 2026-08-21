import { Barcode, ImageIcon, Plus, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";
import { getCatalogData } from "@/server/queries/app";
import { ActionForm } from "@/components/action-form";
import { saveCatalogItemAction } from "@/server/actions/mutations";
import { getCurrentSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ItemsPage() {
  const { items, categories, permissions } = await getCatalogData();
  const session = await getCurrentSession();
  const admin = createAdminClient();
  const [stationsResult, routesResult, branchesResult] = await Promise.all([
    admin.from("kitchen_stations").select("id,branch_id,name").eq("organization_id", session.organizationId).eq("is_active", true).order("name"),
    admin.from("catalog_item_kitchen_routes").select("catalog_item_id,station_id,branch_id").eq("organization_id", session.organizationId).eq("is_active", true),
    admin.from("branches").select("id,name").eq("organization_id", session.organizationId).eq("status", "active").order("name"),
  ]);
  const stations = stationsResult.data ?? [];
  const branchNameById = new Map((branchesResult.data ?? []).map((branch) => [branch.id, branch.name]));
  const stationById = new Map(stations.map((station) => [station.id, station]));
  const routeByItemId = new Map((routesResult.data ?? []).map((route) => [route.catalog_item_id, route]));
  const activeItems = items.filter((item) => item.isActive).length;
  const categoryNames = categories.map((category) => category.name);

  return (
    <>
      <PageHeader
        title="الأصناف والباركود"
        description="إدارة كود الصنف، الباركود، الوحدات، تحويل الوحدات، الفئات، وربط المواد بالمخزن."
        actions={
          <Button asChild>
            <Link href="/dashboard/inventory">
              <Plus className="h-4 w-4" />
              المخزن
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard title="إجمالي الأصناف" value={formatNumber(items.length)} />
        <SummaryCard title="أصناف نشطة" value={formatNumber(activeItems)} />
        <SummaryCard title="فئات مسجلة" value={formatNumber(categories.length)} />
        <SummaryCard title="باركودات مسجلة" value={formatNumber(items.reduce((sum, item) => sum + item.barcodes.length, 0))} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px] mt-4">
        <Card>
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
                  <TableHead>ضريبة</TableHead>
                  <TableHead>المخزون</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>قسم التحضير</TableHead>
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
                      <p className="text-xs text-muted-foreground">{item.mainUnit}</p>
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
                    <TableCell>{item.taxRate ? `${formatNumber(item.taxRate)}٪` : "بدون"}</TableCell>
                    <TableCell>
                      <Badge tone="success">{formatNumber(item.stockQuantity)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge tone={item.isActive ? "success" : "muted"}>{item.isActive ? "نشط" : "غير نشط"}</Badge>
                    </TableCell>
                    <TableCell>{(() => { const route = routeByItemId.get(item.id); const station = route ? stationById.get(route.station_id) : null; return station ? <Badge>{station.name} — {branchNameById.get(station.branch_id) ?? ""}</Badge> : <span className="text-xs text-muted-foreground">مادة مخزنية / غير مربوط</span>; })()}</TableCell>
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
              صنف جديد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveCatalogItemAction} submitLabel="حفظ الصنف" className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">اسم الصنف</Label>
                <Input id="name" name="name" placeholder="مثال: شاورما دبل" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="code">كود الصنف</Label>
                <Input id="code" name="code" placeholder="مثال: SH-001" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="categoryName">الفئة</Label>
                <Input id="categoryName" name="categoryName" list="catalog-category-options" placeholder="اختر فئة أو اكتب فئة جديدة" required />
                <datalist id="catalog-category-options">
                  {categoryNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mainUnit">الوحدة الأساسية</Label>
                <Input id="mainUnit" name="mainUnit" placeholder="مثال: وجبة" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="retailPrice">سعر البيع للتجزئة</Label>
                <Input id="retailPrice" name="retailPrice" type="number" step="0.01" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="taxRate">نسبة الضريبة (٪)</Label>
                <Input id="taxRate" name="taxRate" type="number" step="0.01" defaultValue="0" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="barcode">الباركود (اختياري)</Label>
                <Input id="barcode" name="barcode" placeholder="مثال: 6281100..." />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="preparationRoute">قسم تحضير الوجبة</Label>
                <Select id="preparationRoute" name="preparationRoute" defaultValue="">
                  <option value="">ليس وجبة / لا ترسل إلى KDS</option>
                  {stations.map((station) => <option key={station.id} value={`${station.branch_id}:${station.id}`}>{station.name} — {branchNameById.get(station.branch_id) ?? "نطاق التشغيل"}</option>)}
                </Select>
                <p className="text-xs text-muted-foreground">للوجبات اختر القسم هنا؛ بعدها يرسلها النادل تلقائياً إلى شاشة القسم.</p>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>تصنيف المواد</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {items.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-bold">{item.name}</p>
                  <p className="text-muted-foreground">{item.categoryName}</p>
                </div>
                <div className="text-end">
                  <p>{item.mainUnit}</p>
                  <p className="text-muted-foreground">{item.isActive ? "نشط" : "غير نشط"}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>صلاحيات الأصناف والمخزن</CardTitle>
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
