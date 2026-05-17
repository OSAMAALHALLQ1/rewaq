import { RotateCcw, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { getCustomerInvoicesData } from "@/server/queries/app";

export default async function SalesReturnsPage() {
  const { invoices } = await getCustomerInvoicesData();

  return (
    <>
      <PageHeader
        title="مرتجعات البيع"
        description="إنشاء مرتجع من فاتورة بيع، إرجاع الأصناف للمخزون، وتسجيل سبب المرتجع."
        actions={
          <Button>
            <RotateCcw className="h-4 w-4" />
            مرتجع جديد
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>سجل المرتجعات</CardTitle>
            <div className="relative max-w-72">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="ps-9" placeholder="بحث برقم الفاتورة" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم المرجع</TableHead>
                <TableHead>الفاتورة الأصلية</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>السبب</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.slice(0, 2).map((invoice, index) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-bold">مرتجع-{index + 1}</TableCell>
                  <TableCell>{invoice.invoiceNumber}</TableCell>
                  <TableCell>{invoice.customerName}</TableCell>
                  <TableCell>{index === 0 ? "استبدال صنف" : "خطأ في الطلب"}</TableCell>
                  <TableCell>{formatCurrency(index === 0 ? 15 : 25)}</TableCell>
                  <TableCell>
                    <Badge tone="success">مكتمل</Badge>
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
