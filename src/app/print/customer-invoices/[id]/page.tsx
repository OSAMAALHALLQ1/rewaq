import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  defaultInvoiceTemplateOptions,
  InvoiceTemplateRenderer,
  invoiceTemplates,
  type InvoiceQrMode,
  type InvoiceTemplateId,
  type InvoiceTemplateOptions,
} from "@/components/sales/invoice-template-renderer";
import { createQrDataUrl } from "@/lib/qr-code";
import { getBaseUrl } from "@/lib/utils";
import { getCustomerInvoice, getOrganizationContext } from "@/server/queries/app";
import type { CustomerInvoice } from "@/types/domain";

const paymentLabels: Record<CustomerInvoice["paymentMethod"], string> = {
  cash: "نقدي",
  card: "بطاقة",
  bank_transfer: "حوالة",
  delivery_app: "تطبيق توصيل",
  receivable: "ذمم عملاء",
  wallet: "المحفظة الإلكترونية",
  gift_card: "بطاقة هدايا",
};

const statusLabels: Record<CustomerInvoice["status"], string> = {
  draft: "مسودة",
  issued: "صادرة",
  paid: "مدفوعة",
  void: "ملغاة",
  refunded: "مرجعة",
  partially_refunded: "مرجعة جزئياً",
};

function readValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildTemplateOptions(searchParams: Record<string, string | string[] | undefined>): InvoiceTemplateOptions {
  const template = readValue(searchParams.template);
  const logo = readValue(searchParams.logo);
  const color = readValue(searchParams.color);
  const qr = readValue(searchParams.qr);
  const facebook = readValue(searchParams.facebook);
  const instagram = readValue(searchParams.instagram);
  const custom = readValue(searchParams.custom);
  const qrLabel = readValue(searchParams.qrLabel);
  const width = Number(readValue(searchParams.width));
  const font = Number(readValue(searchParams.font));
  const qrModes: InvoiceQrMode[] = ["invoice", "facebook", "instagram", "custom", "none"];

  return {
    ...defaultInvoiceTemplateOptions,
    template: invoiceTemplates.some((item) => item.id === template) ? (template as InvoiceTemplateId) : defaultInvoiceTemplateOptions.template,
    showLogo: logo !== "hide",
    qrMode: qrModes.includes(qr as InvoiceQrMode) ? (qr as InvoiceQrMode) : defaultInvoiceTemplateOptions.qrMode,
    facebookUrl: facebook ?? defaultInvoiceTemplateOptions.facebookUrl,
    instagramUrl: instagram ?? defaultInvoiceTemplateOptions.instagramUrl,
    customQrUrl: custom ?? defaultInvoiceTemplateOptions.customQrUrl,
    customQrLabel: qrLabel ?? defaultInvoiceTemplateOptions.customQrLabel,
    accentColor: color?.startsWith("#") ? color : defaultInvoiceTemplateOptions.accentColor,
    paperWidth: Number.isFinite(width) && width >= 58 ? width : defaultInvoiceTemplateOptions.paperWidth,
    fontScale: Number.isFinite(font) && font >= 80 ? font : defaultInvoiceTemplateOptions.fontScale,
  };
}

function templateHref(invoiceId: string, options: InvoiceTemplateOptions, patch: Partial<InvoiceTemplateOptions>) {
  const next = { ...options, ...patch };
  const params = new URLSearchParams({
    template: next.template,
    logo: next.showLogo ? "show" : "hide",
    qr: next.qrMode,
    facebook: next.facebookUrl,
    instagram: next.instagramUrl,
    custom: next.customQrUrl,
    qrLabel: next.customQrLabel,
    color: next.accentColor,
    width: String(next.paperWidth),
    font: String(next.fontScale),
  });

  return `/print/customer-invoices/${invoiceId}?${params.toString()}`;
}

export default async function PrintCustomerInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const [invoice, context] = await Promise.all([getCustomerInvoice(id), getOrganizationContext()]);
  if (!invoice) notFound();
  
  const receiptUrl = `${getBaseUrl()}/r/customer-invoices/${invoice.id}/image`;
  const receiptQr = createQrDataUrl(receiptUrl);
  const options = buildTemplateOptions(query);
  const printableInvoice = {
    documentType: "فاتورة بيع",
    invoiceNumber: invoice.invoiceNumber,
    organizationName: context.organization.name,
    branchName: invoice.branchName,
    branchAddress: context.branches.find((branch) => branch.id === invoice.branchId)?.address ?? "",
    customerName: invoice.customerName,
    customerPhone: invoice.customerPhone,
    customerTaxNumber: invoice.customerTaxNumber,
    paymentLabel: paymentLabels[invoice.paymentMethod],
    issuedAt: invoice.issuedAt,
    receiptUrl,
    receiptQr,
    items: invoice.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
    subtotal: invoice.subtotal,
    itemDiscountTotal: 0,
    invoiceDiscount: invoice.discount,
    serviceFee: 0,
    deliveryFee: 0,
    taxTotal: invoice.taxTotal,
    total: invoice.total,
    notes: invoice.notes ?? "شكرًا لزيارتكم",
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-3xl flex-col gap-3 print:hidden">
        <div className="flex items-center justify-between gap-3">
        <Button variant="outline" asChild>
          <Link href="/dashboard/customer-invoices">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Link>
        </Button>
        <div className="rounded-lg border bg-white px-4 py-2 text-sm text-muted-foreground">
          <Printer className="me-2 inline h-4 w-4" />
          للطباعة استخدم اختصار الطباعة من المتصفح
        </div>
        </div>
        <div className="rounded-xl border bg-white p-3">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold">قوالب جاهزة:</span>
            {invoiceTemplates.map((template) => (
              <Button key={template.id} size="sm" variant={options.template === template.id ? "default" : "outline"} asChild>
                <Link href={templateHref(invoice.id, options, { template: template.id })}>{template.name}</Link>
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold">الشعار:</span>
            <Button size="sm" variant={options.showLogo ? "default" : "outline"} asChild>
              <Link href={templateHref(invoice.id, options, { showLogo: true })}>إظهار</Link>
            </Button>
            <Button size="sm" variant={!options.showLogo ? "default" : "outline"} asChild>
              <Link href={templateHref(invoice.id, options, { showLogo: false })}>إخفاء</Link>
            </Button>
            <span className="ms-3 text-muted-foreground">الحالة: {statusLabels[invoice.status]}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold">رمز الفاتورة:</span>
            {[
              ["invoice", "الفاتورة"],
              ["facebook", "فيسبوك"],
              ["instagram", "إنستغرام"],
              ["custom", "رابط مخصص"],
              ["none", "بدون رمز"],
            ].map(([mode, label]) => (
              <Button key={mode} size="sm" variant={options.qrMode === mode ? "default" : "outline"} asChild>
                <Link href={templateHref(invoice.id, options, { qrMode: mode as InvoiceQrMode })}>{label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </div>

      <InvoiceTemplateRenderer data={printableInvoice} options={options} className="rounded-xl print:rounded-none" />
    </div>
  );
}
