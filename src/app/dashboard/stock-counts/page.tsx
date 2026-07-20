import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StockCountWorkspace } from "@/components/inventory/stock-count-workspace";
import { getStockCountsData } from "@/server/queries/app";
import { todayLocal } from "@/lib/accounting/posting";

export default async function StockCountsPage() {
  const { items, branches, branchStock, counts } = await getStockCountsData();

  return (
    <>
      <PageHeader
        title="الجرد"
        description="ابدأ جردًا لكل فرع، ثم أنشئ حركات تسوية وفروقات جرد للكميات غير المطابقة."
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <StockCountWorkspace items={items} branches={branches} branchStock={branchStock} countedAt={todayLocal()} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              سجل الجرد
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {counts.length === 0 ? (
              <p className="rounded-lg border bg-slate-50 p-4 text-sm leading-6 text-muted-foreground">
                عند اعتماد الجرد ستظهر جلسات الجرد هنا مع تفاصيل المواد والكميات.
              </p>
            ) : (
              counts.map((count) => (
                <div key={count.id} className="rounded-lg border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{count.branchName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{count.countedAt ? new Date(count.countedAt).toLocaleString("ar-PS") : "بدون تاريخ"}</p>
                    </div>
                    <Badge tone={count.status === "approved" ? "success" : "warning"}>{count.status}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-slate-50 p-2">مواد: {count.itemsCount}</div>
                    <div className="rounded-lg bg-slate-50 p-2">فروقات: {count.varianceCount}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
