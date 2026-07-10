import { CalendarDays, Download, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { getFinancialCalendarData } from "@/server/queries/app";
import type { FinancialCalendarDay } from "@/types/domain";

export const dynamic = "force-dynamic";

const weekDays = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

export default async function FinancialCalendarPage() {
  const { days, branches } = await getFinancialCalendarData();
  const hasData = days && days.length > 0;

  const selectedDay = hasData ? days[days.length - 1] : null;
  const monthSales = hasData ? days.reduce((sum, day) => sum + day.salesTotal, 0) : 0;
  const monthExpenses = hasData ? days.reduce((sum, day) => sum + day.expensesTotal, 0) : 0;
  const monthProfit = monthSales - monthExpenses;
  const bestDay = hasData ? days.reduce((best, day) => (day.netProfit > best.netProfit ? day : best), days[0]) : null;
  const lossDays = hasData ? days.filter((day) => day.netProfit < 0).length : 0;

  return (
    <>
      <PageHeader
        title="التقويم المالي"
        description="تقويم شهري يوضح مبيعات كل يوم، مصاريفه، وصافي الربح بلمحة واحدة."
        actions={
          <Button variant="outline">
            <Download className="h-4 w-4" />
            تصدير التقرير
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-3 p-4">
          <Input className="max-w-44" type="month" defaultValue="2026-05" />
          <Select className="max-w-64" defaultValue="all">
            <option value="all">كل الفروع</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <Select className="max-w-64" defaultValue="net_profit">
            <option value="net_profit">عرض صافي الربح</option>
            <option value="sales">عرض المبيعات</option>
            <option value="expenses">عرض المصاريف</option>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="مبيعات الشهر" value={formatCurrency(monthSales)} description="إجمالي الإيرادات" icon={TrendingUp} />
        <MetricCard label="مصاريف الشهر" value={formatCurrency(monthExpenses)} description="أجور ومواد ومرافق" icon={TrendingDown} tone="warning" />
        <MetricCard
          label="صافي الربح"
          value={formatCurrency(monthProfit)}
          description="المبيعات ناقص المصاريف"
          icon={WalletCards}
          tone={monthProfit >= 0 ? "success" : "danger"}
        />
        <MetricCard label="أيام خاسرة" value={formatNumber(lossDays)} description={bestDay ? `أفضل يوم ${formatCurrency(bestDay.netProfit)}` : "لا توجد بيانات"} icon={CalendarDays} tone="danger" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              مايو ٢٠٢٦
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-muted-foreground">
              {weekDays.map((day) => (
                <div key={day} className="py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={`empty-${index}`} className="min-h-28 rounded-lg border border-dashed bg-slate-50" />
              ))}
              {Array.from({ length: 31 }).map((_, index) => {
                const dayNumber = index + 1;
                const day = days.find((item) => Number(item.date.slice(-2)) === dayNumber);
                return <CalendarCell key={dayNumber} dayNumber={dayNumber} day={day} selected={day?.date === selectedDay?.date} />;
              })}
            </div>
          </CardContent>
        </Card>

        {selectedDay ? (
          <DayDetails day={selectedDay} />
        ) : (
          <Card className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <CalendarDays className="h-10 w-10 text-slate-300 mb-2" />
            <p className="font-bold text-sm">لا توجد تفاصيل متاحة لليوم المختار</p>
          </Card>
        )}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>شرح صافي الربح</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-lg border bg-slate-50 p-4">
            <p className="text-lg font-black">صافي الربح = إجمالي المبيعات - إجمالي المصاريف</p>
            <p className="mt-2 text-sm text-muted-foreground">
              المصاريف تشمل أجور العمال، المواد الخام، الكهرباء والماء، الإيجار، التوصيل، وأي مصروف تشغيلي آخر. الرقم الموجب يعني أن اليوم رابح، والرقم السالب يعني أن المصاريف أعلى من المبيعات.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">هامش صافي الربح لليوم المختار</p>
            <p className="mt-2 text-3xl font-black text-primary">
              {selectedDay && selectedDay.salesTotal > 0
                ? formatPercent((selectedDay.netProfit / selectedDay.salesTotal) * 100)
                : "0%"}
            </p>
            {selectedDay ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {formatCurrency(selectedDay.salesTotal)} - {formatCurrency(selectedDay.expensesTotal)} = {formatCurrency(selectedDay.netProfit)}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">لا توجد مبيعات في اليوم المختار</p>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function CalendarCell({ dayNumber, day, selected }: { dayNumber: number; day?: FinancialCalendarDay; selected: boolean }) {
  const tone =
    day?.status === "profit"
      ? "border-green-200 bg-green-50 text-green-900"
      : day?.status === "loss"
        ? "border-red-200 bg-red-50 text-red-900"
        : day
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-slate-200 bg-white text-slate-400";

  return (
    <div className={`min-h-28 rounded-lg border p-3 text-start ${tone} ${selected ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="font-black">{formatNumber(dayNumber)}</span>
        {day ? <Badge tone={day.netProfit >= 0 ? "success" : "danger"}>{day.netProfit >= 0 ? "ربح" : "خسارة"}</Badge> : null}
      </div>
      {day ? (
        <div className="mt-3 space-y-1 text-xs">
          <p>مبيعات {formatCurrency(day.salesTotal)}</p>
          <p>مصاريف {formatCurrency(day.expensesTotal)}</p>
          <p className="font-black">صافي {formatCurrency(day.netProfit)}</p>
        </div>
      ) : (
        <p className="mt-3 text-xs">لا توجد بيانات</p>
      )}
    </div>
  );
}

function DayDetails({ day }: { day: FinancialCalendarDay }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>تفاصيل يوم {new Date(`${day.date}T12:00:00`).toLocaleDateString("ar-PS", { day: "numeric", month: "long" })}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <MiniTotal title="المبيعات" value={day.salesTotal} tone="success" />
          <MiniTotal title="المصاريف" value={day.expensesTotal} tone="warning" />
          <MiniTotal title="الصافي" value={day.netProfit} tone={day.netProfit >= 0 ? "success" : "danger"} />
        </div>
        <div className="rounded-lg border p-3 text-sm">
          <div className="flex justify-between">
            <span>مبيعات نقدية</span>
            <span className="font-bold">{formatCurrency(day.cashSales)}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span>مبيعات بطاقة</span>
            <span className="font-bold">{formatCurrency(day.cardSales)}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span>الفرع</span>
            <span className="font-bold">{day.branchName}</span>
          </div>
        </div>

        <div>
          <h3 className="mb-2 font-bold">المبيعات</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الصنف</TableHead>
                <TableHead>الكمية</TableHead>
                <TableHead>القيمة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {day.sales.map((sale) => (
                <TableRow key={sale.itemName}>
                  <TableCell>{sale.itemName}</TableCell>
                  <TableCell>{formatNumber(sale.quantity)}</TableCell>
                  <TableCell>{formatCurrency(sale.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div>
          <h3 className="mb-2 font-bold">الالتزامات والمصاريف</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>البند</TableHead>
                <TableHead>القيمة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {day.expenses.map((expense) => (
                <TableRow key={expense.category}>
                  <TableCell>
                    <div className="font-medium">{expense.category}</div>
                    <p className="text-xs text-muted-foreground">{expense.notes}</p>
                  </TableCell>
                  <TableCell>{formatCurrency(expense.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniTotal({ title, value, tone }: { title: string; value: number; tone: "success" | "warning" | "danger" }) {
  const className = tone === "success" ? "text-green-700" : tone === "warning" ? "text-amber-700" : "text-red-700";
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className={`mt-1 font-black ${className}`}>{formatCurrency(value)}</p>
    </div>
  );
}
