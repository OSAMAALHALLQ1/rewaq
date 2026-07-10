import * as React from "react";
import Link from "next/link";
import { Scale, ArrowLeft, Layers, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getBalanceSheetData, type BalanceSheetSection } from "@/server/queries/accounting";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AsOfFilter } from "@/components/accounting/report-filters";

type Props = {
  searchParams: Promise<{ asOf?: string }>;
};

function SectionRows({ title, section, asOf }: { title: string; section: BalanceSheetSection; asOf: string }) {
  if (section.items.length === 0) return null;
  return (
    <>
      <TableRow className="bg-slate-50/40 font-bold">
        <TableCell colSpan={2} className="py-2 px-5 text-slate-800">{title}</TableCell>
      </TableRow>
      {section.items.map((item) => (
        <TableRow key={item.code} className="hover:bg-slate-50/30 transition-colors">
          <TableCell className="py-2.5 px-5 pl-8 text-slate-600">
            {item.accountId ? (
              <Link href={`/dashboard/accounting/ledger?accountId=${item.accountId}&to=${asOf}`} className="hover:text-teal-700 hover:underline">
                {item.code} - {item.name}
              </Link>
            ) : (
              <>{item.code} - {item.name}</>
            )}
          </TableCell>
          <TableCell className="text-left py-2.5 px-5 font-mono text-slate-700">{formatCurrency(item.balance)}</TableCell>
        </TableRow>
      ))}
      <TableRow className="font-bold border-b text-slate-750">
        <TableCell className="py-2 px-5 pl-8">مجموع {title}</TableCell>
        <TableCell className="text-left py-2 px-5 font-mono">{formatCurrency(section.total)}</TableCell>
      </TableRow>
    </>
  );
}

