import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ClipboardList, PackageMinus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { getInventoryItem } from "@/server/queries/app";
import { AddMovementDialog } from "@/components/inventory/add-movement-dialog";

export default async function InventoryItemDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getInventoryItem(id);
  if (!data) notFound();

  const { item, stock, movements, branches = [] } = data;

  return (
    <>
      <PageHeader
        title={item.name}
        description="تفاصيل المادة، الكميات حسب الفرع، وسجل الحركات. المخزون الحالي ناتج عن حركات المخزون."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/dashboard/inventory">
                <ArrowRight className="h-4 w-4" />
                رجوع
              </Link>
            </Button>
            
            {/* Fully Functional Interactive AddMovementDialog component */}
            <AddMovementDialog
              itemId={item.id}
              itemName={item.name}
              usageUnit={item.usageUnit}
              branches={branches.map((b) => ({ id: b.id, name: b.name }))}
            />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">الفئة</p>
            <p className="mt-2 text-xl font-bold">{item.categoryName}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">آخر سعر شراء</p>
            <p className="mt-2 text-xl font-bold">{formatCurrency(item.lastPurchasePrice)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">متوسط السعر</p>
            <p className="mt-2 text-xl font-bold">{formatCurrency(item.averageCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">المورد الأساسي</p>
            <p className="mt-2 text-xl font-bold">{item.primarySupplierName ?? "غير محدد"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageMinus className="h-5 w-5 text-primary" />
              الكمية حسب الفرع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الفرع</TableHead>
                  <TableHead>المتاح</TableHead>
                  <TableHead>محجوز</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stock.map((row) => (
                  <TableRow key={row.branchId}>
                    <TableCell className="font-medium">{row.branchName}</TableCell>
                    <TableCell>
                      {formatNumber(row.quantity)} {item.usageUnit}
                    </TableCell>
                    <TableCell>{formatNumber(row.reservedQuantity)}</TableCell>
                    <TableCell>
                      {row.quantity <= item.minimumQuantity ? <Badge tone="warning">منخفض</Badge> : <Badge tone="success">جيد</Badge>}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>{new Date(movement.createdAt).toLocaleDateString("ar-PS")}</TableCell>
                    <TableCell>{movement.branchName}</TableCell>
                    <TableCell>{movement.movementType}</TableCell>
                    <TableCell>{movement.quantity}</TableCell>
                    <TableCell>{formatCurrency(Math.abs(movement.totalCost))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {movements.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">لا توجد حركات لهذه المادة بعد.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
