import { CircleDollarSign, Download, ReceiptText, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { getAmwaliData } from "@/server/queries/app";
import type { CostCenter } from "@/types/domain";

const sectionTone: Record<string, string> = {
  "raw-materials": "bg-teal-600",
  labor: "bg-sky-600",
  operations: "bg-amber-500",
  fixed: "bg-slate-700",
  waste: "bg-red-600",
};

const centerTone: Record<CostCenter["status"], "success" | "warning" | "danger"> = {
  healthy: "success",
  watch: "warning",
  danger: "danger",
};

export default async function AmwaliPage() {
  const { costTracking, branches } = await getAmwaliData();
  const highestSection = costTracking.sections.reduce((highest, section) => (section.total > highest.total ? section : highest), costTracking.sections[0]);
  const wasteSection = costTracking.sections.find((section) => section.id === "waste");
  const materialsSection = costTracking.sections.find((section) => section.id === "raw-materials");

  return (
    <>
      <PageHeader
        title="أموالي"
        description="تقرير يوضح كل شيكل وين راح: مواد، رواتب، تشغيل، ثابت، هدر، والربح الحقيقي."
        actions={
          <Button variant="outline">
            <Download className="h-4 w-4" />
            تصدير التقرير
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-3 p-4">
          <Input className="max-w-44" type="date" defaultValue={costTracking.date} />
          <Select className="max-w-64" defaultValue="all">
            <option value="all">كل الفروع</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </Select>
          <Select className="max-w-64" defaultValue="daily">
            <option value="daily">تقرير يومي</option>
            <option value="weekly">تقرير أسبوعي</option>
            <option value="monthly">تقرير شهري</option>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="دخل اليوم" value={formatCurrency(costTracking.salesTotal)} description={costTracking.branchName} icon={TrendingUp} tone="success" />
        <MetricCard label="المصروف الكامل" value={formatCurrency(costTracking.expensesTotal)} description="كل مراكز التكلفة" icon={TrendingDown} tone="warning" />
        <MetricCard label="الربح الحقيقي" value={formatCurrency(costTracking.netProfit)} description={`هامش ${formatPercent(costTracking.profitMarginPercent)}`} icon={WalletCards} tone="success" />
        <MetricCard label="أكبر بند تكلفة" value={highestSection.title} description={formatCurrency(highestSection.total)} icon={CircleDollarSign} tone="danger" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-primary" />
              وين راحت المصاري
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {costTracking.sections.map((section) => {
              const percent = costTracking.salesTotal > 0 ? (section.total / costTracking.salesTotal) * 100 : 0;
              return (
                <div key={section.id} className="rounded-xl border bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-black text-slate-950">{section.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-xl font-black">{formatCurrency(section.total)}</p>
                      <p className="text-xs text-muted-foreground">{formatPercent(percent)} من الدخل</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${sectionTone[section.id] ?? "bg-primary"}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>الربح والخسارة المفصل</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-green-50 p-4 text-green-950">
              <p className="text-sm">الدخل</p>
              <p className="mt-1 text-3xl font-black">{formatCurrency(costTracking.salesTotal)}</p>
            </div>
            <div className="space-y-2">
              {costTracking.sections.map((section) => (
                <div key={section.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span>{section.title}</span>
                  <span className="font-bold">- {formatCurrency(section.total)}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
              <p className="text-sm text-teal-900">الربح الحقيقي</p>
              <p className="mt-1 text-3xl font-black text-teal-950">{formatCurrency(costTracking.netProfit)}</p>
              <p className="mt-2 text-sm text-teal-800">
                {formatCurrency(costTracking.salesTotal)} - {formatCurrency(costTracking.expensesTotal)} = {formatCurrency(costTracking.netProfit)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>تفصيل البنود</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {costTracking.sections.map((section) => (
              <div key={section.id}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-bold">{section.title}</h3>
                  <Badge tone={section.id === "waste" ? "danger" : section.id === "raw-materials" ? "warning" : "default"}>
                    {formatCurrency(section.total)}
                  </Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>البند</TableHead>
                      <TableHead>الكمية</TableHead>
                      <TableHead>القيمة</TableHead>
                      <TableHead>ملاحظة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {section.lines.map((line) => (
                      <TableRow key={`${section.id}-${line.name}`}>
                        <TableCell className="font-medium">{line.name}</TableCell>
                        <TableCell>{line.quantity ? `${formatNumber(line.quantity)} ${line.unit ?? ""}` : "لا يوجد"}</TableCell>
                        <TableCell>{formatCurrency(line.amount)}</TableCell>
                        <TableCell className="text-muted-foreground">{line.notes ?? "لا يوجد"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>مراكز التكلفة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {costTracking.costCenters.map((center) => (
                <div key={center.name} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{center.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{center.notes}</p>
                    </div>
                    <Badge tone={centerTone[center.status]}>{formatPercent(center.percent)}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span>{formatCurrency(center.amount)}</span>
                    <span className="text-muted-foreground">من دخل اليوم</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>الصالة مقابل الدليفري</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>القناة</TableHead>
                    <TableHead>طلبات</TableHead>
                    <TableHead>دخل</TableHead>
                    <TableHead>تكلفة</TableHead>
                    <TableHead>ربح</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costTracking.channelBreakdown.map((channel) => (
                    <TableRow key={channel.channel}>
                      <TableCell className="font-medium">{channel.channel}</TableCell>
                      <TableCell>{formatNumber(channel.orders)}</TableCell>
                      <TableCell>{formatCurrency(channel.revenue)}</TableCell>
                      <TableCell>{formatCurrency(channel.directCost)}</TableCell>
                      <TableCell>{formatCurrency(channel.profit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>تنبيهات ذكية لصاحب المطعم</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {costTracking.smartInsights.map((insight) => (
            <div key={insight.title} className="rounded-xl border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold">{insight.title}</p>
                <Badge tone={insight.tone}>{insight.value}</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{insight.notes}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>المعادلة التي يعتمدها أموالي</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-lg font-black">الربح الحقيقي = دخل اليوم - كل المصاريف</p>
            <p className="mt-2 text-sm text-muted-foreground">
              كل المصاريف تشمل المواد الخام، الرواتب، التشغيل، الحصة اليومية من المصاريف الثابتة، والهدر. الهدف أن يعرف صاحب المطعم أين ذهب كل شيكل قبل أن يحسب الربح.
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">أخطر بند اليوم</p>
            <p className="mt-2 text-2xl font-black text-red-700">{wasteSection?.lines[0]?.name ?? "لا يوجد"}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              المواد الخام: {formatCurrency(materialsSection?.total ?? 0)} · الهدر: {formatCurrency(wasteSection?.total ?? 0)}
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
