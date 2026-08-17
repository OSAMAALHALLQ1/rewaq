import Link from "next/link";
import { Clock3, FileText, History, WalletCards } from "lucide-react";
import { SupplierInvoicesClient } from "@/components/purchasing/supplier-invoices-client";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { todayLocal } from "@/lib/accounting/posting";
import { getSupplierBillPaymentsData, summarizeSupplierBills } from "@/server/queries/financial-services/bill-payments";

const paymentMethodLabels: Record<string, string> = {
  cash: "نقدي",
  bank_transfer: "تحويل بنكي",
  card: "بطاقة / شبكة",
};

export default async function BillPaymentsPage() {
  const { invoices, recentPayments } = await getSupplierBillPaymentsData();
  const summary = summarizeSupplierBills(invoices, todayLocal());

  return (
    <>
      <PageHeader
        title="سداد فواتير الموردين"
        description="ذمم الموردين الفعلية من فواتير التوريد. تسجيل سند الدفع يحدّث رصيد الفاتورة ويرحّل القيد المحاسبي في عملية واحدة."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/accounting/payables">أعمار الذمم وكشوف الموردين</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/invoices">
                <FileText className="h-4 w-4" />
                فواتير التوريد
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="إجمالي الذمم المفتوحة" value={formatCurrency(summary.outstandingTotal)} description="الرصيد الفعلي لفواتير الموردين" icon={WalletCards} tone="warning" />
        <MetricCard label="فواتير مفتوحة" value={formatNumber(summary.openInvoices.length)} description="قابلة للسداد كليًا أو جزئيًا" icon={FileText} />
        <MetricCard label="فواتير متأخرة" value={formatNumber(summary.overdueCount)} description="تجاوزت تاريخ الاستحقاق" icon={Clock3} tone="danger" />
        <MetricCard label="مدفوعة جزئيًا" value={formatNumber(summary.partialCount)} description="ما زال عليها رصيد" icon={History} tone="success" />
      </div>

      <div className="mt-4">
        <SupplierInvoicesClient invoices={summary.openInvoices} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            آخر سندات دفع الموردين
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>المورد</TableHead>
                <TableHead>الفاتورة</TableHead>
                <TableHead>طريقة الدفع</TableHead>
                <TableHead>المرجع</TableHead>
                <TableHead>المبلغ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">لا توجد سندات دفع مسجلة بعد.</TableCell>
                </TableRow>
              ) : recentPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{payment.paymentDate}</TableCell>
                  <TableCell className="font-bold">{payment.supplierName}</TableCell>
                  <TableCell>{payment.invoiceNumber}</TableCell>
                  <TableCell>{paymentMethodLabels[payment.paymentMethod] ?? payment.paymentMethod}</TableCell>
                  <TableCell>{payment.reference ?? "-"}</TableCell>
                  <TableCell className="font-bold">{formatCurrency(payment.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
