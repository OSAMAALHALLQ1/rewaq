import { Plus, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { getCustomerInvoicesData } from "@/server/queries/app";

export default async function CustomersPage() {
  const { invoices } = await getCustomerInvoicesData();
  const customers = invoices.map((invoice, index) => ({
    id: invoice.id,
    name: invoice.customerName,
    phone: invoice.customerPhone ?? "بدون هاتف",
    address: index === 0 ? "غزة، الرمال" : "غزة، شارع عمر المختار",
    balance: index === 0 ? 0 : 120,
    creditLimit: index === 0 ? 300 : 500,
    specialPrice: index === 0 ? "سعر مفرق" : "سعر خاص",
    invoices: index + 2,
    payments: index + 1,
  }));

  return (
    <>
      <PageHeader
        title="العملاء والذمم"
        description="دفتر العملاء، الأرصدة، حدود الائتمان، الأسعار الخاصة، الفواتير، الدفعات، وكشف الحساب."
        actions={
          <Button>
            <Plus className="h-4 w-4" />
            عميل جديد
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              دفتر العملاء
            </CardTitle>
            <div className="relative max-w-72">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="ps-9" placeholder="بحث باسم أو هاتف" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>الرصيد</TableHead>
                <TableHead>حد الائتمان</TableHead>
                <TableHead>السعر الخاص</TableHead>
                <TableHead>الفواتير</TableHead>
                <TableHead>الدفعات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-bold">{customer.name}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.address}</TableCell>
                  <TableCell>{formatCurrency(customer.balance)}</TableCell>
                  <TableCell>{formatCurrency(customer.creditLimit)}</TableCell>
                  <TableCell>{customer.specialPrice}</TableCell>
                  <TableCell>{customer.invoices}</TableCell>
                  <TableCell>{customer.payments}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
