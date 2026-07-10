import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getTaxReportData } from "@/server/queries/accounting-treasury";
import { PeriodFilter } from "@/components/accounting/report-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

type Props = { searchParams: Promise<{ from?: string; to?: string }> };

export default async function TaxReportPage({ searchParams }: Props) {
  const session = await getCurrentSession();
  if (!["super_admin", "organization_owner", "accountant"].includes(session.role)) {
    redirect("/dashboard/accounting");
  }
  const params = await searchParams;
  const data = await getTaxReportData(params.from || undefined, params.to || undefined);

  return (
    <>
      <PageHeader
        title="تقرير الضرائب (Tax / VAT Report)"
        description={`الضرائب على المبيعات والمشتريات من ${data.from} إلى ${data.to}. يُحسب ضريبة المخرجات (على المبيعات) وضريبة المدخلات (على المشتريات) والصافي المستحق للسلطة الضريبية.`}
      />
      <div className="mt-4 space-y-4">
        <PeriodFilter basePath="/dashboard/accounting/tax" from={data.from} to={data.to} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-rose-600 text-white border-0 rounded-2xl p-4">
            <p className="text-[10px] font-bold opacity-80">ضريبة المخرجات (على المبيعات)</p>
            <h3 className="font-mono text-lg font-black mt-1">{formatCurrency(data.outputTax)}</h3>
          </Card>
          <Card className="bg-emerald-600 text-white border-0 rounded-2xl p-4">
            <p className="text-[10px] font-bold opacity-80">ضريبة المدخلات (على المشتريات)</p>
            <h3 className="font-mono text-lg font-black mt-1">{formatCurrency(data.inputTax)}</h3>
          </Card>
          <Card className="bg-slate-900 text-white border-0 rounded-2xl p-4">
            <p className="text-[10px] font-bold opacity-80">الصافي المستحق للسلطة الضريبية</p>
            <h3 className="font-mono text-lg font-black mt-1">{formatCurrency(data.netTax)}</h3>
          </Card>
        </div>
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50 py-3 px-5">
            <CardTitle className="text-sm font-black text-slate-900">تفصيل التقرير</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs text-right" dir="rtl">
              <tbody>
                <tr className="border-b hover:bg-slate-50/30">
                  <td className="py-3 px-4 font-bold text-slate-800">إجمالي مبيعات الفترة (شامل الضريبة)</td>
                  <td className="text-left py-3 px-4 font-mono text-slate-900">{formatCurrency(data.salesTotal)}</td>
                </tr>
                <tr className="border-b hover:bg-slate-50/30">
                  <td className="py-3 px-4 font-bold text-slate-800">إجمالي مشتريات الفترة</td>
                  <td className="text-left py-3 px-4 font-mono text-slate-900">{formatCurrency(data.purchaseTotal)}</td>
                </tr>
                <tr className="border-b hover:bg-slate-50/30">
                  <td className="py-3 px-4 font-bold text-slate-800">ضريبة المخرجات (دائن)</td>
                  <td className="text-left py-3 px-4 font-mono text-rose-600">{formatCurrency(data.outputTax)}</td>
                </tr>
                <tr className="border-b hover:bg-slate-50/30">
                  <td className="py-3 px-4 font-bold text-slate-800">ضريبة المدخلات (مدين)</td>
                  <td className="text-left py-3 px-4 font-mono text-emerald-600">{formatCurrency(data.inputTax)}</td>
                </tr>
                <tr className="bg-slate-50/70 border-t-2 font-black">
                  <td className="py-3 px-4 text-slate-800">الصافي المستحق للسلطة الضريبية</td>
                  <td className="text-left py-3 px-4 font-mono text-slate-900">{formatCurrency(data.netTax)}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
