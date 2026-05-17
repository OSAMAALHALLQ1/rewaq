import { FileText, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { getPurchasingData } from "@/server/queries/app";

export default async function InvoicesPage() {
  const { invoices } = await getPurchasingData();

  return (
    <>
      <PageHeader
        title="الفواتير"
        description="مطابقة الفواتير مع أوامر الشراء، ورصد اختلاف السعر عن آخر شراء."
        actions={
          <Button variant="outline">
            <Upload className="h-4 w-4" />
            رفع فاتورة
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            سجل الفواتير
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الفاتورة</TableHead>
                <TableHead>المورد</TableHead>
                <TableHead>الفرع</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>المجموع</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-semibold">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{invoice.supplierName}</TableCell>
                  <TableCell>{invoice.branchName}</TableCell>
                  <TableCell>{invoice.issuedAt}</TableCell>
                  <TableCell>{formatCurrency(invoice.total)}</TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status} />
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
