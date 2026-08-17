import Link from "next/link";
import { BarChart3, Camera, ExternalLink, FileText, QrCode, ReceiptText, Smartphone } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { getSmartSavingsData, type SmartSavingsReceipt } from "@/server/queries/financial-services/smart-savings";

const receiptStatusLabels: Record<SmartSavingsReceipt["status"], string> = {
  ready: "جاهزة للعرض",
  viewed: "تم فتحها",
  sent: "تم إرسالها",
};

const receiptStatusTones: Record<SmartSavingsReceipt["status"], "success" | "default" | "warning"> = {
  ready: "warning",
  viewed: "success",
  sent: "default",
};

export default async function SmartSavingsPage() {
  const data = await getSmartSavingsData();

  return (
    <>
      <PageHeader
        title="التوفير الذكي"
        description="متابعة فعلية لاستخدام فواتير البيع والإيصالات الرقمية، بدون تقديرات توفير أو خدمات مراسلة غير مرتبطة بمزود."
        actions={
          <Button asChild>
            <Link href="/d/pos">
              <Smartphone className="h-4 w-4" />
              فتح نقطة البيع
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="فواتير البيع" value={formatNumber(data.salesInvoiceCount)} description="صادرة أو مدفوعة ضمن نطاقك" icon={FileText} />
        <MetricCard label="إيصالات رقمية" value={formatNumber(data.receiptCount)} description={`${formatPercent(data.shareCoveragePercent)} من فواتير البيع`} icon={ReceiptText} />
        <MetricCard label="إيصالات تم فتحها" value={formatNumber(data.viewedReceiptCount)} description="مسجلة بحالة تم فتحها" icon={QrCode} tone="success" />
        <MetricCard label="معدل فتح الإيصالات" value={formatPercent(data.viewRatePercent)} description="من الإيصالات الرقمية المسجلة" icon={BarChart3} tone="warning" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <FlowCard icon={Camera} title="المسح داخل نقطة البيع" body="استخدم قارئ الباركود أو كاميرا الجهاز من شاشة نقطة البيع لإضافة الأصناف الموجودة في الكتالوج." href="/d/pos" action="فتح نقطة البيع" />
        <FlowCard icon={FileText} title="فواتير العملاء" body="راجع الفواتير الصادرة والمدفوعة الفعلية وتفاصيل كل عملية بيع." href="/dashboard/customer-invoices" action="عرض الفواتير" />
        <FlowCard icon={QrCode} title="الإيصال الرقمي" body="افتح رابط أي إيصال مسجل من الجدول أدناه. لا يتم ادعاء إرسال SMS أو واتساب بدون مزود." href="#digital-receipts" action="عرض السجل" />
      </div>

      <Card className="mt-4" id="digital-receipts">
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
              {data.receipts.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell className="font-bold">{receipt.invoiceNumber}</TableCell>
                  <TableCell>{receipt.customerName}</TableCell>
                  <TableCell>{formatCurrency(receipt.total)}</TableCell>
                  <TableCell>
                    <Link className="inline-flex items-center gap-2 text-primary hover:underline" href={receipt.receiptUrl} target="_blank">
                      فتح الإيصال
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge tone={receiptStatusTones[receipt.status]}>{receiptStatusLabels[receipt.status]}</Badge>
                  </TableCell>
                  <TableCell>{new Date(receipt.updatedAt).toLocaleString("ar-PS")}</TableCell>
                </TableRow>
              ))}
              {data.receipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    لا توجد إيصالات رقمية مسجلة ضمن نطاقك حتى الآن.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function FlowCard({ icon: Icon, title, body, href, action }: { icon: typeof Camera; title: string; body: string; href: string; action: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-teal-50 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <p className="mt-4 font-black">{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <Button className="mt-4" size="sm" variant="outline" asChild>
          <Link href={href}>{action}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
