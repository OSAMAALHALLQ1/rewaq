import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  ChefHat,
  ClipboardCheck,
  PackageOpen,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { quantitiesByItem } from "@/lib/inventory/ledger";
import { includesNormalized } from "@/lib/search/match";
import { saveInventoryItemAction } from "@/server/actions/mutations";
import { getInventoryData } from "@/server/queries/app";

interface SearchParams {
  warehouse?: string;
  q?: string;
  category?: string;
  branch?: string;
  page?: string;
  [key: string]: string | string[] | undefined;
}

const ITEMS_PER_PAGE = 50;

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const warehouse = stringParam(params.warehouse);
  const searchQuery = stringParam(params.q);
  const categoryId = stringParam(params.category);
  const branchId = stringParam(params.branch);
  const requestedPage = Number.parseInt(stringParam(params.page), 10);
  const { items, categories, branchStock, suppliers, branches } = await getInventoryData();
  const savedCategories = categories.filter((category) => !category.id.startsWith("suggested-"));
  const categoryNames = categories.map((category) => category.name);

  const stockInScope = branchId ? branchStock.filter((stock) => stock.branchId === branchId) : branchStock;
  const quantityByItem = quantitiesByItem(stockInScope);
  const filteredItems = items.filter((item) =>
    (!warehouse || item.warehouse === warehouse) &&
    (!categoryId || item.categoryId === categoryId) &&
    includesNormalized(searchQuery, [item.name, item.sku]),
  );
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const currentPage = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;
  const pageItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const inventoryHref = (page: number) => {
    const query = new URLSearchParams();
    if (warehouse) query.set("warehouse", warehouse);
    if (searchQuery) query.set("q", searchQuery);
    if (categoryId) query.set("category", categoryId);
    if (branchId) query.set("branch", branchId);
    if (page > 1) query.set("page", String(page));
    const serialized = query.toString();
    return `/dashboard/inventory${serialized ? `?${serialized}` : ""}`;
  };

  const allTab = [
    { key: "", label: "كل المخزون", count: items.length, icon: Boxes },
    { key: "kitchen", label: "مستودع المطبخ", count: items.filter((i) => i.warehouse === "kitchen").length, icon: ChefHat },
    { key: "general", label: "المستودع العام", count: items.filter((i) => i.warehouse === "general").length, icon: Warehouse },
  ];

  // Stats
  const totalValue = filteredItems.reduce((sum, item) => {
    const qty = quantityByItem.get(item.id) ?? 0;
    return sum + qty * (item.averageCost || 0);
  }, 0);

  const outOfStock = filteredItems.filter((item) =>
    (quantityByItem.get(item.id) ?? 0) <= 0
  ).length;

  const lowStock = filteredItems.filter((item) => {
    const qty = quantityByItem.get(item.id) ?? 0;
    return qty > 0 && qty <= item.minimumQuantity;
  }).length;

  return (
    <>
      <PageHeader
        title={
          warehouse === "general"
            ? "المستودع العام"
            : warehouse === "kitchen"
              ? "مستودع المطبخ"
              : "مخطط المخزن"
        }
        description={
          warehouse === "general"
            ? "متابعة المواد والتغليف والمستهلكات في المستودع العام للمطعم."
            : warehouse === "kitchen"
              ? "متابعة المواد الغذائية ومكونات التحضير الفورية داخل مستودع المطبخ."
              : "متابعة المواد والكميات وحركات المخزن عبر الأقسام. كل تغيير يجب أن يولد حركة مخزون واضحة."
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/inventory/dashboard">
                <TrendingUp className="h-4 w-4" />
                لوحة التحكم
              </Link>
            </Button>
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

      {/* Quick Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">إجمالي المواد</p>
              <p className="mt-1 text-xl font-black">{formatNumber(filteredItems.length)}</p>
            </div>
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Boxes className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">قيمة المخزون</p>
              <p className="mt-1 text-xl font-black">{formatCurrency(totalValue)}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">مواد نافدة</p>
              <p className="mt-1 text-xl font-black">{outOfStock}</p>
            </div>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
              <PackageOpen className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">أقل من الحد الأدنى</p>
              <p className="mt-1 text-xl font-black">{lowStock}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warehouse Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-1.5">
        {allTab.map((tab) => {
          const active = (warehouse ?? "") === tab.key;
          return (
            <Link
              key={tab.key || "all"}
              href={tab.key ? `/dashboard/inventory?warehouse=${tab.key}` : "/dashboard/inventory"}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_360px]">
        <Card className="md:col-span-2 xl:col-span-1">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>مواد المخزون</CardTitle>
              <form action="/dashboard/inventory" className="flex flex-wrap gap-2">
                {warehouse ? <input type="hidden" name="warehouse" value={warehouse} /> : null}
                <div className="relative min-w-0 flex-1 sm:min-w-64">
                  <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input name="q" defaultValue={searchQuery} className="ps-9" placeholder="بحث بالاسم أو الرمز أو الباركود..." />
                </div>
                <Select name="category" className="w-32 sm:w-40" defaultValue={categoryId}>
                  <option value="">كل الفئات</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
                <Select name="branch" className="w-32 sm:w-48" defaultValue={branchId}>
                  <option value="">كل الفروع</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
                <Button type="submit" variant="outline" size="icon" aria-label="تطبيق الفلاتر">
                  <Search className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">المادة</TableHead>
                  <TableHead className="hidden md:table-cell">الفئة</TableHead>
                  <TableHead className="hidden lg:table-cell">المورد</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>التكلفة</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((item) => {
                  const totalQuantity = quantityByItem.get(item.id) ?? 0;
                  const isLow = totalQuantity > 0 && totalQuantity <= item.minimumQuantity;
                  const isOut = totalQuantity <= 0;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link href={`/dashboard/inventory/${item.id}`} className="font-semibold text-primary hover:underline">
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
                        <div className="text-xs font-medium">{formatCurrency(item.averageCost)}</div>
                        <p className="text-[10px] text-muted-foreground">متوسط</p>
                      </TableCell>
                      <TableCell>
                        {isOut ? (
                          <Badge tone="danger">نافد</Badge>
                        ) : isLow ? (
                          <Badge tone="warning">منخفض</Badge>
                        ) : (
                          <StatusBadge status={item.isActive ? "active" : "inactive"} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {pageItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      لا توجد مواد تطابق الفلاتر المحددة.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4 text-sm">
              <span className="text-muted-foreground">
                عرض {formatNumber(pageItems.length)} من {formatNumber(filteredItems.length)} مادة
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild disabled={currentPage <= 1}>
                  <Link href={inventoryHref(currentPage - 1)}>السابق</Link>
                </Button>
                <span className="flex items-center px-2 text-xs font-bold text-muted-foreground">
                  صفحة {formatNumber(currentPage)} من {formatNumber(totalPages)}
                </span>
                <Button variant="outline" size="sm" asChild disabled={currentPage >= totalPages}>
                  <Link href={inventoryHref(currentPage + 1)}>التالي</Link>
                </Button>
              </div>
            </div>
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
              <input type="hidden" name="warehouse" value={warehouse || "general"} />
              <div className="grid gap-2">
                <Label htmlFor="name">الاسم</Label>
                <Input id="name" name="name" placeholder="مثال: دجاج" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="categoryId">الفئة</Label>
                <Select id="categoryId" name="categoryId">
                  <option value="">اختر فئة محفوظة</option>
                  {savedCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="categoryName">أو أضف فئة جديدة</Label>
                <Input id="categoryName" name="categoryName" list="inventory-category-options" placeholder="مثال: بهارات" />
                <datalist id="inventory-category-options">
                  {categoryNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
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
                  <Label htmlFor="lastPurchasePrice">آخر سعر شراء</Label>
                  <Input id="lastPurchasePrice" name="lastPurchasePrice" type="number" step="0.01" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="averageCost">متوسط التكلفة</Label>
                  <Input id="averageCost" name="averageCost" type="number" step="0.01" required />
                </div>
              </div>
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
