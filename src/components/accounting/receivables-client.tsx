"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import type { ReceivablesData, AgingBucketKey } from "@/server/queries/accounting-treasury";

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

export function ReceivablesClient({ data }: { data: ReceivablesData }) {
  const router = useRouter();

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="backdrop-blur-md bg-slate-900 text-white border-0 shadow-md rounded-2xl p-4">
          <p className="text-[10px] font-bold text-slate-300">إجمالي الذمم المدينة</p>
          <h3 className="font-mono text-lg font-black mt-1.5">{formatCurrency(data.totalReceivable)}</h3>
        </Card>
        {(Object.keys(BUCKET_LABELS) as AgingBucketKey[]).map((bucket) => (
          <Card key={bucket} className={`backdrop-blur-md border shadow-sm rounded-2xl p-4 ${BUCKET_COLORS[bucket]}`}>
            <p className="text-[10px] font-bold opacity-80">{BUCKET_LABELS[bucket]}</p>
            <h3 className="font-mono text-lg font-black mt-1.5">{formatCurrency(data.agingTotals[bucket])}</h3>
          </Card>
        ))}
      </div>

      {data.selectedCustomer && (
        <Card className="backdrop-blur-md bg-white/80 border border-teal-200/60 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="border-b bg-teal-50/40 py-3 px-5 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-black text-slate-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-teal-600" />
              كشف حساب العميل: {data.selectedCustomer.name}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/accounting/receivables")} className="rounded-lg border-slate-200 gap-1 h-8">
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
                  <TableHead className="text-left py-3 px-4 font-bold w-28">مدين</TableHead>
                  <TableHead className="text-left py-3 px-4 font-bold w-32">الرصيد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.selectedCustomer.rows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400">لا توجد فواتير مفتوحة لهذا العميل</TableCell></TableRow>
                ) : (
                  data.selectedCustomer.rows.map((row, index) => (
                    <TableRow key={index} className="hover:bg-slate-50/30">
                      <TableCell className="py-2.5 px-4 font-mono text-slate-600">{row.date}</TableCell>
                      <TableCell className="py-2.5 px-4 font-mono text-slate-700 font-bold">{row.docNumber}</TableCell>
                      <TableCell className="py-2.5 px-4 text-slate-700">{row.description}</TableCell>
                      <TableCell className="text-left py-2.5 px-4 font-mono text-slate-800">{formatCurrency(row.debit)}</TableCell>
                      <TableCell className="text-left py-2.5 px-4 font-mono text-teal-700 font-bold">{formatCurrency(row.balance)}</TableCell>
                    </TableRow>
                  ))
                )}
                <TableRow className="bg-slate-50/70 border-t-2 font-black">
                  <TableCell colSpan={4} className="py-3 px-4 text-slate-800">الرصيد المستحق للعميل</TableCell>
                  <TableCell className="text-left py-3 px-4 font-mono text-teal-700 text-sm">{formatCurrency(data.selectedCustomer.balance)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50 py-3 px-5">
            <CardTitle className="text-sm font-black text-slate-900">أرصدة العملاء</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="border-b bg-slate-50/50 text-slate-400">
                  <TableHead className="text-right py-3 px-4 font-bold">العميل</TableHead>
                  <TableHead className="text-left py-3 px-4 font-bold w-28">الرصيد</TableHead>
                  <TableHead className="text-center py-3 px-4 font-bold w-24">كشف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.customers.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-10 text-slate-400">لا توجد ذمم مدينة — جميع المبيعات نقدية ✓</TableCell></TableRow>
                ) : (
                  data.customers.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50/30">
                      <TableCell className="py-3 px-4 text-slate-900 font-black">{c.name}</TableCell>
                      <TableCell className={`text-left py-3 px-4 font-mono font-black ${c.balance > 0.001 ? "text-rose-600" : "text-slate-500"}`}>{formatCurrency(c.balance)}</TableCell>
                      <TableCell className="text-center py-3 px-4">
                        <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/accounting/receivables?customerId=${encodeURIComponent(c.id)}`)} className="rounded-lg border-slate-200 h-7 px-2 text-[10px]">كشف الحساب</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

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
                  <TableHead className="text-left py-3 px-4 font-bold w-28">الرصيد</TableHead>
                  <TableHead className="text-center py-3 px-4 font-bold w-28">العمر</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.openInvoices.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-10 text-slate-400">لا توجد فواتير مدينة مفتوحة ✓</TableCell></TableRow>
                ) : (
                  data.openInvoices.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-slate-50/30">
                      <TableCell className="py-3 px-4">
                        <span className="text-slate-900 font-black font-mono">{inv.invoiceNumber}</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">{inv.customerName}</p>
                      </TableCell>
                      <TableCell className="py-3 px-4 font-mono text-slate-600">{inv.dueDate || "-"}</TableCell>
                      <TableCell className="text-left py-3 px-4 font-mono text-rose-600 font-black">{formatCurrency(inv.balanceDue)}</TableCell>
                      <TableCell className="text-center py-3 px-4">
                        <Badge tone={inv.bucket === "current" ? "success" : inv.bucket === "d1_30" ? "warning" : "danger"} className="rounded-lg px-2 py-0.5 text-[10px]">
                          {BUCKET_LABELS[inv.bucket]}
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
