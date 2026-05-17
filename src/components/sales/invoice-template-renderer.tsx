import { createQrDataUrl } from "@/lib/qr-code";
import { formatCurrency, formatNumber } from "@/lib/utils";

export type InvoiceTemplateId = "thermal" | "mall" | "compact" | "formal";
export type InvoiceQrMode = "invoice" | "facebook" | "instagram" | "custom" | "none";

export type InvoiceTemplateOptions = {
  template: InvoiceTemplateId;
  showLogo: boolean;
  logoText: string;
  logoImageUrl?: string;
  qrMode: InvoiceQrMode;
  facebookUrl: string;
  instagramUrl: string;
  customQrUrl: string;
  customQrLabel: string;
  accentColor: string;
  paperWidth: number;
  fontScale: number;
};

export type PrintableInvoiceItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  discount?: number;
  unit?: string;
};

export type PrintableInvoiceData = {
  documentType: string;
  invoiceNumber: string;
  organizationName: string;
  branchName: string;
  branchAddress?: string;
  customerName: string;
  customerPhone?: string;
  customerTaxNumber?: string;
  paymentLabel: string;
  issuedAt: string;
  receiptUrl: string;
  receiptQr: string;
  items: PrintableInvoiceItem[];
  subtotal: number;
  itemDiscountTotal: number;
  invoiceDiscount: number;
  serviceFee: number;
  deliveryFee: number;
  taxTotal: number;
  total: number;
  notes: string;
};

export const invoiceTemplates: Array<{ id: InvoiceTemplateId; name: string; description: string }> = [
  { id: "mall", name: "قالب مول", description: "شكل حراري قريب من فواتير المحلات مع شعار كبير ورمز في الأسفل." },
  { id: "thermal", name: "حراري كلاسيكي", description: "فاتورة مطاعم سريعة وواضحة للطابعات الحرارية." },
  { id: "compact", name: "مختصر", description: "أقل مساحة ممكنة مع التفاصيل الأساسية." },
  { id: "formal", name: "رسمي", description: "مناسب للفاتورة الضريبية والتسليم للزبائن والشركات." },
];

export const defaultInvoiceTemplateOptions: InvoiceTemplateOptions = {
  template: "mall",
  showLogo: true,
  logoText: "رواق",
  logoImageUrl: "",
  qrMode: "invoice",
  facebookUrl: "https://facebook.com/rewaq",
  instagramUrl: "https://instagram.com/rewaq",
  customQrUrl: "https://rewaq.app",
  customQrLabel: "امسح الرمز لفتح الرابط",
  accentColor: "#111827",
  paperWidth: 80,
  fontScale: 100,
};

function ReceiptLogo({ options, organizationName }: { options: InvoiceTemplateOptions; organizationName: string }) {
  if (!options.showLogo) return null;

  return (
    <div className="mb-2 flex items-center justify-center gap-2">
      {options.logoImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={options.logoImageUrl} alt="شعار الفاتورة" className="h-10 w-10 rounded-sm object-contain" />
      ) : (
        <div
          className="grid h-9 w-9 place-items-center rounded-sm text-lg font-black text-white"
          style={{ backgroundColor: options.accentColor }}
        >
          {options.logoText.trim().slice(0, 1) || organizationName.slice(0, 1)}
        </div>
      )}
      <div className="text-right leading-tight">
        <p className="text-xl font-black">{options.logoText.trim() || organizationName}</p>
        <p className="text-[10px] text-slate-500">{organizationName}</p>
      </div>
    </div>
  );
}

function resolveQr(options: InvoiceTemplateOptions, data: PrintableInvoiceData) {
  if (options.qrMode === "none") return null;

  const targets: Record<Exclude<InvoiceQrMode, "none">, { url: string; label: string }> = {
    invoice: { url: data.receiptUrl, label: "امسح الرمز لفتح الفاتورة على الجوال" },
    facebook: { url: options.facebookUrl, label: "امسح الرمز لفتح صفحة فيسبوك" },
    instagram: { url: options.instagramUrl, label: "امسح الرمز لفتح حساب إنستغرام" },
    custom: { url: options.customQrUrl, label: options.customQrLabel || "امسح الرمز لفتح الرابط" },
  };
  const target = targets[options.qrMode];

  try {
    return {
      image: options.qrMode === "invoice" ? data.receiptQr : createQrDataUrl(target.url),
      label: target.label,
    };
  } catch {
    return {
      image: data.receiptQr,
      label: "تعذر إنشاء الرمز للرابط المخصص، تم عرض رمز الفاتورة",
    };
  }
}

