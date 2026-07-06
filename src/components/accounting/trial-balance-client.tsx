"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Scale, Info, Calendar, Filter, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACCOUNT_TYPE_LABELS } from "@/lib/accounting/constants";
import { formatCurrency } from "@/lib/utils";
import type { TrialBalanceData } from "@/server/queries/accounting-erp";

export function TrialBalanceClient({ data }: { data: TrialBalanceData }) {
  const router = useRouter();
  const [from, setFrom] = React.useState(data.from || "");
  const [to, setTo] = React.useState(data.to || "");

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    let query = "";
    if (from) query += `&from=${from}`;
    if (to) query += `&to=${to}`;
    router.push(`/dashboard/accounting/trial-balance?${query.slice(1)}`);
  };

  const handleReset = () => {
    setFrom("");
    setTo("");
    router.push("/dashboard/accounting/trial-balance");
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Date Filter Panel */}
      <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl p-5">
        <form onSubmit={handleFilter} className="grid gap-4 sm:grid-cols-3 items-end">
          <div className="space-y-2">
            <Label htmlFor="fromDate" className="text-xs font-bold text-slate-500">من تاريخ</Label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="fromDate"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="pe-3 ps-9 bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="toDate" className="text-xs font-bold text-slate-500">إلى تاريخ</Label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="toDate"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="pe-3 ps-9 bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right font-mono"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-md shadow-teal-500/10 gap-1"
            >
              <Filter className="h-4 w-4" />
              تصفية الفترة
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="border-slate-200 hover:bg-slate-50 rounded-lg"
              title="إعادة تعيين"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </Card>

      {/* Balanced Warning Alert */}
      <Card className={`backdrop-blur-md border shadow-md rounded-2xl overflow-hidden ${data.balanced ? "bg-emerald-50/50 border-emerald-200" : "bg-red-50/50 border-red-200"}`}>
        <CardContent className="p-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className={`p-2.5 rounded-xl border ${data.balanced ? "bg-emerald-100/60 border-emerald-200 text-emerald-700" : "bg-red-100/60 border-red-200 text-red-750"}`}>
              <Scale className="h-6 w-6" />
            </span>
            <div>
              <h4 className="text-sm font-bold text-slate-900">توازن ميزان المراجعة</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {data.balanced
                  ? "مجموع أرصدة الحسابات المدينة مساوٍ تماماً لمجموع الأرصدة الدائنة. الحسابات متزنة بالكامل."
                  : `يوجد فارق غير متوازن قدره ${formatCurrency(Math.abs(data.debitTotal - data.creditTotal))}. يرجى مراجعة قيود اليومية المعلقة.`}
              </p>
            </div>
          </div>
          <Badge tone={data.balanced ? "success" : "danger"} className="h-9 px-4 text-xs font-bold rounded-xl border shadow-sm flex items-center">
            {data.balanced ? "متزن" : "يحتاج مراجعة وتدقيق"}
          </Badge>
        </CardContent>
      </Card>

      {/* Trial Balance Table */}
      <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="border-b bg-slate-50/50 text-slate-400">
                  <TableHead className="text-right py-3.5 px-5 font-bold w-28">كود الحساب</TableHead>
                  <TableHead className="text-right py-3.5 px-5 font-bold">اسم الحساب</TableHead>
                  <TableHead className="text-right py-3.5 px-5 font-bold">النوع</TableHead>
                  <TableHead className="text-left py-3.5 px-5 font-bold w-36">مدين (+)</TableHead>
                  <TableHead className="text-left py-3.5 px-5 font-bold w-36">دائن (-)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-slate-400">لا توجد أرصدة مرحلة خلال الفترة المحددة</TableCell>
                  </TableRow>
                ) : (
                  data.rows.map((row) => (
                    <TableRow key={row.code} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="font-mono py-3 px-5 text-slate-700 font-bold">{row.code}</TableCell>
                      <TableCell className="py-3 px-5 text-slate-900 font-black">{row.name}</TableCell>
                      <TableCell className="py-3 px-5 text-slate-650">
                        {ACCOUNT_TYPE_LABELS[row.accountType] ?? row.accountType}
                      </TableCell>
                      <TableCell className="text-left py-3 px-5 font-mono text-slate-800 font-semibold">
                        {row.debit > 0 ? formatCurrency(row.debit) : "-"}
                      </TableCell>
                      <TableCell className="text-left py-3 px-5 font-mono text-slate-850 font-semibold">
                        {row.credit > 0 ? formatCurrency(row.credit) : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {/* Total Row */}
                {data.rows.length > 0 && (
                  <TableRow className="bg-slate-50/70 border-t-2 border-slate-200 font-bold text-slate-900">
                    <TableCell colSpan={3} className="py-4 px-5 text-sm font-black text-right">الإجماليات العامة</TableCell>
                    <TableCell className="text-left py-4 px-5 font-mono text-teal-700 text-sm font-black">
                      {formatCurrency(data.debitTotal)}
                    </TableCell>
                    <TableCell className="text-left py-4 px-5 font-mono text-teal-700 text-sm font-black">
                      {formatCurrency(data.creditTotal)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
