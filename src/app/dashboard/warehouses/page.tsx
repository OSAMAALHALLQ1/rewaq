import Link from "next/link";
import { Grid3x3, Plus, Store, Warehouse } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInventoryData } from "@/server/queries/app";

export default async function WarehousesPage() {
  const { branches } = await getInventoryData();
  const main = branches[0];
  const sub = branches.slice(1);

  return (
    <>
      <PageHeader
        title="دليل المستودعات"
        description="إدارة المستودعات الرئيسية والفرعية وربطها بالفروع والمستخدمين."
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            إضافة مستودع
          </Button>
        }
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3x3 className="h-5 w-5 text-primary" />
            الهيكل التنظيمي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {main && (
              <div className="rounded-xl border bg-primary/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Warehouse className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">{main.name}</p>
                    <p className="text-xs text-muted-foreground">المستودع الرئيسي — {main.city}</p>
                  </div>
                  <Badge tone="success">نشط</Badge>
                </div>
                {sub.length > 0 && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    {sub.map((b) => (
                      <div key={b.id} className="flex items-center gap-3 rounded-lg border bg-white p-3">
                        <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                          <Store className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold">{b.name}</p>
                          <p className="text-[11px] text-muted-foreground">{b.city} — {b.address}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone={b.status === "active" ? "success" : "muted"}>{b.status === "active" ? "نشط" : "متوقف"}</Badge>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/dashboard/warehouses/${b.id}`}>الكرت</Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>قائمة المستودعات</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المستودع</TableHead>
                <TableHead>المدينة</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>المدير</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/dashboard/warehouses/${b.id}`} className="font-semibold text-primary hover:underline">
                      {b.name}
                    </Link>
                  </TableCell>
                  <TableCell>{b.city}</TableCell>
                  <TableCell className="text-muted-foreground">{b.address || "—"}</TableCell>
                  <TableCell>{b.manager || "—"}</TableCell>
                  <TableCell>
                    <Badge tone={b.status === "active" ? "success" : "muted"}>{b.status === "active" ? "نشط" : "متوقف"}</Badge>
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
