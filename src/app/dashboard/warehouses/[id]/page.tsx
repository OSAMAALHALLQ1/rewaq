import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Boxes, ClipboardList, Gauge, Truck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { getInventoryData } from "@/server/queries/app";

const statTones: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-50 text-emerald-600",
  sky: "bg-sky-50 text-sky-600",
  amber: "bg-amber-50 text-amber-600",
};

function Stat({
  label,
  value,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof statTones;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-black">{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${statTones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default async function WarehouseDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { branches, items, branchStock, movements } = await getInventoryData();
  const wh = branches.find((b) => b.id === id);
  if (!wh) notFound();

  const hereStock = branchStock.filter((s) => s.branchId === id);
  const whItems = items.filter((it) => hereStock.some((s) => s.itemId === it.id));
  const whMoves = movements.filter((m) => m.branchId === id).slice(0, 20);
  const totalQty = hereStock.reduce((sum, s) => sum + s.quantity, 0);
  const totalVal = hereStock.reduce((sum, s) => {
    const it = items.find((i) => i.id === s.itemId);
    return sum + s.quantity * (it?.averageCost || 0);
  }, 0);

  return (
    <>
      <PageHeader title={wh.name} description={`بطاقة المستودع — ${wh.city}`} actions={<Button variant="outline" asChild><Link href="/dashboard/warehouses"><ArrowRight className="h-4 w-4" />رجوع</Link></Button>} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Stat label="عدد المواد" value={whItems.length} icon={Boxes} tone="primary" />
        <Stat label="إجمالي الكميات" value={formatNumber(totalQty)} icon={Gauge} tone="sky" />
        <Stat label="قيمة المخزون" value={formatCurrency(totalVal)} icon={Truck} tone="emerald" />
        <Stat label="الحالة" value={wh.status === "active" ? "نشط" : "متوقف"} icon={Users} tone="amber" />
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">المواد</TabsTrigger>
          <TabsTrigger value="movements">الحركة</TabsTrigger>
          <TabsTrigger value="settings">الإعدادات</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <Card>
            <CardHeader><CardTitle>المواد في هذا المستودع</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المادة</TableHead><TableHead>الكمية</TableHead><TableHead>المحجوز</TableHead><TableHead>المتاح</TableHead><TableHead>التكلفة</TableHead><TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {whItems.map((item) => {
                    const s = hereStock.find((x) => x.itemId === item.id);
                    const q = s?.quantity ?? 0;
                    const r = s?.reservedQuantity ?? 0;
                    const low = q > 0 && q <= item.minimumQuantity;
                    const out = q <= 0;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium"><Link href={`/dashboard/inventory/${item.id}`} className="text-primary hover:underline">{item.name}</Link></TableCell>
                        <TableCell>{formatNumber(q)} {item.usageUnit}</TableCell>
                        <TableCell>{formatNumber(r)}</TableCell>
                        <TableCell className="font-bold">{formatNumber(q - r)}</TableCell>
                        <TableCell>{formatCurrency(item.averageCost)}</TableCell>
                        <TableCell>{out ? <Badge tone="danger">نافد</Badge> : low ? <Badge tone="warning">منخفض</Badge> : <Badge tone="success">جيد</Badge>}</TableCell>
                      </TableRow>
                    );
                  })}
                  {whItems.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">لا توجد مواد.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />حركات المستودع</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead><TableHead>المادة</TableHead><TableHead>النوع</TableHead><TableHead>الكمية</TableHead><TableHead>التكلفة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {whMoves.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{new Date(m.createdAt).toLocaleString("ar-PS")}</TableCell>
                      <TableCell className="font-medium">{m.itemName}</TableCell>
                      <TableCell><Badge tone={m.quantity > 0 ? "success" : "danger"}>{m.quantity > 0 ? "وارد" : "صادر"}</Badge></TableCell>
                      <TableCell className={m.quantity < 0 ? "text-rose-600 font-bold" : "text-emerald-700 font-bold"}>{m.quantity}</TableCell>
                      <TableCell>{formatCurrency(Math.abs(m.totalCost))}</TableCell>
                    </TableRow>
                  ))}
                  {whMoves.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">لا توجد حركات.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader><CardTitle>إعدادات المستودع</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">المدينة</p><p className="mt-1 font-bold">{wh.city}</p></div>
                <div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">العنوان</p><p className="mt-1 font-bold">{wh.address || "—"}</p></div>
                <div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">المدير</p><p className="mt-1 font-bold">{wh.manager || "—"}</p></div>
                <div className="rounded-lg border bg-slate-50 p-3"><p className="text-xs text-muted-foreground">الحالة</p><p className="mt-1 font-bold">{wh.status === "active" ? "نشط" : "متوقف"}</p></div>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <p className="text-xs text-muted-foreground">الصلاحيات والفروع المرتبطة</p>
                <p className="mt-1">جميع المستخدمين المعتمدين يمكنهم استعراض هذا المستودع. يمكنك لاحقاً ربط المستخدمين والأدوار من إعدادات النظام.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}