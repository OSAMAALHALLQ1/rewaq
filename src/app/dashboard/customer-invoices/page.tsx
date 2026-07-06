import Link from "next/link";
import { Plus, Printer, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { getCustomerInvoicesData } from "@/server/queries/app";
import type { CustomerInvoice } from "@/types/domain";

const paymentLabels: Record<CustomerInvoice["paymentMethod"], string> = {
  cash: "نقدي",
  card: "بطاقة",
  bank_transfer: "حوالة",
  delivery_app: "تطبيق توصيل",
  receivable: "ذمم عملاء",
  wallet: "المحفظة الإلكترونية",
  gift_card: "بطاقة هدايا",
};

export default async function CustomerInvoicesPage() {
  const { invoices, branches } = await getCustomerInvoicesData();

  return (
    <>
      <PageHeader
        title="فواتير العملاء"
        description="شاشة كاشير لاختيار أصناف الزبون من المنيو، إصدار فاتورة، وطباعتها مباشرة."
        actions={
          <Button asChild>
            <Link href="/dashboard/customer-invoices/new">
              <Plus className="h-4 w-4" />
              فاتورة جديدة
            </Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              سجل فواتير العملاء
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="relative w-full max-w-72">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="ps-9" placeholder="بحث برقم الفاتورة أو العميل" />
              </div>
              <Select className="max-w-60" defaultValue="all">
                <option value="all">كل الفروع</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
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
                <TableHead>رقم الفاتورة</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>الفرع</TableHead>
                <TableHead>الدفع</TableHead>
                <TableHead>المجموع</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>طباعة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-semibold">{invoice.invoiceNumber}</TableCell>
                  <TableCell>
                    <div>{invoice.customerName}</div>
                    <p className="text-xs text-muted-foreground">{invoice.customerPhone ?? "بدون هاتف"}</p>
                  </TableCell>
                  <TableCell>{invoice.branchName}</TableCell>
                  <TableCell>{paymentLabels[invoice.paymentMethod]}</TableCell>
                  <TableCell>{formatCurrency(invoice.total)}</TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/print/customer-invoices/${invoice.id}`}>
                        <Printer className="h-4 w-4" />
                        طباعة
                      </Link>
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
