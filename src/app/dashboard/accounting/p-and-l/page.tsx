import * as React from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, DollarSign, Wallet, FileText, ArrowLeft, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProfitAndLossData } from "@/server/queries/accounting";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default async function ProfitAndLossPage() {
  const data = await getProfitAndLossData();

  return (
    <>
      <div className="flex items-center justify-between mb-4" dir="rtl">
        <Button variant="outline" size="sm" asChild className="rounded-lg gap-1 border-slate-200 hover:bg-slate-50 text-slate-700">
          <Link href="/dashboard/accounting/ledger">
            <ArrowLeft className="h-4 w-4" />
            رجوع لدفتر الأستاذ
          </Link>
        </Button>
      </div>

      <PageHeader
        title="تقرير الأرباح والخسائر (P&L)"
        description="بيان مالي تفصيلي للإيرادات والمبيعات وتكلفة البضاعة والمصاريف التشغيلية للمؤسسة."
      />

      {/* High-End Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3 text-right" dir="rtl">
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 flex items-center justify-between">
              <span>إجمالي المبيعات والإيرادات</span>
              <span className="p-1.5 rounded-lg bg-teal-50 text-teal-600"><TrendingUp className="h-4 w-4" /></span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-slate-900 font-mono">{formatCurrency(data.revenueTotal)}</p>
            <p className="text-[10px] text-slate-400 mt-1">مجموع حسابات الإيرادات النشطة</p>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 flex items-center justify-between">
              <span>تكاليف التشغيل والمشتريات</span>
              <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600"><TrendingDown className="h-4 w-4" /></span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-black text-slate-900 font-mono">{formatCurrency(data.cogsTotal + data.expenseTotal)}</p>
            <p className="text-[10px] text-slate-400 mt-1">المواد المستهلكة + المصاريف</p>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden relative">
          <div className={`absolute top-0 right-0 left-0 h-1.5 ${data.netProfit >= 0 ? "bg-emerald-500" : "bg-red-500"}`} />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-slate-500 flex items-center justify-between">
              <span>صافي أرباح الفترة</span>
              <span className={`p-1.5 rounded-lg ${data.netProfit >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                <DollarSign className="h-4 w-4" />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-black font-mono ${data.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatCurrency(data.netProfit)}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              {data.netProfit >= 0 ? "أداء مالي إيجابي ومربح" : "عجز خسارة تشغيلية"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Report Table Sheet */}
      <Card className="mt-6 backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-lg rounded-3xl overflow-hidden max-w-4xl mx-auto" dir="rtl">
        <CardHeader className="border-b bg-slate-50/50 px-6 py-4">
          <CardTitle className="text-base font-black text-slate-900">جدول كشف الأرباح والخسائر</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="bg-slate-55 border-b text-slate-500">
                <TableHead className="text-right py-3 px-6 w-2/3">الحساب / التبويب المالي</TableHead>
                <TableHead className="text-left py-3 px-6 w-1/3">القيمة المالية</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Revenues Section */}
              <TableRow className="bg-slate-50/70">
                <TableCell className="font-bold text-teal-800 py-3 px-6">1. الإيرادات والمبيعات</TableCell>
                <TableCell className="text-left font-bold text-teal-800 py-3 px-6 font-mono">{formatCurrency(data.revenueTotal)}</TableCell>
              </TableRow>
              {data.revenues.map((item) => (
                <TableRow key={item.code} className="hover:bg-slate-50/30 transition-colors">
                  <TableCell className="py-2 px-8 text-slate-600">{item.code} - {item.name}</TableCell>
                  <TableCell className="text-left py-2 px-6 font-mono text-slate-700">{formatCurrency(item.balance)}</TableCell>
                </TableRow>
              ))}

              {/* COGS Section */}
              <TableRow className="bg-slate-50/70 border-t-2">
                <TableCell className="font-bold text-rose-800 py-3 px-6">2. تكلفة المبيعات (COGS)</TableCell>
                <TableCell className="text-left font-bold text-rose-800 py-3 px-6 font-mono">{formatCurrency(data.cogsTotal)}</TableCell>
              </TableRow>
              {data.cogs.map((item) => (
                <TableRow key={item.code} className="hover:bg-slate-50/30 transition-colors">
                  <TableCell className="py-2 px-8 text-slate-600">{item.code} - {item.name}</TableCell>
                  <TableCell className="text-left py-2 px-6 font-mono text-slate-700">{formatCurrency(item.balance)}</TableCell>
                </TableRow>
              ))}

              {/* Gross Profit Divider */}
              <TableRow className="border-y-2 border-slate-300 bg-teal-50/20 font-black">
                <TableCell className="py-3.5 px-6 text-teal-900">إجمالي مجمل الربح (Gross Profit)</TableCell>
                <TableCell className="text-left py-3.5 px-6 font-mono text-teal-700 text-base">{formatCurrency(data.grossProfit)}</TableCell>
              </TableRow>

              {/* Operating Expenses Section */}
              <TableRow className="bg-slate-50/70">
                <TableCell className="font-bold text-rose-800 py-3 px-6">3. المصروفات التشغيلية والعمومية</TableCell>
                <TableCell className="text-left font-bold text-rose-800 py-3 px-6 font-mono">{formatCurrency(data.expenseTotal)}</TableCell>
              </TableRow>
              {data.expenses.map((item) => (
                <TableRow key={item.code} className="hover:bg-slate-50/30 transition-colors">
                  <TableCell className="py-2 px-8 text-slate-600">{item.code} - {item.name}</TableCell>
                  <TableCell className="text-left py-2 px-6 font-mono text-slate-700">{formatCurrency(item.balance)}</TableCell>
                </TableRow>
              ))}

              {/* Net Profit Summary */}
              <TableRow className="border-t-2 border-slate-350 bg-slate-900 text-slate-100 font-bold hover:bg-slate-900">
                <TableCell className="py-4 px-6 text-base">صافي الأرباح / الخسائر (Net Profit)</TableCell>
                <TableCell className="text-left py-4 px-6 font-mono text-teal-400 text-lg font-black">{formatCurrency(data.netProfit)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