export default async function BalanceSheetPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await getBalanceSheetData({ asOf: params.asOf || undefined });

  const totalLiabilitiesAndEquity = data.liabilitiesTotal + data.equityTotal;

  return (
    <>
      <div className="flex items-center justify-between mb-4" dir="rtl">
        <Button variant="outline" size="sm" asChild className="rounded-lg gap-1 border-slate-200 hover:bg-slate-50 text-slate-700">
          <Link href="/dashboard/accounting">
            <ArrowLeft className="h-4 w-4" />
            رجوع للوحة المحاسبة
          </Link>
        </Button>
      </div>

      <PageHeader
        title="قائمة المركز المالي (Balance Sheet)"
        description={`الأصول والالتزامات وحقوق الملكية كما في ${data.asOf} — قيود مرحّلة فقط.`}
      />

      <div className="mb-6 max-w-4xl mx-auto" dir="rtl">
        <AsOfFilter basePath="/dashboard/accounting/balance-sheet" asOf={data.asOf} />
      </div>

      {/* Balanced Alert Header */}
      <div className="mb-6 max-w-4xl mx-auto" dir="rtl">
        <Card className={`backdrop-blur-md border shadow-md rounded-2xl overflow-hidden ${data.balanced ? "bg-emerald-50/50 border-emerald-200" : "bg-red-50/50 border-red-200"}`}>
          <CardContent className="p-5 flex items-center justify-between flex-wrap gap-4 text-right">
            <div className="flex items-center gap-3">
              <span className={`p-2.5 rounded-xl border ${data.balanced ? "bg-emerald-100/60 border-emerald-200 text-emerald-700" : "bg-red-100/60 border-red-200 text-red-750"}`}>
                <Scale className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">توازن المركز المالي كما في {data.asOf}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {data.balanced
                    ? "الميزانية متزنة. إجمالي الأصول يساوي إجمالي الالتزامات وحقوق الملكية."
                    : `يوجد عدم اتزان قدره ${formatCurrency(Math.abs(data.assetsTotal - totalLiabilitiesAndEquity))}. راجع دفتر اليومية العامة.`}
                </p>
              </div>
            </div>
            <Badge tone={data.balanced ? "success" : "danger"} className="h-9 px-4 text-xs font-bold rounded-xl border shadow-sm flex items-center">
              {data.balanced ? "متزنة" : "تحتاج تدقيق"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Previous period comparison */}
      {data.previous && (
        <Card className="mb-6 max-w-4xl mx-auto backdrop-blur-md bg-slate-50/60 border border-slate-200/50 shadow-sm rounded-2xl" dir="rtl">
          <CardContent className="p-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <span className="font-bold text-slate-600">مقارنة كما في {data.previous.asOf}:</span>
            <span>أصول <b className="font-mono text-slate-700">{formatCurrency(data.previous.assetsTotal)}</b></span>
            <span>التزامات <b className="font-mono text-slate-700">{formatCurrency(data.previous.liabilitiesTotal)}</b></span>
            <span>حقوق ملكية <b className="font-mono text-slate-700">{formatCurrency(data.previous.equityTotal)}</b></span>
          </CardContent>
        </Card>
      )}

      {/* Grid Comparison */}
      <div className="grid gap-6 lg:grid-cols-2 text-right max-w-4xl mx-auto" dir="rtl">
        {/* Assets Card */}
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden flex flex-col justify-between">
          <div>
            <CardHeader className="border-b bg-slate-50/50 py-3 px-5">
              <CardTitle className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Layers className="h-4.5 w-4.5 text-teal-600" />
                الأصول (Assets)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="border-b text-slate-400">
                    <TableHead className="text-right py-2.5 px-5">الحساب</TableHead>
                    <TableHead className="text-left py-2.5 px-5">الرصيد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.currentAssets.items.length === 0 && data.nonCurrentAssets.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-6 text-slate-450">لا توجد أرصدة أصول حتى هذا التاريخ</TableCell>
                    </TableRow>
                  ) : (
                    <>
                      <SectionRows title="الأصول المتداولة" section={data.currentAssets} asOf={data.asOf} />
                      <SectionRows title="الأصول غير المتداولة" section={data.nonCurrentAssets} asOf={data.asOf} />
                    </>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </div>

          <div className="border-t bg-slate-50/40 p-4 flex justify-between items-center text-sm font-bold text-slate-900 rounded-b-2xl">
            <span>إجمالي الأصول</span>
            <span className="font-mono text-teal-700 text-base font-black">{formatCurrency(data.assetsTotal)}</span>
          </div>
        </Card>

        {/* Liabilities & Equity Card */}
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden flex flex-col justify-between">
          <div>
            <CardHeader className="border-b bg-slate-50/50 py-3 px-5">
              <CardTitle className="text-sm font-black text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-4.5 w-4.5 text-teal-600" />
                الالتزامات وحقوق الملكية
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="text-xs">
                <TableBody>
                  <SectionRows title="الالتزامات المتداولة" section={data.currentLiabilities} asOf={data.asOf} />
                  <SectionRows title="الالتزامات طويلة الأجل" section={data.nonCurrentLiabilities} asOf={data.asOf} />

                  <TableRow className="bg-slate-50/40 font-bold border-t">
                    <TableCell colSpan={2} className="py-2 px-5 text-slate-800">حقوق الملكية (Equity)</TableCell>
                  </TableRow>
                  {data.equity.items.map((item) => (
                    <TableRow key={item.code} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="py-2.5 px-5 pl-8 text-slate-600">{item.code} - {item.name}</TableCell>
                      <TableCell className="text-left py-2.5 px-5 font-mono text-slate-700">{formatCurrency(item.balance)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="hover:bg-slate-50/30 transition-colors">
                    <TableCell className="py-2.5 px-5 pl-8 text-slate-600">الأرباح المرحّلة حتى {data.asOf}</TableCell>
                    <TableCell className="text-left py-2.5 px-5 font-mono text-emerald-600 font-semibold">{formatCurrency(data.retainedEarnings)}</TableCell>
                  </TableRow>
                  <TableRow className="font-bold text-slate-750">
                    <TableCell className="py-2 px-5 pl-8">مجموع حقوق الملكية</TableCell>
                    <TableCell className="text-left py-2 px-5 font-mono">{formatCurrency(data.equityTotal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </div>

          <div className="border-t bg-slate-50/40 p-4 flex justify-between items-center text-sm font-bold text-slate-900 rounded-b-2xl">
            <span>إجمالي الالتزامات وحقوق الملكية</span>
            <span className="font-mono text-teal-700 text-base font-black">{formatCurrency(totalLiabilitiesAndEquity)}</span>
          </div>
        </Card>
      </div>
    </>
  );
}
