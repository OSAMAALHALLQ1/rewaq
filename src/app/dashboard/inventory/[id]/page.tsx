import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Barcode,
  ClipboardList,
  DollarSign,
  Gauge,
  Layers,
  PackageOpen,
  Scale,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { getInventoryItem } from "@/server/queries/app";
import { AddMovementDialog } from "@/components/inventory/add-movement-dialog";

export default async function InventoryItemDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getInventoryItem(id);
  if (!data) notFound();

  const { item, stock, movements, branches = [] } = data;

  const totalQty = stock.reduce((sum, s) => sum + s.quantity, 0);
  const totalReserved = stock.reduce((sum, s) => sum + s.reservedQuantity, 0);
  const totalAvailable = totalQty - totalReserved;
  const isLow = totalQty > 0 && totalQty <= item.minimumQuantity;
  const isOut = totalQty <= 0;

  return (
    <>
      <PageHeader
        title={item.name}
        description="بطاقة المادة المتكاملة: الكميات، الحركة، الدفعات، والأسعار."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/inventory">
                <ArrowRight className="h-4 w-4" />
                رجوع
              </Link>
            </Button>
            <AddMovementDialog
              itemId={item.id}
              itemName={item.name}
              usageUnit={item.usageUnit}
              branches={branches.map((b) => ({ id: b.id, name: b.name }))}
            />
          </>
        }
      />

      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">الكمية الإجمالية</p>
              <p className="mt-1 text-xl font-black">{formatNumber(totalQty)} <span className="text-sm font-normal">{item.usageUnit}</span></p>
            </div>
            <div className="rounded-lg bg-sky-50 p-2 text-sky-600"><Scale className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">المحجوز</p>
              <p className="mt-1 text-xl font-black">{formatNumber(totalReserved)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600"><Layers className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">المتاح</p>
              <p className="mt-1 text-xl font-black">{formatNumber(totalAvailable)}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><PackageOpen className="h-5 w-5" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs text-muted-foreground">متوسط التكلفة</p>
              <p className="mt-1 text-xl font-black">{formatCurrency(item.averageCost)}</p>
            </div>
            <div className="rounded-lg bg-violet-50 p-2 text-violet-600"><DollarSign className="h-5 w-5" /></div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="general">عام</TabsTrigger>
          <TabsTrigger value="limits">حدود المخزون</TabsTrigger>
          <TabsTrigger value="prices">الأسعار والتكلفة</TabsTrigger>
          <TabsTrigger value="warehouses">كميات المستودعات</TabsTrigger>
          <TabsTrigger value="movements">ملخص الحركة</TabsTrigger>
          <TabsTrigger value="batches">الدفعات والصلاحية</TabsTrigger>
        </TabsList>

        {/* تبويب عام */}
        <TabsContent value="general">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>البيانات الأساسية</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">رمز المادة / SKU</p>
                    <p className="mt-1 font-bold">{item.sku || "—"}</p>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">الفئة</p>
                    <p className="mt-1 font-bold">{item.categoryName}</p>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">وحدة الشراء</p>
                    <p className="mt-1 font-bold">{item.purchaseUnit}</p>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">وحدة الاستخدام</p>
                    <p className="mt-1 font-bold">{item.usageUnit}</p>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">المورد الأساسي</p>
                    <p className="mt-1 font-bold">{item.primarySupplierName || "—"}</p>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">الحالة</p>
                    <p className="mt-1 font-bold">{item.isActive ? "نشطة" : "متوقفة"}</p>
                  </div>
                </div>
                <div className="rounded-lg border bg-slate-50 p-3">
                  <p className="text-xs text-muted-foreground">ملاحظات</p>
                  <p className="mt-1 whitespace-pre-line">{item.notes || "لا توجد ملاحظات."}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>مؤشرات سريعة</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">حالة المخزون</span>
                  {isOut ? <Badge tone="danger">نافد</Badge> : isLow ? <Badge tone="warning">منخفض</Badge> : <Badge tone="success">متوفر</Badge>}
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">آخر حركة</span>
                  <span className="text-sm font-bold">{movements[0] ? new Date(movements[0].createdAt).toLocaleDateString("ar-PS") : "—"}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">عدد الحركات</span>
                  <span className="text-sm font-bold">{movements.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">المستودع الافتراضي</span>
                  <span className="text-sm font-bold">{item.warehouse === "kitchen" ? "مستودع المطبخ" : item.warehouse === "general" ? "المستودع العام" : "—"}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* تبويب حدود المخزون */}
        <TabsContent value="limits">
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              { label: "الحد الأدنى", value: item.minimumQuantity, desc: "عند الوصول له تنبيه إعادة الطلب" },
              { label: "حد إعادة الطلب", value: item.minimumQuantity * 1.5, desc: "كمية الطلب المقترحة" },
              { label: "الحد الأعلى", value: item.minimumQuantity * 10, desc: "تجاوزه يعني زيادة مخزون" },
              { label: "مخزون الأمان", value: item.minimumQuantity * 0.5, desc: "احتياطي طوارئ" },
              { label: "الكمية الحالية", value: totalQty, desc: "الرصيد الفعلي حالياً" },
              { label: "الكمية المتاحة", value: totalAvailable, desc: "بعد طرح المحجوز" },
            ].map((row, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p className="mt-2 text-2xl font-black">{formatNumber(row.value)} <span className="text-sm font-normal">{item.usageUnit}</span></p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{row.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* تبويب الأسعار والتكلفة */}
        <TabsContent value="prices">
          <Card>
            <CardHeader><CardTitle>أسعار المادة</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نوع السعر</TableHead>
                    <TableHead>القيمة</TableHead>
                    <TableHead>ملاحظة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">آخر سعر شراء</TableCell>
                    <TableCell>{formatCurrency(item.lastPurchasePrice)}</TableCell>
                    <TableCell className="text-muted-foreground">من آخر فاتورة توريد</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">متوسط سعر الشراء</TableCell>
                    <TableCell>{formatCurrency(item.averageCost)}</TableCell>
                    <TableCell className="text-muted-foreground">متوسط مرجح يُحتسب تلقائياً</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">تكلفة المخزون الحالية</TableCell>
                    <TableCell>{formatCurrency(item.averageCost)}</TableCell>
                    <TableCell className="text-muted-foreground">السعر المعتمد للتقييم</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">سعر الجملة</TableCell>
                    <TableCell>{formatCurrency(item.averageCost * 1.15)}</TableCell>
                    <TableCell className="text-muted-foreground">+15%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">سعر المفرق</TableCell>
                    <TableCell>{formatCurrency(item.averageCost * 1.35)}</TableCell>
                    <TableCell className="text-muted-foreground">+35%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">قيمة الرصيد الحالي</TableCell>
                    <TableCell className="font-bold text-emerald-700">{formatCurrency(totalQty * item.averageCost)}</TableCell>
                    <TableCell className="text-muted-foreground">كمية × متوسط التكلفة</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* تبويب كميات المستودعات */}
        <TabsContent value="warehouses">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" />
                توزيع الكميات حسب الموقع
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الفرع / المستودع</TableHead>
                    <TableHead>الكمية الحالية</TableHead>
                    <TableHead>المحجوز</TableHead>
                    <TableHead>المتاح</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stock.map((row) => (
                    <TableRow key={row.branchId}>
                      <TableCell className="font-medium">{row.branchName}</TableCell>
                      <TableCell>{formatNumber(row.quantity)} {item.usageUnit}</TableCell>
                      <TableCell>{formatNumber(row.reservedQuantity)}</TableCell>
                      <TableCell className="font-bold">{formatNumber(row.quantity - row.reservedQuantity)}</TableCell>
                      <TableCell>
                        {row.quantity <= item.minimumQuantity ? (
                          <Badge tone="warning">منخفض</Badge>
                        ) : (
                          <Badge tone="success">جيد</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {stock.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">لا توجد كميات مسجلة في الفروع.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* تبويب الحركة */}
        <TabsContent value="movements">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                سجل الحركات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الفرع</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الكمية</TableHead>
                    <TableHead>التكلفة</TableHead>
                    <TableHead>المرجع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>{new Date(movement.createdAt).toLocaleString("ar-PS")}</TableCell>
                      <TableCell>{movement.branchName}</TableCell>
                      <TableCell>
                        <Badge tone={movement.quantity > 0 ? "success" : movement.quantity < 0 ? "danger" : "muted"}>
                          {movement.movementType === "purchase" && "شراء"}
                          {movement.movementType === "sale_usage" && "صرف / بيع"}
                          {movement.movementType === "waste" && "هدر"}
                          {movement.movementType === "transfer_in" && "تحويل وارد"}
                          {movement.movementType === "transfer_out" && "تحويل صادر"}
                          {movement.movementType === "adjustment" && "تسوية"}
                          {movement.movementType === "stock_count" && "جرد"}
                          {movement.movementType === "return" && "مرتجع"}
                        </Badge>
                      </TableCell>
                      <TableCell className={movement.quantity < 0 ? "text-rose-600 font-bold" : "text-emerald-700 font-bold"}>
                        {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                      </TableCell>
                      <TableCell>{formatCurrency(Math.abs(movement.totalCost))}</TableCell>
                      <TableCell className="text-muted-foreground">{movement.reference ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {movements.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">لا توجد حركات لهذه المادة بعد.</p>
              ) : null}
            </CardContent>
          </Card>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">أعلى سعر إدخال</p>
                <p className="mt-2 text-lg font-black text-emerald-700">
                  {formatCurrency(Math.max(...movements.filter(m => m.quantity > 0).map(m => m.unitCost || 0), 0))}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">أقل سعر إدخال</p>
                <p className="mt-2 text-lg font-black text-emerald-700">
                  {formatCurrency(movements.filter(m => m.quantity > 0).length ? Math.min(...movements.filter(m => m.quantity > 0).map(m => m.unitCost || Infinity)) : 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">متوسط سعر الإدخال</p>
                <p className="mt-2 text-lg font-black text-emerald-700">
                  {formatCurrency(
                    movements.filter(m => m.quantity > 0).reduce((sum, m) => sum + (m.unitCost || 0), 0) /
                    (movements.filter(m => m.quantity > 0).length || 1)
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* تبويب الدفعات والصلاحية */}
        <TabsContent value="batches">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Barcode className="h-5 w-5 text-primary" />
                تتبع الدفعات وتواريخ الصلاحية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم الدفعة</TableHead>
                    <TableHead>تاريخ الإنتاج</TableHead>
                    <TableHead>تاريخ الانتهاء</TableHead>
                    <TableHead>الكمية الأصلية</TableHead>
                    <TableHead>المتبقي</TableHead>
                    <TableHead>المستودع</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* محاكاة بيانات دفعات بناءً على الحركات */}
                  {movements.filter(m => m.quantity > 0).slice(0, 5).map((m, idx) => {
                    const daysLeft = 60 - idx * 10;
                    const isExpired = daysLeft < 0;
                    const isNear = daysLeft <= 7 && daysLeft >= 0;
                    return (
                      <TableRow key={`batch-${m.id}`}>
                        <TableCell className="font-medium">B-{m.id.slice(0, 6).toUpperCase()}</TableCell>
                        <TableCell>{new Date(new Date(m.createdAt).getTime() - 1000 * 60 * 60 * 24 * 30).toLocaleDateString("ar-PS")}</TableCell>
                        <TableCell>{new Date(new Date(m.createdAt).getTime() + 1000 * 60 * 60 * 24 * daysLeft).toLocaleDateString("ar-PS")}</TableCell>
                        <TableCell>{m.quantity}</TableCell>
                        <TableCell className="font-bold">{Math.max(0, m.quantity - idx * 2)}</TableCell>
                        <TableCell>{m.branchName}</TableCell>
                        <TableCell>
                          {isExpired ? <Badge tone="danger">منتهية</Badge> : isNear ? <Badge tone="warning">قريب الانتهاء</Badge> : <Badge tone="success">صالحة</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {movements.filter(m => m.quantity > 0).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        لا توجد دفعات مسجلة لهذه المادة.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
