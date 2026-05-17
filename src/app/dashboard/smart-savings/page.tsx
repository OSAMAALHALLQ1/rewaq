import Link from "next/link";
import { BadgeCheck, Camera, Cloud, ExternalLink, Printer, QrCode, ReceiptText, Smartphone, WalletCards } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { getSmartSavingsData } from "@/server/queries/app";
import type { DigitalReceiptShare, SmartSavingsFeature } from "@/types/domain";

const featureStatusLabels: Record<SmartSavingsFeature["status"], string> = {
  active: "مفعلة",
  available: "جاهزة",
  coming: "قريبًا",
};

const featureStatusTones: Record<SmartSavingsFeature["status"], "success" | "warning" | "muted"> = {
  active: "success",
  available: "warning",
  coming: "muted",
};

const receiptStatusLabels: Record<DigitalReceiptShare["status"], string> = {
  ready: "جاهزة للعرض",
  viewed: "تم فتحها",
  sent: "تم إرسالها",
};

const receiptStatusTones: Record<DigitalReceiptShare["status"], "success" | "default" | "warning"> = {
  ready: "warning",
  viewed: "success",
  sent: "default",
};

export default async function SmartSavingsPage() {
  const { features, receipts } = await getSmartSavingsData();
  const monthlySaving = features.reduce((sum, feature) => sum + feature.monthlySaving, 0);
  const activeFeatures = features.filter((feature) => feature.status === "active").length;
  const viewedReceipts = receipts.filter((receipt) => receipt.status === "viewed").length;

  return (
    <>
      <PageHeader
        title="التوفير الذكي"
        description="أدوات تساعد المحلات والشركات في غزة على البيع بتجهيزات أقل: مسح بالجوال، فاتورة رقمية، وإدارة من أي مكان."
        actions={
          <Button asChild>
            <Link href="/dashboard/customer-invoices/new">
              <Smartphone className="h-4 w-4" />
              تجربة داخل شاشة البيع
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="توفير شهري تقديري" value={formatCurrency(monthlySaving)} description="أجهزة وطباعة وصيانة" icon={WalletCards} tone="success" />
        <MetricCard label="ميزات مفعلة" value={formatNumber(activeFeatures)} description="جاهزة للاستخدام" icon={BadgeCheck} tone="success" />
        <MetricCard label="فواتير رقمية" value={formatNumber(receipts.length)} description="بدون طباعة ورقية" icon={ReceiptText} />
        <MetricCard label="فواتير فتحها الزبائن" value={formatNumber(viewedReceipts)} description="عن طريق رمز الاستجابة" icon={QrCode} tone="warning" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Card>
          <CardHeader>
            <CardTitle>أدوات التوفير</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {features.map((feature) => (
              <div key={feature.id} className="rounded-xl border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{feature.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                  <Badge tone={featureStatusTones[feature.status]}>{featureStatusLabels[feature.status]}</Badge>
                </div>
                <div className="mt-4 rounded-lg bg-slate-50 p-3">
                  <p className="text-sm text-muted-foreground">توفير تقديري شهري</p>
                  <p className="mt-1 text-2xl font-black text-primary">{formatCurrency(feature.monthlySaving)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              فاتورة بدون ورق
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="mx-auto grid h-44 w-44 grid-cols-5 gap-1 rounded-xl border bg-white p-3">
              {Array.from({ length: 25 }).map((_, index) => (
                <span
                  key={index}
                  className={
                    [0, 1, 3, 4, 6, 8, 11, 12, 13, 16, 18, 20, 21, 23, 24].includes(index)
                      ? "rounded-sm bg-slate-950"
                      : "rounded-sm bg-slate-100"
                  }
                />
              ))}
            </div>
            <div className="rounded-lg border bg-slate-50 p-4 text-sm">
              <p className="font-bold">كيف تعمل؟</p>
              <p className="mt-2 text-muted-foreground">
                بعد إتمام البيع يظهر رمز استجابة أمام الزبون. يفتحه من كاميرا جواله ويحصل على الفاتورة الرقمية مباشرة، بدون رول ورق وبدون صيانة طابعة.
              </p>
            </div>
            <Button className="w-full" asChild>
              <Link href="/dashboard/customer-invoices/new">فتح شاشة البيع</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <FlowCard icon={Camera} title="مسح من كاميرا الجوال" body="افتح الكاميرا من شاشة البيع، امسح المنتج، ويُضاف للفاتورة فورًا." />
        <FlowCard icon={Printer} title="تقليل الطباعة" body="الطباعة تبقى اختيارية، لكن الوضع الافتراضي يمكن أن يكون فاتورة رقمية." />
        <FlowCard icon={Cloud} title="إدارة من أي مكان" body="المبيعات والفواتير والفروع تظهر لصاحب المحل من أي جهاز متصل." />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>سجل الفواتير الرقمية</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الفاتورة</TableHead>
                <TableHead>الزبون</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>الرابط</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>آخر تحديث</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((receipt) => (
                <TableRow key={receipt.invoiceNumber}>
                  <TableCell className="font-bold">{receipt.invoiceNumber}</TableCell>
                  <TableCell>{receipt.customerName}</TableCell>
                  <TableCell>{formatCurrency(receipt.total)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2 text-primary">
                      رابط الفاتورة
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge tone={receiptStatusTones[receipt.status]}>{receiptStatusLabels[receipt.status]}</Badge>
                  </TableCell>
                  <TableCell>{new Date(receipt.sentAt).toLocaleString("ar-PS")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function FlowCard({ icon: Icon, title, body }: { icon: typeof Camera; title: string; body: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-teal-50 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <p className="mt-4 font-black">{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
