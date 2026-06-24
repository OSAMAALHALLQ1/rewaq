import { BadgePercent, DoorOpen } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { closeSalesShiftAction } from "@/server/actions/mutations";
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
  const isOpen = shift.status === "open";

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
              <p className="text-sm text-muted-foreground">وقت الفتح</p>
              <p className="font-bold">{new Date(shift.openedAt).toLocaleString("ar")}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-muted-foreground">الفرع</p>
              <p className="font-bold">{shift.branchName}</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <span>الحالة</span>
              <Badge tone={isOpen ? "success" : "muted"}>{isOpen ? "مفتوحة" : "مغلقة"}</Badge>
            </div>
            {isOpen ? (
              <ActionForm action={closeSalesShiftAction} submitLabel="إغلاق الوردية" className="space-y-3">
                <Input type="hidden" name="shiftId" value={shift.id} readOnly />
                <div className="grid gap-2">
                  <Label htmlFor="actualCash">الكاش الفعلي في الصندوق</Label>
                  <Input
                    id="actualCash"
                    name="actualCash"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={shift.expectedCash.toFixed(2)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    المتوقع: {formatCurrency(shift.expectedCash)}. الفرق يحسب تلقائياً عند الإغلاق.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">ملاحظات الإغلاق</Label>
                  <Textarea id="notes" name="notes" rows={3} placeholder="مثال: نقص 20 شيكل بسبب مصروف لم يسجل" />
                </div>
              </ActionForm>
            ) : (
              <Button className="w-full" disabled>الوردية مغلقة</Button>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
