"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import type { PayablesData, AgingBucketKey } from "@/server/queries/accounting-erp";

const BUCKET_LABELS: Record<AgingBucketKey, string> = {
  current: "غير مستحقة بعد",
  d1_30: "متأخرة 1-30 يوم",
  d31_60: "متأخرة 31-60 يوم",
  d61_90: "متأخرة 61-90 يوم",
  d90plus: "متأخرة +90 يوم",
};

const BUCKET_COLORS: Record<AgingBucketKey, string> = {
  current: "text-emerald-600 bg-emerald-50 border-emerald-200",
  d1_30: "text-amber-600 bg-amber-50 border-amber-200",
  d31_60: "text-orange-600 bg-orange-50 border-orange-200",
  d61_90: "text-rose-600 bg-rose-50 border-rose-200",
  d90plus: "text-red-700 bg-red-50 border-red-200",
};

export function PayablesClient({ data }: { data: PayablesData }) {
  const router = useRouter();

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Aging buckets */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="backdrop-blur-md bg-slate-900 text-white border-0 shadow-md rounded-2xl p-4">
          <p className="text-[10px] font-bold text-slate-300">إجمالي الذمم الدائنة</p>
          <h3 className="font-mono text-lg font-black mt-1.5">{formatCurrency(data.totalPayable)}</h3>
        </Card>
        {(Object.keys(BUCKET_LABELS) as AgingBucketKey[]).map((bucket) => (
          <Card key={bucket} className={`backdrop-blur-md border shadow-sm rounded-2xl p-4 ${BUCKET_COLORS[bucket]}`}>
            <p className="text-[10px] font-bold opacity-80">{BUCKET_LABELS[bucket]}</p>
            <h3 className="font-mono text-lg font-black mt-1.5">{formatCurrency(data.agingTotals[bucket])}</h3>
          </Card>
        ))}
      </div>

      {/* Supplier statement (when selected) */}
      {data.selectedSupplier && (
        <Card className="backdrop-blur-md bg-white/80 border border-teal-200/60 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="border-b bg-teal-50/40 py-3 px-5 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-black text-slate-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-teal-600" />
              كشف حساب المورد: {data.selectedSupplier.name}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/accounting/payables")} className="rounded-lg border-slate-200 gap-1 h-8">
              <X className="h-3.5 w-3.5" />
              إغلاق الكشف
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="border-b bg-slate-50/50 text-slate-400">
                  <TableHead className="text-right py-3 px-4 font-bold w-24">التاريخ</TableHead>
                  <TableHead className="text-right py-3 px-4 font-bold w-28">المستند</TableHead>
                  <TableHead className="text-right py-3 px-4 font-bold">البيان</TableHead>
                  <TableHead className="text-left py-3 px-4 font-bold w-28">مدفوعات (مدين)</TableHead>
                  <TableHead className="text-left py-3 px-4 font-bold w-28">فواتير (دائن)</TableHead>
                  <TableHead className="text-left py-3 px-4 font-bold w-32">الرصيد المستحق</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.selectedSupplier.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-400">لا توجد حركات لهذا المورد</TableCell>
                  </TableRow>
                ) : (
                  data.selectedSupplier.rows.map((row, index) => (
                    <TableRow key={index} className="hover:bg-slate-50/30">
                      <TableCell className="py-2.5 px-4 font-mono text-slate-600">{row.date}</TableCell>
                      <TableCell className="py-2.5 px-4 font-mono text-slate-700 font-bold">{row.docNumber}</TableCell>
                      <TableCell className="py-2.5 px-4 text-slate-700">{row.description}</TableCell>
                      <TableCell className="text-left py-2.5 px-4 font-mono text-emerald-600">{row.debit > 0 ? formatCurrency(row.debit) : "-"}</TableCell>
                      <TableCell className="text-left py-2.5 px-4 font-mono text-slate-800">{row.credit > 0 ? formatCurrency(row.credit) : "-"}</TableCell>
                      <TableCell className="text-left py-2.5 px-4 font-mono text-teal-700 font-bold">{formatCurrency(row.balance)}</TableCell>
                    </TableRow>
                  ))
                )}
                <TableRow className="bg-slate-50/70 border-t-2 font-black">
                  <TableCell colSpan={5} className="py-3 px-4 text-slate-800">الرصيد المستحق للمورد</TableCell>
                  <TableCell className="text-left py-3 px-4 font-mono text-teal-700 text-sm">{formatCurrency(data.selectedSupplier.balance)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Suppliers summary */}
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50 py-3 px-5">
            <CardTitle className="text-sm font-black text-slate-900">أرصدة الموردين</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="border-b bg-slate-50/50 text-slate-400">
                  <TableHead className="text-right py-3 px-4 font-bold">المورد</TableHead>
                  <TableHead className="text-left py-3 px-4 font-bold w-28">إجمالي الفواتير</TableHead>
                  <TableHead className="text-left py-3 px-4 font-bold w-28">المدفوع</TableHead>
                  <TableHead className="text-left py-3 px-4 font-bold w-28">الرصيد</TableHead>
                  <TableHead className="text-center py-3 px-4 font-bold w-24">كشف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.suppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-slate-400">لا يوجد موردون بحركات مالية</TableCell>
                  </TableRow>
                ) : (
                  data.suppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="hover:bg-slate-50/30">
                      <TableCell className="py-3 px-4 text-slate-900 font-black">
                        {supplier.name}
                        {supplier.openInvoices > 0 && (
                          <span className="text-[10px] text-amber-600 font-normal block mt-0.5">{supplier.openInvoices} فاتورة مفتوحة</span>
                        )}
                      </TableCell>
                      <TableCell className="text-left py-3 px-4 font-mono text-slate-700">{formatCurrency(supplier.totalInvoiced)}</TableCell>
                      <TableCell className="text-left py-3 px-4 font-mono text-emerald-600">{formatCurrency(supplier.totalPaid)}</TableCell>
                      <TableCell className={`text-left py-3 px-4 font-mono font-black ${supplier.balance > 0.001 ? "text-rose-600" : "text-slate-500"}`}>
                        {formatCurrency(supplier.balance)}
                      </TableCell>
                      <TableCell className="text-center py-3 px-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/accounting/payables?supplierId=${supplier.id}`)}
                          className="rounded-lg border-slate-200 h-7 px-2 text-[10px]"
                        >
                          كشف الحساب
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Open invoices with aging */}
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50 py-3 px-5">
            <CardTitle className="text-sm font-black text-slate-900">الفواتير المفتوحة حسب الاستحقاق</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="border-b bg-slate-50/50 text-slate-400">
                  <TableHead className="text-right py-3 px-4 font-bold">الفاتورة</TableHead>
                  <TableHead className="text-right py-3 px-4 font-bold w-24">الاستحقاق</TableHead>
                  <TableHead className="text-left py-3 px-4 font-bold w-28">الرصيد المتبقي</TableHead>
                  <TableHead className="text-center py-3 px-4 font-bold w-28">العمر</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.openInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-slate-400">
                      لا توجد فواتير غير مسددة — جميع ذمم الموردين مسددة ✓
                    </TableCell>
                  </TableRow>
                ) : (
                  data.openInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className="hover:bg-slate-50/30">
                      <TableCell className="py-3 px-4">
                        <Link href="/dashboard/invoices" className="text-slate-900 font-black hover:text-teal-700 hover:underline font-mono">
                          {invoice.invoiceNumber}
                        </Link>
                        <p className="text-[10px] text-slate-400 mt-0.5">{invoice.supplierName}</p>
                      </TableCell>
                      <TableCell className="py-3 px-4 font-mono text-slate-600">{invoice.dueDate || "-"}</TableCell>
                      <TableCell className="text-left py-3 px-4 font-mono text-rose-600 font-black">
                        {formatCurrency(invoice.balanceDue)}
                        {invoice.paidAmount > 0 && (
                          <p className="text-[10px] text-emerald-600 font-normal">مدفوع {formatCurrency(invoice.paidAmount)}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-center py-3 px-4">
                        <Badge
                          tone={invoice.bucket === "current" ? "success" : invoice.bucket === "d1_30" ? "warning" : "danger"}
                          className="rounded-lg px-2 py-0.5 text-[10px]"
                        >
                          {BUCKET_LABELS[invoice.bucket]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
