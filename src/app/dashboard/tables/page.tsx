import Link from "next/link";
import { Armchair, CircleDollarSign, Clock3, Plus, Table2, Users } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { getTablesData } from "@/server/queries/app";
import type { RestaurantTable, RestaurantTableStatus } from "@/types/domain";

const statusLabels: Record<RestaurantTableStatus, string> = {
  available: "فارغة",
  occupied: "مشغولة",
  reserved: "محجوزة",
  needs_cleaning: "تحتاج تنظيف",
};

const statusTones: Record<RestaurantTableStatus, "success" | "danger" | "warning" | "muted"> = {
  available: "success",
  occupied: "danger",
  reserved: "warning",
  needs_cleaning: "muted",
};

const tableColors: Record<RestaurantTableStatus, string> = {
  available: "border-green-200 bg-green-50 text-green-900",
  occupied: "border-red-200 bg-red-50 text-red-900",
  reserved: "border-amber-200 bg-amber-50 text-amber-900",
  needs_cleaning: "border-slate-200 bg-slate-100 text-slate-700",
};

export default async function TablesPage() {
  const { tables, branches } = await getTablesData();
  const occupiedTables = tables.filter((table) => table.status === "occupied");
  const selectedTable = occupiedTables[0] ?? tables[0];
  const openTotal = occupiedTables.reduce((sum, table) => sum + table.currentTotal, 0);

  return (
    <>
      <PageHeader
        title="إدارة الطاولات"
        description="خريطة صالة للمطعم، فتح طاولة، إضافة طلبات، متابعة الحساب الحالي، ثم إغلاق الطاولة والدفع."
        actions={
          <Button asChild>
            <Link href="/dashboard/customer-invoices/new">
              <CircleDollarSign className="h-4 w-4" />
              فتح شاشة البيع
            </Link>
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-3 p-4">
          <Select className="max-w-72" defaultValue={branches[0]?.id}>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <Button variant="outline">
            <Plus className="h-4 w-4" />
            إضافة طاولة
          </Button>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Legend tone="bg-green-100" label="فارغة" />
            <Legend tone="bg-red-100" label="مشغولة" />
            <Legend tone="bg-amber-100" label="محجوزة" />
            <Legend tone="bg-slate-200" label="تحتاج تنظيف" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="عدد الطاولات" value={formatNumber(tables.length)} description="كل مناطق الصالة" icon={Table2} />
        <MetricCard label="طاولات مشغولة" value={formatNumber(occupiedTables.length)} description="فواتير مفتوحة" icon={Users} tone="danger" />
        <MetricCard label="طاولات فارغة" value={formatNumber(tables.filter((table) => table.status === "available").length)} description="جاهزة لاستقبال زبائن" icon={Armchair} tone="success" />
        <MetricCard label="حسابات مفتوحة" value={formatCurrency(openTotal)} description="لا ترحل إلا عند الدفع" icon={CircleDollarSign} tone="warning" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table2 className="h-5 w-5 text-primary" />
              خريطة الصالة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {Array.from(new Set(tables.map((table) => table.zone))).map((zone) => (
                <section key={zone} className="rounded-xl border bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-black">{zone}</h3>
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(tables.filter((table) => table.zone === zone).length)} طاولات
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {tables
                      .filter((table) => table.zone === zone)
                      .map((table) => (
                        <TableTile key={table.id} table={table} selected={table.id === selectedTable.id} />
                      ))}
                  </div>
                </section>
              ))}
            </div>
          </CardContent>
        </Card>

        <TableDetails table={selectedTable} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>الطاولات المفتوحة</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الطاولة</TableHead>
                <TableHead>المنطقة</TableHead>
                <TableHead>الجرسون</TableHead>
                <TableHead>الضيوف</TableHead>
                <TableHead>الحساب الحالي</TableHead>
                <TableHead>الإجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {occupiedTables.map((table) => (
                <TableRow key={table.id}>
                  <TableCell className="font-bold">طاولة {formatNumber(table.number)}</TableCell>
                  <TableCell>{table.zone}</TableCell>
                  <TableCell>{table.waiterName}</TableCell>
                  <TableCell>{formatNumber(table.guests ?? 0)}</TableCell>
                  <TableCell>{formatCurrency(table.currentTotal)}</TableCell>
                  <TableCell>
                    <Button size="sm" asChild>
                      <Link href="/dashboard/customer-invoices/new">إغلاق ودفع</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function TableTile({ table, selected }: { table: RestaurantTable; selected: boolean }) {
  return (
    <button
      type="button"
      className={`min-h-36 rounded-xl border p-4 text-start transition hover:shadow-sm ${tableColors[table.status]} ${selected ? "ring-2 ring-primary" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm opacity-80">طاولة</p>
          <p className="text-3xl font-black">{formatNumber(table.number)}</p>
        </div>
        <Badge tone={statusTones[table.status]}>{statusLabels[table.status]}</Badge>
      </div>
      <div className="mt-4 space-y-1 text-sm">
        <p>{formatNumber(table.seats)} مقاعد</p>
        {table.waiterName ? <p>الجرسون: {table.waiterName}</p> : <p>جاهزة للاستقبال</p>}
        {table.currentTotal > 0 ? <p className="font-black">{formatCurrency(table.currentTotal)}</p> : null}
      </div>
    </button>
  );
}

function TableDetails({ table }: { table: RestaurantTable }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>طاولة {formatNumber(table.number)}</span>
          <Badge tone={statusTones[table.status]}>{statusLabels[table.status]}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-muted-foreground">المنطقة</p>
            <p className="font-bold">{table.zone}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-muted-foreground">المقاعد</p>
            <p className="font-bold">{formatNumber(table.seats)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-muted-foreground">الجرسون</p>
            <p className="font-bold">{table.waiterName ?? "غير محدد"}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-muted-foreground">الضيوف</p>
            <p className="font-bold">{formatNumber(table.guests ?? 0)}</p>
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold">طلبات الطاولة</h3>
            {table.openedAt ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="h-3 w-3" />
                {new Date(table.openedAt).toLocaleTimeString("ar-PS", { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : null}
          </div>
          {table.orderItems.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">لا توجد طلبات على هذه الطاولة.</p>
          ) : (
            <div className="divide-y">
              {table.orderItems.map((item) => (
                <div key={item.name} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">الكمية {formatNumber(item.quantity)}</p>
                  </div>
                  <p className="font-bold">{formatCurrency(item.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg bg-primary p-4 text-primary-foreground">
          <p className="text-sm opacity-80">الحساب الحالي</p>
          <p className="mt-1 text-3xl font-black">{formatCurrency(table.currentTotal)}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" disabled={table.status === "available"}>
            إضافة طلب
          </Button>
          <Button asChild disabled={table.status !== "occupied"}>
            <Link href="/dashboard/customer-invoices/new">إغلاق ودفع</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-3 w-3 rounded-full ${tone}`} />
      {label}
    </span>
  );
}
