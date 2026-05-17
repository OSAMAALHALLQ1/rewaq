import Link from "next/link";
import { CalendarClock, CheckCircle2, Clock3, CreditCard, Layers3, RefreshCw, WalletCards } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { getBillPaymentsData } from "@/server/queries/app";
import type { PayableBill, PayableBillStatus } from "@/types/domain";

const statusLabels: Record<PayableBillStatus, string> = {
  due: "مستحقة",
  partial: "مدفوعة جزئيًا",
  scheduled: "مجدولة",
  paid: "مدفوعة",
  overdue: "متأخرة",
};

const statusTones: Record<PayableBillStatus, "default" | "success" | "warning" | "danger" | "muted"> = {
  due: "warning",
  partial: "default",
  scheduled: "muted",
  paid: "success",
  overdue: "danger",
};

export default async function BillPaymentsPage() {
  const { bills, batches } = await getBillPaymentsData();
  const remainingTotal = bills.reduce((sum, bill) => sum + bill.remainingAmount, 0);
  const dueNow = bills.filter((bill) => bill.status === "due" || bill.status === "overdue").length;
  const scheduled = bills.filter((bill) => bill.status === "scheduled").length;
  const partial = bills.filter((bill) => bill.status === "partial").length;

  return (
    <>
      <PageHeader
        title="دفع الفواتير"
        description="عرض موحد للفواتير من عدة مفوترين، استعلام فوري، دفع كامل أو جزئي، دمج فواتير، وجدولة مدفوعات."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/direct-debit">
                <RefreshCw className="h-4 w-4" />
                الخصم المباشر
              </Link>
            </Button>
            <Button>
              <CreditCard className="h-4 w-4" />
              دفع فوري
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="إجمالي المطلوب" value={formatCurrency(remainingTotal)} description="كل المفوترين" icon={WalletCards} tone="warning" />
        <MetricCard label="فواتير مستحقة" value={formatNumber(dueNow)} description="جاهزة للدفع خلال ٣٠ ثانية" icon={Clock3} tone="danger" />
        <MetricCard label="مدفوعات مجدولة" value={formatNumber(scheduled)} description="تتم في وقت لاحق" icon={CalendarClock} />
        <MetricCard label="مدفوع جزئيًا" value={formatNumber(partial)} description="متبقي عليها رصيد" icon={CheckCircle2} tone="success" />
      </div>

      <Card className="mt-4">
        <CardContent className="flex flex-wrap gap-3 p-4">
          <Input className="max-w-72" placeholder="بحث باسم المفوتر أو الرقم المرجعي" />
          <Select className="max-w-56" defaultValue="all">
            <option value="all">كل الحالات</option>
            <option value="due">مستحقة</option>
            <option value="partial">مدفوعة جزئيًا</option>
            <option value="scheduled">مجدولة</option>
            <option value="overdue">متأخرة</option>
          </Select>
          <Select className="max-w-56" defaultValue="all">
            <option value="all">كل المفوترين</option>
            <option value="utilities">مرافق</option>
            <option value="supplier">موردون</option>
            <option value="rent">إيجارات</option>
          </Select>
          <Button variant="outline">
            <RefreshCw className="h-4 w-4" />
            استعلام فوري
          </Button>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Card>
          <CardHeader>
            <CardTitle>العرض الموحد للفواتير</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المفوتر</TableHead>
                  <TableHead>الفئة</TableHead>
                  <TableHead>رقم الفاتورة</TableHead>
                  <TableHead>المرجع</TableHead>
                  <TableHead>الاستحقاق</TableHead>
                  <TableHead>المتبقي</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((bill) => (
                  <BillRow key={bill.id} bill={bill} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers3 className="h-5 w-5 text-primary" />
              دمج الفواتير
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {batches.map((batch) => (
              <div key={batch.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{batch.referenceNumber}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatNumber(batch.billIds.length)} فواتير تحت رقم مرجعي واحد
                    </p>
                  </div>
                  <Badge tone={batch.status === "ready" ? "success" : "warning"}>{batch.status === "ready" ? "جاهزة" : "مجدولة"}</Badge>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 p-3">
                  <span>الإجمالي</span>
                  <span className="font-black text-primary">{formatCurrency(batch.totalAmount)}</span>
                </div>
                {batch.scheduledFor ? <p className="mt-2 text-sm text-muted-foreground">موعد الدفع: {batch.scheduledFor}</p> : null}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button size="sm">دفع دفعة واحدة</Button>
                  <Button size="sm" variant="outline">جدولة</Button>
                </div>
              </div>
            ))}

            <div className="rounded-lg border border-dashed bg-slate-50 p-4">
              <p className="font-bold">إنشاء مرجع جديد</p>
              <p className="mt-1 text-sm text-muted-foreground">اختر عدة فواتير واجمعها في دفعة واحدة لتسديدها مرة واحدة.</p>
              <Button className="mt-3 w-full" variant="outline">دمج الفواتير المحددة</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>خيارات الدفع والجدولة</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <OptionCard title="دفع كامل" body="تسديد المبلغ المتبقي كاملًا وتحديث الحالة مباشرة بعد تأكيد العملية." />
          <OptionCard title="دفع جزئي" body="تسديد جزء من الفاتورة عندما يسمح المفوتر بذلك، مع إبقاء المتبقي ظاهرًا." />
          <OptionCard title="جدولة الدفع" body="تحديد تاريخ لاحق للدفع مع بقاء الفاتورة تحت المراقبة حتى التنفيذ." />
        </CardContent>
      </Card>
    </>
  );
}

function BillRow({ bill }: { bill: PayableBill }) {
  return (
    <TableRow>
      <TableCell className="font-bold">{bill.billerName}</TableCell>
      <TableCell>{bill.category}</TableCell>
      <TableCell>{bill.billNumber}</TableCell>
      <TableCell>{bill.referenceNumber}</TableCell>
      <TableCell>{bill.dueDate}</TableCell>
      <TableCell>
        <div className="font-bold">{formatCurrency(bill.remainingAmount)}</div>
        <p className="text-xs text-muted-foreground">أصل الفاتورة {formatCurrency(bill.amount)}</p>
      </TableCell>
      <TableCell>
        <Badge tone={statusTones[bill.status]}>{statusLabels[bill.status]}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-2">
          <Button size="sm">دفع كامل</Button>
          <Button size="sm" variant="outline" disabled={!bill.canPartialPay}>دفع جزئي</Button>
          <Button size="sm" variant="outline">جدولة</Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function OptionCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="font-black">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
