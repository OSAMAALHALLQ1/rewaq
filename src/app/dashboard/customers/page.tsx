import { Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { getCustomerInvoicesData } from "@/server/queries/app";

export default async function CustomersPage() {
  const { invoices } = await getCustomerInvoicesData();
  const customerMap = new Map<string, { id: string; name: string; phone: string; invoices: number; sales: number }>();
  invoices.forEach((invoice) => {
    const key = `${invoice.customerName}:${invoice.customerPhone ?? ""}`;
    const current = customerMap.get(key) ?? { id: invoice.id, name: invoice.customerName, phone: invoice.customerPhone ?? "بدون هاتف", invoices: 0, sales: 0 };
    current.invoices += 1;
    current.sales += invoice.total;
    customerMap.set(key, current);
  });
  const customers = Array.from(customerMap.values());

  return (
    <>
      <PageHeader
        title="العملاء والذمم"
        description="دفتر العملاء، الأرصدة، حدود الائتمان، الأسعار الخاصة، الفواتير، الدفعات، وكشف الحساب."
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              دفتر العملاء
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>الفواتير</TableHead>
                <TableHead>إجمالي المبيعات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-bold">{customer.name}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.invoices}</TableCell>
                  <TableCell>{formatCurrency(customer.sales)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
