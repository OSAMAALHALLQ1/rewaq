import { notFound } from "next/navigation";
import { QrCode } from "lucide-react";
import { DigitalReceiptActions } from "@/components/sales/digital-receipt-actions";
import { createQrDataUrl } from "@/lib/qr-code";
import { formatCurrency, formatNumber, getBaseUrl } from "@/lib/utils";
import { getCustomerInvoice, getOrganizationContext } from "@/server/queries/app";

const paymentLabels = {
  cash: "نقدي",
  card: "بطاقة",
  bank_transfer: "حوالة",
  delivery_app: "تطبيق توصيل",
} as const;

const statusLabels = {
  draft: "مسودة",
  issued: "صادرة",
  paid: "مدفوعة",
  void: "ملغاة",
} as const;

export default async function CustomerInvoiceMobilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [invoice, context] = await Promise.all([getCustomerInvoice(id), getOrganizationContext()]);
  if (!invoice) notFound();

  const receiptUrl = `${getBaseUrl()}/r/customer-invoices/${invoice.id}`;
  const verifyQr = createQrDataUrl(`R:${invoice.id};T:${Math.round(invoice.total)};V:1`);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0" dir="rtl">
      <div className="mx-auto mb-4 flex max-w-3xl justify-end print:hidden">
        <DigitalReceiptActions />
      </div>

      <article className="mx-auto max-w-3xl overflow-hidden rounded-xl bg-white shadow-sm print:rounded-none print:shadow-none">
        <header className="bg-primary p-6 text-primary-foreground">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm opacity-80">فاتورة عميل رقمية</p>
              <h1 className="mt-1 text-3xl font-black">رواق</h1>
              <p className="mt-2 font-semibold">{context.organization.name}</p>
              <p className="text-sm opacity-80">{invoice.branchName}</p>
            </div>
            <div className="rounded-lg bg-white/15 px-4 py-3 text-end">
              <p className="text-sm opacity-80">رقم الفاتورة</p>
              <h2 className="mt-1 text-xl font-bold">{invoice.invoiceNumber}</h2>
              <p className="mt-2 text-sm">{new Date(invoice.issuedAt).toLocaleString("ar-PS")}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-5 p-6 md:grid-cols-[1fr_170px]">
          <div className="space-y-5">
            <div className="grid gap-4 border-b pb-5 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">الزبون</p>
                <p className="mt-1 font-bold">{invoice.customerName}</p>
                <p className="text-sm">{invoice.customerPhone ?? "بدون هاتف"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الدفع والحالة</p>
                <p className="mt-1 font-bold">{paymentLabels[invoice.paymentMethod]}</p>
                <p className="text-sm">{statusLabels[invoice.status]}</p>
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
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-3 py-3 font-medium">{item.name}</td>
                    <td className="px-3 py-3 text-center">{formatNumber(item.quantity)}</td>
                    <td className="px-3 py-3 text-end">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-3 py-3 text-end">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <section className="ms-auto max-w-sm space-y-3">
              <div className="flex justify-between">
                <span>المجموع الفرعي</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>الخصم</span>
                <span>{formatCurrency(invoice.discount)}</span>
              </div>
              <div className="flex justify-between">
                <span>الضريبة</span>
                <span>{formatCurrency(invoice.taxTotal)}</span>
              </div>
              <div className="flex justify-between border-t pt-3 text-xl font-black">
                <span>الإجمالي</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
            </section>
          </div>

          <aside className="space-y-3">
            <div className="rounded-xl border bg-white p-3 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={verifyQr} alt="رمز تحقق الفاتورة" className="mx-auto h-36 w-36" />
              <p className="mt-2 flex items-center justify-center gap-1 text-sm font-bold">
                <QrCode className="h-4 w-4" />
                رمز تحقق
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-bold">رابط الفاتورة</p>
              <p className="mt-1 break-all text-muted-foreground">{receiptUrl}</p>
            </div>
          </aside>
        </section>

        <footer className="border-t p-5 text-center text-sm text-muted-foreground">
          <p>{invoice.notes ?? "شكرًا لزيارتكم"}</p>
          <p className="mt-2">هذه الفاتورة تظهر مباشرة عند مسح الرمز من الفاتورة المطبوعة.</p>
        </footer>
      </article>
    </main>
  );
}