function ReceiptQr({
  data,
  options,
  sizeClass = "h-24 w-24",
}: {
  data: PrintableInvoiceData;
  options: InvoiceTemplateOptions;
  sizeClass?: string;
}) {
  const qr = resolveQr(options, data);
  if (!qr) return null;

  return (
    <div className="text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr.image} alt="رمز مخصص للفاتورة" className={`mx-auto border bg-white p-1 ${sizeClass}`} />
      <p className="mt-1 text-[10px]">{qr.label}</p>
    </div>
  );
}

function TotalsList({ data, compact = false }: { data: PrintableInvoiceData; compact?: boolean }) {
  const rows = [
    ["المجموع", data.subtotal],
    ["خصومات الأصناف", data.itemDiscountTotal],
    ["خصم الفاتورة", data.invoiceDiscount],
    ["الخدمة والتوصيل", data.serviceFee + data.deliveryFee],
    ["الضريبة", data.taxTotal],
  ];

  return (
    <div className={compact ? "space-y-0.5" : "space-y-1"}>
      {rows.map(([label, value]) => (
        <div key={label as string} className="flex justify-between gap-3">
          <span>{label}</span>
          <span>{formatCurrency(value as number)}</span>
        </div>
      ))}
      <div className="mt-2 flex justify-between border-t border-dashed pt-2 text-base font-black">
        <span>الإجمالي</span>
        <span>{formatCurrency(data.total)}</span>
      </div>
    </div>
  );
}

function MallReceipt({ data, options }: { data: PrintableInvoiceData; options: InvoiceTemplateOptions }) {
  return (
    <section>
      <header className="border-b border-dashed pb-2 text-center">
        <ReceiptLogo options={options} organizationName={data.organizationName} />
        <p className="font-bold">{data.documentType}</p>
        <div className="mt-1 grid grid-cols-3 text-[10px]">
          <span>{new Date(data.issuedAt).toLocaleDateString("ar-PS")}</span>
          <span>{new Date(data.issuedAt).toLocaleTimeString("ar-PS", { hour: "2-digit", minute: "2-digit" })}</span>
          <span>{data.invoiceNumber}</span>
        </div>
        <p className="mt-1 text-[10px] text-slate-600">{data.branchName}</p>
      </header>

      <table className="mt-2 w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-y border-slate-400">
            <th className="py-1 text-right">رقم</th>
            <th className="py-1 text-right">الصنف</th>
            <th className="py-1 text-center">كمية</th>
            <th className="py-1 text-left">سعر</th>
            <th className="py-1 text-left">مجموع</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, index) => (
            <tr key={item.id} className="border-b border-slate-200">
              <td className="py-1">{formatNumber(index + 1)}</td>
              <td className="py-1 font-semibold">{item.name}</td>
              <td className="py-1 text-center">{formatNumber(item.quantity)}</td>
              <td className="py-1 text-left">{formatCurrency(item.unitPrice)}</td>
              <td className="py-1 text-left">{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 border-b border-dashed pb-2">
        <TotalsList data={data} compact />
      </div>

      <footer className="pt-3 text-center">
        <p className="font-bold">شكرًا لزيارتكم</p>
        <p className="text-[10px] text-slate-600">{data.notes}</p>
        <div className="mt-2">
          <ReceiptQr data={data} options={options} />
        </div>
      </footer>
    </section>
  );
}

function ThermalReceipt({ data, options }: { data: PrintableInvoiceData; options: InvoiceTemplateOptions }) {
  return (
    <section>
      <header className="border-b border-dashed pb-3 text-center">
        <ReceiptLogo options={options} organizationName={data.organizationName} />
        <p>{data.branchName}</p>
        <p className="mt-2 font-bold">{data.documentType}</p>
        <p>{data.invoiceNumber}</p>
        <p>{new Date(data.issuedAt).toLocaleString("ar-PS")}</p>
      </header>
      <div className="grid gap-1 border-b border-dashed py-3">
        <div className="flex justify-between">
          <span>العميل</span>
          <span>{data.customerName || "عميل نقدي"}</span>
        </div>
        <div className="flex justify-between">
          <span>الدفع</span>
          <span>{data.paymentLabel}</span>
        </div>
      </div>
      <div className="border-b border-dashed py-2">
        {data.items.map((item) => (
          <div key={item.id} className="py-1">
            <div className="flex justify-between gap-2">
              <span className="font-bold">{item.name}</span>
              <span>{formatCurrency(item.total)}</span>
            </div>
            <p className="text-[11px] text-slate-600">
              {formatNumber(item.quantity)} × {formatCurrency(item.unitPrice)}
              {item.discount ? ` · خصم ${formatCurrency(item.discount)}` : ""}
            </p>
          </div>
        ))}
      </div>
      <div className="border-b border-dashed py-3">
        <TotalsList data={data} />
      </div>
      <footer className="pt-3 text-center">
        <ReceiptQr data={data} options={options} />
        <p>{data.notes}</p>
      </footer>
    </section>
  );
}

function CompactReceipt({ data, options }: { data: PrintableInvoiceData; options: InvoiceTemplateOptions }) {
  return (
    <section>
      <header className="flex items-start justify-between border-b border-dashed pb-2">
        <div>
          <p className="font-black">{options.showLogo ? options.logoText || data.organizationName : data.organizationName}</p>
          <p className="text-[10px] text-slate-600">{data.branchName}</p>
        </div>
        <div className="text-left">
          <p className="font-bold">{data.documentType}</p>
          <p className="text-[10px]">{data.invoiceNumber}</p>
        </div>
      </header>
      <div className="py-2">
        {data.items.map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_38px_64px] gap-2 border-b py-1 text-[11px]">
            <span className="font-semibold">{item.name}</span>
            <span className="text-center">{formatNumber(item.quantity)}</span>
            <span className="text-left">{formatCurrency(item.total)}</span>
          </div>
        ))}
      </div>
      <TotalsList data={data} compact />
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-dashed pt-2">
        <ReceiptQr data={data} options={options} sizeClass="h-16 w-16" />
        <p className="text-center text-[10px] text-slate-600">{data.notes}</p>
      </div>
    </section>
  );
}

