"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Scale, Calendar, Filter, RefreshCw, Download, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
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
  const [showZero, setShowZero] = React.useState(false);

  const visibleRows = React.useMemo(
    () =>
      showZero
        ? data.rows
        : data.rows.filter((row) => row.closingDebit !== 0 || row.closingCredit !== 0 || row.periodDebit !== 0 || row.periodCredit !== 0),
    [data.rows, showZero],
  );

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

  const handleExport = () => {
    const header = ["الكود", "الحساب", "النوع", "افتتاحي مدين", "افتتاحي دائن", "حركة مدين", "حركة دائن", "ختامي مدين", "ختامي دائن"];
    const lines = visibleRows.map((row) =>
      [row.code, row.name, ACCOUNT_TYPE_LABELS[row.accountType] ?? row.accountType, row.openingDebit, row.openingCredit, row.periodDebit, row.periodCredit, row.closingDebit, row.closingCredit]
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(","),
    );
    const csv = "﻿" + [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trial-balance-${data.from || "all"}-${data.to || "now"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
            <Button
              type="button"
              variant="outline"
              onClick={handleExport}
              className="border-slate-200 hover:bg-slate-50 rounded-lg gap-1"
              title="تصدير CSV"
            >
              <Download className="h-4 w-4" />
              تصدير
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowZero((v) => !v)}
              className="border-slate-200 hover:bg-slate-50 rounded-lg gap-1"
              title={showZero ? "إخفاء الحسابات الصفرية" : "إظهار الحسابات الصفرية"}
            >
              {showZero ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                  ? "مجموع الأرصدة الختامية المدينة مساوٍ تماماً لمجموع الأرصدة الدائنة. الحسابات متزنة بالكامل."
                  : `يوجد فارق غير متوازن قدره ${formatCurrency(Math.abs(data.totals.closingDebit - data.totals.closingCredit))}. يرجى مراجعة قيود اليومية المعلقة.`}
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
                  <TableHead rowSpan={2} className="text-right py-2 px-4 font-bold w-24 align-bottom">الكود</TableHead>
                  <TableHead rowSpan={2} className="text-right py-2 px-4 font-bold align-bottom">اسم الحساب</TableHead>
                  <TableHead rowSpan={2} className="text-right py-2 px-4 font-bold align-bottom">النوع</TableHead>
                  <TableHead colSpan={2} className="text-center py-2 px-4 font-bold border-s">الرصيد الافتتاحي</TableHead>
                  <TableHead colSpan={2} className="text-center py-2 px-4 font-bold border-s">حركة الفترة</TableHead>
                  <TableHead colSpan={2} className="text-center py-2 px-4 font-bold border-s">الرصيد الختامي</TableHead>
                </TableRow>
                <TableRow className="border-b bg-slate-50/50 text-slate-400">
                  <TableHead className="text-left py-2 px-4 font-bold w-28 border-s">مدين</TableHead>
                  <TableHead className="text-left py-2 px-4 font-bold w-28">دائن</TableHead>
                  <TableHead className="text-left py-2 px-4 font-bold w-28 border-s">مدين</TableHead>
                  <TableHead className="text-left py-2 px-4 font-bold w-28">دائن</TableHead>
                  <TableHead className="text-left py-2 px-4 font-bold w-28 border-s">مدين</TableHead>
                  <TableHead className="text-left py-2 px-4 font-bold w-28">دائن</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-slate-400">لا توجد أرصدة مرحلة خلال الفترة المحددة</TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => (
                    <TableRow key={row.code} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="font-mono py-3 px-4 text-slate-700 font-bold">{row.code}</TableCell>
                      <TableCell className="py-3 px-4 text-slate-900 font-black">
                        <Link href={`/dashboard/accounting/ledger?accountId=${row.accountId}${data.from ? `&from=${data.from}` : ""}${data.to ? `&to=${data.to}` : ""}`} className="hover:text-teal-700 hover:underline">
                          {row.name}
                        </Link>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-slate-650">
                        {ACCOUNT_TYPE_LABELS[row.accountType] ?? row.accountType}
                      </TableCell>
                      <TableCell className="text-left py-3 px-4 font-mono text-slate-500 border-s">
                        {row.openingDebit !== 0 ? formatCurrency(row.openingDebit) : "-"}
                      </TableCell>
                      <TableCell className="text-left py-3 px-4 font-mono text-slate-500">
                        {row.openingCredit !== 0 ? formatCurrency(row.openingCredit) : "-"}
                      </TableCell>
                      <TableCell className="text-left py-3 px-4 font-mono text-slate-800 border-s">
                        {row.periodDebit !== 0 ? formatCurrency(row.periodDebit) : "-"}
                      </TableCell>
                      <TableCell className="text-left py-3 px-4 font-mono text-slate-800">
                        {row.periodCredit !== 0 ? formatCurrency(row.periodCredit) : "-"}
                      </TableCell>
                      <TableCell className="text-left py-3 px-4 font-mono text-teal-800 font-semibold border-s">
                        {row.closingDebit !== 0 ? formatCurrency(row.closingDebit) : "-"}
                      </TableCell>
                      <TableCell className="text-left py-3 px-4 font-mono text-teal-800 font-semibold">
                        {row.closingCredit !== 0 ? formatCurrency(row.closingCredit) : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {/* Total Row */}
                {visibleRows.length > 0 && (
                  <TableRow className="bg-slate-50/70 border-t-2 border-slate-200 font-bold text-slate-900">
                    <TableCell colSpan={3} className="py-4 px-4 text-sm font-black text-right">الإجماليات العامة</TableCell>
                    <TableCell className="text-left py-4 px-4 font-mono text-slate-600 font-black border-s">{formatCurrency(data.totals.openingDebit)}</TableCell>
                    <TableCell className="text-left py-4 px-4 font-mono text-slate-600 font-black">{formatCurrency(data.totals.openingCredit)}</TableCell>
                    <TableCell className="text-left py-4 px-4 font-mono text-teal-700 font-black border-s">{formatCurrency(data.totals.periodDebit)}</TableCell>
                    <TableCell className="text-left py-4 px-4 font-mono text-teal-700 font-black">{formatCurrency(data.totals.periodCredit)}</TableCell>
                    <TableCell className="text-left py-4 px-4 font-mono text-teal-700 font-black border-s">{formatCurrency(data.totals.closingDebit)}</TableCell>
                    <TableCell className="text-left py-4 px-4 font-mono text-teal-700 font-black">{formatCurrency(data.totals.closingCredit)}</TableCell>
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
