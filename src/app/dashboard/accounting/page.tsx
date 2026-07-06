import Link from "next/link";
import { redirect } from "next/navigation";
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Wallet, 
  CreditCard, 
  Boxes, 
  RotateCcw, 
  Clock, 
  AlertCircle, 
  FileText, 
  ArrowLeftRight, 
  Info, 
  AlertTriangle,
  Receipt,
  UserCheck,
  Percent
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentSession } from "@/lib/auth/session";
import { getAccountingDashboardData } from "@/server/queries/accounting-erp";
import { formatCurrency } from "@/lib/utils";
import { ACCOUNTING_TERM_HELP } from "@/lib/accounting/constants";

function HelpTip({ termKey }: { termKey: string }) {
  const text = ACCOUNTING_TERM_HELP[termKey];
  if (!text) return null;
  return (
    <span className="group relative ms-1.5 inline-block cursor-help align-middle text-slate-400 hover:text-slate-650">
      <Info className="h-3.5 w-3.5" />
      <span className="pointer-events-none absolute bottom-full start-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg bg-slate-900/95 p-2.5 text-right text-[10px] leading-5 text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

export default async function AccountingDashboardPage() {
  const session = await getCurrentSession();
  
  // Allow only super_admin, organization_owner, accountant, and branch_manager
  if (!["super_admin", "organization_owner", "accountant", "branch_manager"].includes(session.role)) {
    redirect("/dashboard");
  }

  const isFullAccountant = ["super_admin", "organization_owner", "accountant"].includes(session.role);

  const data = await getAccountingDashboardData();

  return (
    <>
      <PageHeader
        title="لوحة القيادة المالية والتحليل"
        description="ملخص فوري لمبيعات وتكاليف ومصروفات المطعم، وأرصدة الصناديق والالتزامات مع دليل الحسابات الذكي."
        actions={
          isFullAccountant && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild className="border-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-50">
                <Link href="/dashboard/accounting/trial-balance">
                  ميزان المراجعة
                </Link>
              </Button>
              <Button asChild className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-md shadow-teal-500/10">
                <Link href="/dashboard/accounting/ledger/new">
                  إضافة قيد يدوي
                </Link>
              </Button>
            </div>
          )
        }
      />

      {/* Warnings block */}
      {(data.draftEntries > 0 || Math.abs(data.cashBalance + data.bankBalance) < 0.01) && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2" dir="rtl">
          {data.draftEntries > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-250 bg-amber-50/60 p-4 text-right">
              <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold text-amber-900">يوجد قيود غير مرحلة (مسودة)</p>
                <p className="text-[10px] text-amber-600 mt-0.5">عددها: {data.draftEntries} قيود. رحّل القيود أو ألغِها لتحديث التقارير والإقفال.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid of Financial Metrics */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 text-right mb-6" dir="rtl">
        
        {/* Today Sales */}
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="p-2 rounded-xl bg-teal-50 text-teal-600">
                <TrendingUp className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-bold text-slate-400">مبيعات اليوم</p>
            </div>
            <div className="mt-3">
              <h3 className="font-mono text-lg font-black text-slate-900">{formatCurrency(data.todaySales)}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">اليوم الجاري</p>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Sales */}
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <BarChart3 className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-bold text-slate-400">مبيعات الشهر</p>
            </div>
            <div className="mt-3">
              <h3 className="font-mono text-lg font-black text-slate-900">{formatCurrency(data.monthSales)}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">الشهر الجاري</p>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Expenses */}
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <TrendingDown className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-bold text-slate-400">المصروفات التشغيلية</p>
            </div>
            <div className="mt-3">
              <h3 className="font-mono text-lg font-black text-rose-650">{formatCurrency(data.monthExpenses)}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">رواتب، إيجار، طاقة...</p>
            </div>
          </CardContent>
        </Card>

        {/* Net Profit Estimate */}
        <Card className="backdrop-blur-md bg-teal-950 text-white border-0 shadow-md rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="p-2 rounded-xl bg-teal-800 text-teal-300">
                <Percent className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-bold text-teal-200">صافي الربح التقديري <HelpTip termKey="net_profit" /></p>
            </div>
            <div className="mt-3">
              <h3 className="font-mono text-lg font-black text-teal-300">{formatCurrency(data.monthNetProfit)}</h3>
              <p className="text-[10px] text-teal-200 mt-0.5">تكلفة البضاعة المباعة: {formatCurrency(data.monthCogs)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Cash Balance */}
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Wallet className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-bold text-slate-400">رصيد الصندوق</p>
            </div>
            <div className="mt-3">
              <h3 className="font-mono text-lg font-black text-slate-900">{formatCurrency(data.cashBalance)}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">النقدية المتوفرة بالمحل</p>
            </div>
          </CardContent>
        </Card>

        {/* Bank Balance */}
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <CreditCard className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-bold text-slate-400">رصيد البنك</p>
            </div>
            <div className="mt-3">
              <h3 className="font-mono text-lg font-black text-slate-900">{formatCurrency(data.bankBalance)}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">بطاقات، مدى، تحويلات</p>
            </div>
          </CardContent>
        </Card>

        {/* Supplier Payable */}
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <ArrowLeftRight className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-bold text-slate-400">ذمم الموردين <HelpTip termKey="accounts_payable" /></p>
            </div>
            <div className="mt-3">
              <h3 className="font-mono text-lg font-black text-slate-900">{formatCurrency(data.supplierPayable)}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">غير مدفوعة متبقية للموردين</p>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Value */}
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="p-2 rounded-xl bg-slate-100 text-slate-600">
                <Boxes className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-bold text-slate-400">قيمة المخزون</p>
            </div>
            <div className="mt-3">
              <h3 className="font-mono text-lg font-black text-slate-900">{formatCurrency(data.inventoryValue)}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">القيمة الدفترية للمواد</p>
            </div>
          </CardContent>
        </Card>

        {/* Refunds */}
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="p-2 rounded-xl bg-orange-50 text-orange-600">
                <RotateCcw className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-bold text-slate-400">مرتجعات المبيعات</p>
            </div>
            <div className="mt-3">
              <h3 className="font-mono text-lg font-black text-slate-900">{formatCurrency(data.monthRefunds)}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">هذا الشهر</p>
            </div>
          </CardContent>
        </Card>

        {/* Open Shifts */}
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Clock className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-bold text-slate-400">الورديات المفتوحة</p>
            </div>
            <div className="mt-3">
              <h3 className="font-mono text-lg font-black text-slate-900">{data.openShifts} وردية</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">قيد العمل حالياً</p>
            </div>
          </CardContent>
        </Card>

        {/* Draft journal entries */}
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="p-2 rounded-xl bg-red-50 text-red-600">
                <AlertCircle className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-bold text-slate-400">قيود مسودة (معلقة)</p>
            </div>
            <div className="mt-3">
              <h3 className="font-mono text-lg font-black text-slate-900">{data.draftEntries} قيود</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">تحتاج مراجعة وترحيل</p>
            </div>
          </CardContent>
        </Card>

        {/* Customer Receivable */}
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <UserCheck className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-bold text-slate-400">ذمم العملاء <HelpTip termKey="accounts_receivable" /></p>
            </div>
            <div className="mt-3">
              <h3 className="font-mono text-lg font-black text-slate-900">{formatCurrency(data.customerReceivable)}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">مستحقات عند العملاء الآجل</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid: Recent entries and Unpaid Supplier Invoices */}
      <div className="grid gap-6 xl:grid-cols-2 text-right" dir="rtl">
        
        {/* Recent Journal Entries */}
        {isFullAccountant && (
          <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="border-b bg-slate-50/50 py-3.5 px-5 flex flex-row justify-between items-center">
              <CardTitle className="text-sm font-black text-slate-900">آخر القيود المالية المرحلة</CardTitle>
              <Button asChild variant="ghost" size="sm" className="text-teal-700 hover:text-teal-800 text-xs font-bold gap-1">
                <Link href="/dashboard/accounting/ledger">عرض تفصيلي</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="border-b text-slate-400">
                    <TableHead className="text-right py-2.5 px-5">رقم القيد</TableHead>
                    <TableHead className="text-right py-2.5 px-5">التاريخ</TableHead>
                    <TableHead className="text-right py-2.5 px-5">البيان</TableHead>
                    <TableHead className="text-left py-2.5 px-5">القيمة</TableHead>
                    <TableHead className="text-center py-2.5 px-5">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400">لا توجد قيود مرحلة حالياً</TableCell>
                    </TableRow>
                  ) : (
                    data.recentEntries.map((entry) => (
                      <TableRow key={entry.id} className="hover:bg-slate-50/30 transition-colors">
                        <TableCell className="font-mono py-2.5 px-5 text-slate-700">{entry.entryNumber}</TableCell>
                        <TableCell className="py-2.5 px-5 text-slate-650">{entry.entryDate}</TableCell>
                        <TableCell className="py-2.5 px-5 font-bold text-slate-950 truncate max-w-[180px]">{entry.memo ?? "قيد محاسبي"}</TableCell>
                        <TableCell className="text-left py-2.5 px-5 font-mono font-medium text-slate-800">{formatCurrency(entry.total)}</TableCell>
                        <TableCell className="text-center py-2.5 px-5">
                          <Badge tone={entry.status === "posted" ? "success" : entry.status === "void" ? "danger" : "warning"} className="rounded-lg px-2 py-0.5">
                            {entry.status === "posted" ? "مرحّل" : entry.status === "void" ? "ملغى" : "مسودة"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Pending Supplier Invoices */}
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50 py-3.5 px-5 flex flex-row justify-between items-center">
            <CardTitle className="text-sm font-black text-slate-900">فواتير التوريد المعلقة للموردين</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-teal-700 hover:text-teal-800 text-xs font-bold gap-1">
              <Link href="/dashboard/invoices">إدارة الفواتير</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="border-b text-slate-400">
                  <TableHead className="text-right py-2.5 px-5">رقم الفاتورة</TableHead>
                  <TableHead className="text-right py-2.5 px-5">المورد</TableHead>
                  <TableHead className="text-right py-2.5 px-5">التاريخ</TableHead>
                  <TableHead className="text-left py-2.5 px-5">الإجمالي</TableHead>
                  <TableHead className="text-center py-2.5 px-5">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.unpaidSupplierInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-400">لا توجد فواتير معلقة حالياً</TableCell>
                  </TableRow>
                ) : (
                  data.unpaidSupplierInvoices.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="font-mono py-2.5 px-5 text-slate-700">{inv.invoiceNumber}</TableCell>
                      <TableCell className="py-2.5 px-5 font-bold text-slate-950">{inv.supplierName}</TableCell>
                      <TableCell className="py-2.5 px-5 text-slate-650">{inv.issuedAt}</TableCell>
                      <TableCell className="text-left py-2.5 px-5 font-mono font-medium text-slate-800">{formatCurrency(inv.total)}</TableCell>
                      <TableCell className="text-center py-2.5 px-5">
                        <Badge tone={inv.status === "matched" ? "success" : "default"} className="rounded-lg px-2 py-0.5">
                          {inv.status === "matched" ? "مرحّلة" : "مسودة"}
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

      {/* Accounting Help Box */}
      <div className="mt-6 max-w-4xl mx-auto" dir="rtl">
        <Card className="backdrop-blur-md bg-teal-50/40 border border-teal-200/50 shadow-sm rounded-2xl p-5 text-right">
          <div className="flex items-start gap-3">
            <span className="p-2 rounded-xl bg-teal-100 text-teal-700">
              <Info className="h-5 w-5" />
            </span>
            <div>
              <h4 className="text-sm font-bold text-slate-900">عن لوحة المحاسبة والترحيل الذكي</h4>
              <p className="text-xs text-slate-600 mt-1 leading-6">
                رواق يعتمد على نظام القيد المزدوج. كل حركة في الكاشير (مبيعات)، أو استلام البضائع (مخزون)، أو صرف وردية الصندوق، أو تسجيل مصروفات تشغيلية؛ يتم ترحيلها محاسبياً تلقائياً إلى دفتر اليومية ودليل الحسابات، مما يوفر لك ميزان مراجعة وميزانية فورية بدون تدخل محاسب يومي.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
