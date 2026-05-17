import type { CustomerInvoice, CustomerInvoiceItem } from "@/types/domain";

type InvoiceImageInput = {
  invoiceNumber: string;
  organizationName: string;
  branchName: string;
  customerName: string;
  issuedAt: string;
  total: number;
  subtotal?: number;
  discount?: number;
  taxTotal?: number;
  items: CustomerInvoiceItem[];
};

export function createInvoiceSvgImage(input: InvoiceImageInput) {
  const width = 900;
  const rowHeight = 58;
  const itemsHeight = Math.max(input.items.length, 2) * rowHeight;
  const height = 520 + itemsHeight;
  const subtotal = input.subtotal ?? input.total;
  const discount = input.discount ?? 0;
  const taxTotal = input.taxTotal ?? 0;
  const rows = input.items.length
    ? input.items
    : [{ id: "item", name: "فاتورة بيع", quantity: 1, unitPrice: input.total, total: input.total }];

  const itemsMarkup = rows
    .map((item, index) => {
      const y = 300 + index * rowHeight;
      return `
        <g>
          <rect x="60" y="${y}" width="780" height="${rowHeight}" fill="${index % 2 === 0 ? "#ffffff" : "#f8fafc"}" />
          <text x="805" y="${y + 36}" class="cell bold">${escapeXml(item.name)}</text>
          <text x="500" y="${y + 36}" class="cell center">${formatArabicNumber(item.quantity)}</text>
          <text x="325" y="${y + 36}" class="cell center">${formatMoney(item.unitPrice)}</text>
          <text x="95" y="${y + 36}" class="cell total">${formatMoney(item.total)}</text>
        </g>
      `;
    })
    .join("");

  const totalsY = 325 + itemsHeight;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" direction="rtl">
  <style>
    .bg { fill: #f8fafc; }
    .card { fill: #ffffff; stroke: #e2e8f0; stroke-width: 2; }
    .primary { fill: #0f766e; }
    .muted { fill: #64748b; font-size: 24px; font-family: Arial, sans-serif; }
    .title { fill: #ffffff; font-size: 46px; font-weight: 800; font-family: Arial, sans-serif; }
    .subtitle { fill: #ccfbf1; font-size: 24px; font-family: Arial, sans-serif; }
    .label { fill: #64748b; font-size: 22px; font-family: Arial, sans-serif; }
    .value { fill: #0f172a; font-size: 26px; font-weight: 700; font-family: Arial, sans-serif; }
    .head { fill: #0f172a; font-size: 22px; font-weight: 800; font-family: Arial, sans-serif; }
    .cell { fill: #0f172a; font-size: 22px; font-family: Arial, sans-serif; text-anchor: end; }
    .bold { font-weight: 700; }
    .center { text-anchor: middle; }
    .total { text-anchor: start; font-weight: 800; }
    .big { fill: #0f766e; font-size: 42px; font-weight: 900; font-family: Arial, sans-serif; }
  </style>
  <rect width="100%" height="100%" class="bg"/>
  <rect x="40" y="40" width="820" height="${height - 80}" rx="26" class="card"/>
  <rect x="40" y="40" width="820" height="150" rx="26" class="primary"/>
  <text x="820" y="105" class="title">${escapeXml(input.organizationName)}</text>
  <text x="820" y="148" class="subtitle">فاتورة بيع رقمية</text>
  <text x="80" y="105" class="subtitle">${escapeXml(input.invoiceNumber)}</text>
  <text x="80" y="148" class="subtitle">${escapeXml(formatDate(input.issuedAt))}</text>

  <text x="820" y="235" class="label">الفرع</text>
  <text x="820" y="270" class="value">${escapeXml(input.branchName)}</text>
  <text x="400" y="235" class="label">العميل</text>
  <text x="400" y="270" class="value">${escapeXml(input.customerName || "عميل نقدي")}</text>

  <rect x="60" y="300" width="780" height="46" fill="#f1f5f9"/>
  <text x="805" y="330" class="head">الصنف</text>
  <text x="500" y="330" class="head center">الكمية</text>
  <text x="325" y="330" class="head center">السعر</text>
  <text x="95" y="330" class="head total">المجموع</text>
  ${itemsMarkup}

  <rect x="60" y="${totalsY}" width="780" height="170" rx="18" fill="#f8fafc" stroke="#e2e8f0"/>
  <text x="805" y="${totalsY + 40}" class="label">المجموع الفرعي</text>
  <text x="95" y="${totalsY + 40}" class="value" text-anchor="start">${formatMoney(subtotal)}</text>
  <text x="805" y="${totalsY + 78}" class="label">الخصم</text>
  <text x="95" y="${totalsY + 78}" class="value" text-anchor="start">${formatMoney(discount)}</text>
  <text x="805" y="${totalsY + 116}" class="label">الضريبة</text>
  <text x="95" y="${totalsY + 116}" class="value" text-anchor="start">${formatMoney(taxTotal)}</text>
  <text x="805" y="${totalsY + 158}" class="big">الإجمالي</text>
  <text x="95" y="${totalsY + 158}" class="big" text-anchor="start">${formatMoney(input.total)}</text>

  <text x="450" y="${height - 70}" class="muted" text-anchor="middle">تم إصدار هذه الفاتورة بواسطة رواق</text>
</svg>`;
}

export function createCustomerInvoiceSvgImage(invoice: CustomerInvoice, organizationName: string) {
  return createInvoiceSvgImage({
    invoiceNumber: invoice.invoiceNumber,
    organizationName,
    branchName: invoice.branchName,
    customerName: invoice.customerName,
    issuedAt: invoice.issuedAt,
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    taxTotal: invoice.taxTotal,
    total: invoice.total,
    items: invoice.items,
  });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ar-PS", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatArabicNumber(value: number) {
  return new Intl.NumberFormat("ar-PS").format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ar-PS");
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
