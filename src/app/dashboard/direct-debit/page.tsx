import Link from "next/link";
import { Ban, CheckCircle2, Edit3, PauseCircle, Plus, ShieldCheck, WalletCards } from "lucide-react";
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
import type { DirectDebitMandate, DirectDebitRun } from "@/types/domain";

const mandateLabels: Record<DirectDebitMandate["status"], string> = {
  active: "فعّال",
  paused: "متوقف مؤقتًا",
  cancelled: "ملغي",
  pending: "بانتظار التفعيل",
};

const mandateTones: Record<DirectDebitMandate["status"], "success" | "warning" | "danger" | "muted"> = {
  active: "success",
  paused: "warning",
  cancelled: "danger",
  pending: "muted",
};

const runLabels: Record<DirectDebitRun["status"], string> = {
  scheduled: "مجدولة",
  processing: "قيد المعالجة",
  paid: "مدفوعة",
  failed: "فشلت",
};

const runTones: Record<DirectDebitRun["status"], "success" | "warning" | "danger" | "muted"> = {
  scheduled: "muted",
  processing: "warning",
  paid: "success",
  failed: "danger",
};

export default async function DirectDebitPage() {
  const { mandates, runs } = await getBillPaymentsData();
  const activeMandates = mandates.filter((mandate) => mandate.status === "active").length;
  const scheduledRuns = runs.filter((run) => run.status === "scheduled").length;
  const monthlyLimit = mandates.reduce((sum, mandate) => sum + mandate.amountLimit, 0);
  const failedRuns = runs.filter((run) => run.status === "failed").length;

  return (
    <>
      <PageHeader
        title="الخصم المباشر"
        description="تفويضات رقمية لدفع الفواتير المتكررة تلقائيًا في تاريخ الاستحقاق مع إدارة مرنة وأمان أعلى."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/bill-payments">
                <WalletCards className="h-4 w-4" />
                دفع الفواتير
              </Link>
            </Button>
            <Button>
              <Plus className="h-4 w-4" />
              تفويض جديد
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="تفويضات فعّالة" value={formatNumber(activeMandates)} description="خصم تلقائي متكرر" icon={CheckCircle2} tone="success" />
        <MetricCard label="دفعات قادمة" value={formatNumber(scheduledRuns)} description="ستخصم عند الاستحقاق" icon={WalletCards} />
        <MetricCard label="حدود الخصم" value={formatCurrency(monthlyLimit)} description="إجمالي الحدود المسموحة" icon={ShieldCheck} tone="warning" />
        <MetricCard label="عمليات فاشلة" value={formatNumber(failedRuns)} description="تحتاج مراجعة" icon={Ban} tone="danger" />
      </div>

      <Card className="mt-4">
        <CardContent className="flex flex-wrap gap-3 p-4">
          <Input className="max-w-72" placeholder="بحث بالمفوتر أو التفويض" />
          <Select className="max-w-56" defaultValue="all">
            <option value="all">كل الحالات</option>
            <option value="active">فعّال</option>
            <option value="paused">متوقف مؤقتًا</option>
            <option value="pending">بانتظار التفعيل</option>
            <option value="cancelled">ملغي</option>
          </Select>
          <Select className="max-w-56" defaultValue="all">
            <option value="all">كل القنوات</option>
            <option value="app">تطبيق</option>
            <option value="gateway">بوابة دفع</option>
            <option value="bank">حساب بنكي</option>
          </Select>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Card>
          <CardHeader>
            <CardTitle>إدارة التفويضات</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المفوتر</TableHead>
                  <TableHead>الحساب</TableHead>
                  <TableHead>حد الخصم</TableHead>
                  <TableHead>الاستحقاق القادم</TableHead>
                  <TableHead>القناة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إدارة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mandates.map((mandate) => (
                  <TableRow key={mandate.id}>
                    <TableCell className="font-bold">{mandate.billerName}</TableCell>
                    <TableCell>{mandate.accountHint}</TableCell>
                    <TableCell>{formatCurrency(mandate.amountLimit)}</TableCell>
                    <TableCell>{mandate.nextDueDate}</TableCell>
                    <TableCell>{mandate.channel}</TableCell>
                    <TableCell>
                      <Badge tone={mandateTones[mandate.status]}>{mandateLabels[mandate.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline">
                          <Edit3 className="h-4 w-4" />
                          تعديل
                        </Button>
                        <Button size="sm" variant="outline">
                          <PauseCircle className="h-4 w-4" />
                          إيقاف
                        </Button>
                        <Button size="sm" variant="destructive">
                          <Ban className="h-4 w-4" />
                          إلغاء
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              الأمان والتفعيل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <SecurityItem title="تفعيل فوري" body="إنشاء التفويض رقميًا دون أوراق، مع تحقق من هوية صاحب الحساب." />
            <SecurityItem title="قنوات آمنة" body="استخدام بيانات اعتماد موثقة، وربط التفويض بحساب أو بطاقة محددة." />
            <SecurityItem title="حدود خصم" body="لكل تفويض حد أعلى يمنع الخصم فوق المبلغ المسموح." />
            <SecurityItem title="إدارة مرنة" body="يمكن تعديل التفويض، إيقافه مؤقتًا، أو إلغاؤه من نفس الشاشة." />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>الدفعات التلقائية</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المفوتر</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>تاريخ الاستحقاق</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الرسالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-bold">{run.billerName}</TableCell>
                  <TableCell>{run.customerName}</TableCell>
                  <TableCell>{run.dueDate}</TableCell>
                  <TableCell>{formatCurrency(run.amount)}</TableCell>
                  <TableCell>
                    <Badge tone={runTones[run.status]}>{runLabels[run.status]}</Badge>
                  </TableCell>
                  <TableCell>{run.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function SecurityItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="font-black">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