function FormalReceipt({ data, options }: { data: PrintableInvoiceData; options: InvoiceTemplateOptions }) {
  return (
    <section className="space-y-4">
      <header className="rounded-lg p-4 text-white" style={{ backgroundColor: options.accentColor }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm opacity-80">{data.documentType}</p>
            <h1 className="text-3xl font-black">{options.showLogo ? options.logoText || data.organizationName : data.organizationName}</h1>
            <p className="mt-1">{data.branchName}</p>
          </div>
          <div className="text-left">
            <p className="text-sm opacity-80">رقم الفاتورة</p>
            <p className="text-xl font-bold">{data.invoiceNumber}</p>
            <p className="mt-1 text-sm">{new Date(data.issuedAt).toLocaleString("ar-PS")}</p>
          </div>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
        <div>
          <p className="text-slate-500">من</p>
          <p className="font-bold">{data.organizationName}</p>
          <p>{data.branchAddress}</p>
        </div>
        <div>
          <p className="text-slate-500">إلى</p>
          <p className="font-bold">{data.customerName || "عميل نقدي"}</p>
          <p>{data.customerPhone || "بدون هاتف"}</p>
          <p>{data.customerTaxNumber ? `رقم ضريبي: ${data.customerTaxNumber}` : "بدون رقم ضريبي"}</p>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50">
            <th className="px-2 py-2 text-right">الصنف</th>
            <th className="px-2 py-2 text-center">الكمية</th>
            <th className="px-2 py-2 text-left">السعر</th>
            <th className="px-2 py-2 text-left">المجموع</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="px-2 py-2 font-semibold">{item.name}</td>
              <td className="px-2 py-2 text-center">{formatNumber(item.quantity)}</td>
              <td className="px-2 py-2 text-left">{formatCurrency(item.unitPrice)}</td>
              <td className="px-2 py-2 text-left">{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid grid-cols-[1fr_240px] gap-4">
        <div className="rounded-lg border border-dashed p-3 text-center">
          <ReceiptQr data={data} options={options} />
        </div>
        <TotalsList data={data} />
      </div>
      <footer className="border-t pt-3 text-center text-sm text-slate-600">{data.notes}</footer>
    </section>
  );
}

export function InvoiceTemplateRenderer({
  data,
  options,
  className = "",
}: {
  data: PrintableInvoiceData;
  options: InvoiceTemplateOptions;
  className?: string;
}) {
  const width = options.template === "formal" ? Math.max(options.paperWidth, 148) : options.paperWidth;

  return (
    <article
      className={`mx-auto bg-white text-slate-950 shadow-sm print:shadow-none ${className}`}
      dir="rtl"
      style={{
        width: `${width}mm`,
        maxWidth: "100%",
        fontSize: `${options.fontScale}%`,
        padding: options.template === "formal" ? "18px" : "14px",
      }}
    >
      {options.template === "mall" ? <MallReceipt data={data} options={options} /> : null}
      {options.template === "thermal" ? <ThermalReceipt data={data} options={options} /> : null}
      {options.template === "compact" ? <CompactReceipt data={data} options={options} /> : null}
      {options.template === "formal" ? <FormalReceipt data={data} options={options} /> : null}
    </article>
  );
}
