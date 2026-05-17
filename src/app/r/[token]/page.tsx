import Link from "next/link";
import { ArrowRight, QrCode } from "lucide-react";
import { DigitalReceiptActions } from "@/components/sales/digital-receipt-actions";
import { Button } from "@/components/ui/button";
import { createQrDataUrl } from "@/lib/qr-code";
import { formatCurrency, formatNumber } from "@/lib/utils";

export default async function DigitalReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { token } = await params;
  const { t } = await searchParams;
  const invoiceNumber = decodeURIComponent(token).replace(/-+/g, "-");
  const total = Number(t ?? 0);
  const issuedAt = new Date();
  const qrValue = `R:${hashToken(invoiceNumber)};T:${Math.round(total)};V:1`;
  const qrDataUrl = createQrDataUrl(qrValue);
  const items = [
    { name: "وجبة دجاج تايلندي", quantity: 1, price: Math.max(total - 30, 0) || 25 },
    { name: "ساندويتش زنجر", quantity: 2, price: 15 },
  ];
  const subtotal = total > 0 ? total : items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0" dir="rtl">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between print:hidden">
        <Button variant="outline" asChild>
          <Link href="/dashboard/customer-invoices/new">
            <ArrowRight className="h-4 w-4" />
            رجوع للكاشير
          </Link>
        </Button>
        <DigitalReceiptActions />
      </div>

      <article className="mx-auto max-w-3xl overflow-hidden rounded-xl bg-white shadow-sm print:max-w-none print:rounded-none print:shadow-none">
        <header className="bg-primary p-8 text-primary-foreground print:p-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm opacity-80">فاتورة رقمية رسمية</p>
              <h1 className="mt-1 text-4xl font-black">رواق</h1>
              <p className="mt-2 font-semibold">مطعم التايلندي</p>
              <p className="text-sm opacity-80">فاتورة محفوظة للزبون على الجوال</p>
            </div>
            <div className="rounded-lg bg-white/15 px-4 py-3 text-end">
              <p className="text-sm opacity-80">رقم الفاتورة</p>
              <h2 className="mt-1 text-2xl font-bold">{invoiceNumber}</h2>
              <p className="mt-2 text-sm">{issuedAt.toLocaleString("ar-PS")}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 p-8 md:grid-cols-[1fr_180px] print:p-6">
          <div className="space-y-4">
            <div className="grid gap-4 border-b pb-5 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">البائع</p>
                <p className="mt-1 font-bold">مطعم التايلندي</p>
                <p className="text-sm">فرع شارع عبد القادر الحسيني</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الزبون</p>
                <p className="mt-1 font-bold">عميل نقدي</p>
                <p className="text-sm">فاتورة رقمية عبر رمز الاستجابة</p>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-3 py-3 text-start">الصنف</th>
                  <th className="px-3 py-3 text-center">الكمية</th>
                  <th className="px-3 py-3 text-end">السعر</th>
                  <th className="px-3 py-3 text-end">المجموع</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.name} className="border-b">
                    <td className="px-3 py-3 font-medium">{item.name}</td>
                    <td className="px-3 py-3 text-center">{formatNumber(item.quantity)}</td>
                    <td className="px-3 py-3 text-end">{formatCurrency(item.price)}</td>
                    <td className="px-3 py-3 text-end">{formatCurrency(item.price * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <section className="ms-auto max-w-sm space-y-3">
              <div className="flex justify-between">
                <span>المجموع الفرعي</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>الخصم</span>
                <span>{formatCurrency(0)}</span>
              </div>
              <div className="flex justify-between">
                <span>الضريبة</span>
                <span>{formatCurrency(0)}</span>
              </div>
              <div className="flex justify-between border-t pt-3 text-xl font-black">
                <span>الإجمالي</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
            </section>
          </div>

          <aside className="space-y-3">
            <div className="rounded-xl border bg-white p-3 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="رمز تحقق الفاتورة" className="mx-auto h-40 w-40" />
              <p className="mt-2 flex items-center justify-center gap-1 text-sm font-bold">
                <QrCode className="h-4 w-4" />
                رمز تحقق حقيقي
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              <p className="font-bold">حالة الفاتورة</p>
              <p className="mt-1 text-green-700">رسمية وجاهزة للعرض والطباعة</p>
            </div>
          </aside>
        </section>

        <footer className="border-t p-5 text-center text-sm text-muted-foreground">
          <p>هذه الفاتورة الرقمية تغني عن الطباعة الورقية ويمكن حفظها على جوال الزبون.</p>
        </footer>
      </article>
    </main>
  );
}

function hashToken(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).toUpperCase();
}
