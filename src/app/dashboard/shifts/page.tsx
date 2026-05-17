import { BadgePercent, DoorOpen } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { getCustomerInvoicesData } from "@/server/queries/app";

export default async function ShiftsPage() {
  const { shift } = await getCustomerInvoicesData();
  const rows = [
    ["رصيد افتتاحي", shift.openingCash],
    ["مبيعات نقدية", shift.cashSales],
    ["مبيعات بطاقة", shift.cardSales],
    ["مصروفات", shift.expenses],
    ["سحوبات", shift.withdrawals],
    ["إيداعات", shift.deposits],
    ["المتوقع في الصندوق", shift.expectedCash],
    ["الفعلي في الصندوق", shift.actualCash ?? 0],
    ["فرق الصندوق", shift.difference],
  ];

  return (
    <>
      <PageHeader
        title="الورديات والصندوق"
        description="فتح وردية، رصيد افتتاحي، مبيعات نقدية وبطاقة، مصروفات، سحوبات، إيداعات، وإغلاق الوردية."
        actions={
          <Button>
            <DoorOpen className="h-4 w-4" />
            فتح وردية
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>تقرير الوردية الحالية</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {rows.map(([label, value]) => (
              <div key={label} className="rounded-lg border bg-white p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-black text-primary">{formatCurrency(Number(value))}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BadgePercent className="h-5 w-5 text-primary" />
              حالة الوردية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-muted-foreground">الكاشير</p>
              <p className="font-bold">{shift.cashierName}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-muted-foreground">الفرع</p>
              <p className="font-bold">{shift.branchName}</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <span>الحالة</span>
              <Badge tone="success">مفتوحة</Badge>
            </div>
            <Button className="w-full">إغلاق وردية</Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
