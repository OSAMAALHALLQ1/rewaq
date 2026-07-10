import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentSession } from "@/lib/auth/session";
import { getCashFlowData } from "@/server/queries/accounting-treasury";
import { PeriodFilter } from "@/components/accounting/report-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

type Props = { searchParams: Promise<{ from?: string; to?: string }> };

export default async function CashFlowPage({ searchParams }: Props) {
  const session = await getCurrentSession();
  if (!["super_admin", "organization_owner", "accountant"].includes(session.role)) {
    redirect("/dashboard/accounting");
  }
  const params = await searchParams;
  const data = await getCashFlowData(params.from || undefined, params.to || undefined);

  const rows: Array<{ label: string; in: number; out: number }> = [
    { label: "الأنشطة التشغيلية", in: data.operatingIn, out: data.operatingOut },
    { label: "الأنشطة الاستثمارية", in: data.investingIn, out: data.investingOut },
    { label: "الأنشطة التمويلية", in: data.financingIn, out: data.financingOut },
  ];

  return (
    <>
      <PageHeader
        title="تقرير التدفق النقدي (Cash Flow Statement)"
        description={`التدفقات النقدية للصندوق والبنك من ${data.from} إلى ${data.to}. التدفق الداخل مدين الصندوق/البنك، والخارج دائنه.`}
      />
      <div className="mt-4 space-y-4">
        <PeriodFilter basePath="/dashboard/accounting/cash-flow" from={data.from} to={data.to} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-emerald-600 text-white border-0 rounded-2xl p-4">
            <p className="text-[10px] font-bold opacity-80">إجمالي التدفق الداخل</p>
            <h3 className="font-mono text-lg font-black mt-1">{formatCurrency(data.operatingIn + data.investingIn + data.financingIn)}</h3>
          </Card>
          <Card className="bg-rose-600 text-white border-0 rounded-2xl p-4">
            <p className="text-[10px] font-bold opacity-80">إجمالي التدفق الخارج</p>
            <h3 className="font-mono text-lg font-black mt-1">{formatCurrency(data.operatingOut + data.investingOut + data.financingOut)}</h3>
          </Card>
          <Card className="bg-slate-900 text-white border-0 rounded-2xl p-4">
            <p className="text-[10px] font-bold opacity-80">صافي التغير النقدي</p>
            <h3 className="font-mono text-lg font-black mt-1">{formatCurrency(data.netChange)}</h3>
          </Card>
        </div>
        <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="border-b bg-slate-50/50 py-3 px-5">
            <CardTitle className="text-sm font-black text-slate-900">تحليل التدفق حسب النشاط</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs text-right" dir="rtl">
              <thead>
                <tr className="border-b bg-slate-50/50 text-slate-400">
                  <th className="py-3 px-4 font-bold">النشاط</th>
                  <th className="text-left py-3 px-4 font-bold w-36">تدفق داخل</th>
                  <th className="text-left py-3 px-4 font-bold w-36">تدفق خارج</th>
                  <th className="text-left py-3 px-4 font-bold w-36">الصافي</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b hover:bg-slate-50/30">
                    <td className="py-3 px-4 font-bold text-slate-800">{r.label}</td>
                    <td className="text-left py-3 px-4 font-mono text-emerald-600">{formatCurrency(r.in)}</td>
                    <td className="text-left py-3 px-4 font-mono text-rose-600">{formatCurrency(r.out)}</td>
                    <td className="text-left py-3 px-4 font-mono font-black text-slate-900">{formatCurrency(r.in - r.out)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50/70 border-t-2 font-black">
                  <td className="py-3 px-4 text-slate-800">الإجمالي</td>
                  <td className="text-left py-3 px-4 font-mono text-emerald-600">{formatCurrency(data.operatingIn + data.investingIn + data.financingIn)}</td>
                  <td className="text-left py-3 px-4 font-mono text-rose-600">{formatCurrency(data.operatingOut + data.investingOut + data.financingOut)}</td>
                  <td className="text-left py-3 px-4 font-mono text-slate-900">{formatCurrency(data.netChange)}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
