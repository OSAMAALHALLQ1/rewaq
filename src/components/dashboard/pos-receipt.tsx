import * as React from "react";

export type ReceiptDesign = {
  template: "classic" | "modern" | "restaurant" | "minimal" | "grid" | "creative" | "card" | "b2b";
  fontSize: number;
  font: "mono" | "sans";
  logoText: string;
  accentColor: string;
  headerAlign: "center" | "right";
  separator: "dashed" | "solid" | "double";
  showLogo: boolean;
  showStoreName: boolean;
  showStoreAddress: boolean;
  showTaxNumber: boolean;
  showCashier: boolean;
  showCustomer: boolean;
  showOrderType: boolean;
  showTable: boolean;
  showTime: boolean;
  showItemNotes: boolean;
  showDiscounts: boolean;
  showPayments: boolean;
  showChange: boolean;
  showQR: boolean;
  showBarcode: boolean;
  boldTotal: boolean;
  extraFooter: string;
  headerText: string;
  footerText: string;
};

export const DEFAULT_DESIGN: ReceiptDesign = {
  template: "classic",
  fontSize: 12,
  font: "mono",
  logoText: "",
  accentColor: "#1e40af",
  headerAlign: "center",
  separator: "dashed",
  showLogo: false,
  showStoreName: true,
  showStoreAddress: true,
  showTaxNumber: true,
  showCashier: true,
  showCustomer: true,
  showOrderType: true,
  showTable: true,
  showTime: true,
  showItemNotes: true,
  showDiscounts: true,
  showPayments: true,
  showChange: true,
  showQR: false,
  showBarcode: false,
  boldTotal: true,
  extraFooter: "",
  headerText: "",
  footerText: "",
};

const SEPARATOR_STYLE: Record<ReceiptDesign["separator"], string> = {
  dashed: "1px dashed #000",
  solid: "1px solid #000",
  double: "3px double #000",
};

const sepStyle = (color: string, sep: ReceiptDesign["separator"]) => ({
  borderTop: `${sep === "dashed" ? "1px dashed" : sep === "double" ? "3px double" : "1px solid"} ${color}`,
});

const PAY_LABEL: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  bank_transfer: "تحويل بنكي",
  wallet: "محفظة",
  receivable: "آجل / دين",
  delivery_app: "تطبيق توصيل",
  split: "دفع مجزأ",
};

export type ReceiptItemData = {
  name: string;
  qty: number;
  price: number;
  selectedModifiers?: Array<{ name: string; priceDelta: number }>;
  discount?: number;
  note?: string;
};

export type ReceiptData = {
  invoiceNumber?: string;
  date?: string;
  cashier?: string;
  customer?: string;
  orderType?: string;
  table?: string;
  items: ReceiptItemData[];
  subtotal: number;
  discount?: number;
  tax?: number;
  serviceFee?: number;
  deliveryFee?: number;
  total: number;
  method?: string;
  paymentLines?: Array<{ method: string; amount: number }>;
  cashReceived?: number | null;
  change?: number | null;
};

export const SAMPLE_RECEIPT: ReceiptData = {
  invoiceNumber: "POS-000123",
  date: "2026-07-07 14:30",
  cashier: "كاشير 1",
  customer: "عميل سريع",
  orderType: "سفري",
  table: "12",
  items: [
    { name: "منتج أساسي", qty: 2, price: 15, selectedModifiers: [{ name: "إضافة خاصة", priceDelta: 4 }], note: "بدون بصل" },
    { name: "مشروب غازي", qty: 1, price: 8 },
  ],
  subtotal: 46,
  discount: 3,
  tax: 0,
  serviceFee: 0,
  deliveryFee: 0,
  total: 43,
  method: "نقدي",
  paymentLines: [{ method: "cash", amount: 50 }],
  cashReceived: 50,
  change: 7,
};

type PosReceiptProps = {
  design: ReceiptDesign;
  settings: { storeName: string; storeAddress: string; taxNumber: string; receiptFooter: string; currencySymbol: string };
  data: ReceiptData;
};

type ReceiptRowProps = {
  label: string;
  value?: string;
  bold?: boolean;
};

function Row({ label, value, bold }: ReceiptRowProps) {
  if (!value) return null;

  return (
    <div className="flex justify-between" style={bold ? { fontWeight: 700 } : undefined}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function PosReceipt({ design, settings, data }: PosReceiptProps) {
  const cur = settings.currencySymbol || "";
  const accent = design.accentColor;
  const tpl = design.template;
  const small: React.CSSProperties = { fontSize: `${Math.max(9, design.fontSize - 2)}px` };
  const sep = (extra?: React.CSSProperties): React.CSSProperties => ({
    ...sepStyle(accent, design.separator),
    marginTop: "6px",
    paddingTop: "6px",
    ...extra,
  });

  // ── Header ──
  const header = (
    <div style={{ textAlign: design.headerAlign, ...(tpl === "creative" ? { background: accent, color: "#fff", padding: "8px", borderRadius: 6 } : {}) }}>
      {design.showLogo && design.logoText && (
        <div style={{ fontSize: `${design.fontSize + 8}px` }}>{design.logoText}</div>
      )}
      {design.showStoreName && (
        <div className="font-bold" style={{ fontSize: `${design.fontSize + 3}px`, color: tpl === "creative" ? "#fff" : accent }}>
          {settings.storeName}
        </div>
      )}
      {design.showStoreAddress && <div>{settings.storeAddress || "العنوان هنا"}</div>}
      {design.showTaxNumber && <div>الرقم الضريبي: {settings.taxNumber || "—"}</div>}
      {design.headerText && <div>{design.headerText}</div>}
      {tpl !== "creative" && <div style={small}>فاتورة ضريبية مبسطة</div>}
    </div>
  );

  const meta = (
    <>
      <Row label="رقم الفاتورة:" value={data.invoiceNumber} />
      {design.showTime && <Row label="التاريخ:" value={data.date} />}
      {design.showCashier && <Row label="الكاشير:" value={data.cashier} />}
      {design.showCustomer && <Row label="العميل:" value={data.customer} />}
      {design.showOrderType && (
        <Row label="النوع:" value={`${data.orderType || ""}${design.showTable && data.table ? ` - طاولة ${data.table}` : ""}`} />
      )}
    </>
  );

  // ── Items ──
  const itemsBlock = data.items.map((item, i) => {
    const mods = item.selectedModifiers ?? [];
    const unit = item.price + mods.reduce((s, m) => s + (m.priceDelta || 0), 0);
    const lineTotal = unit * item.qty;
    const zebra = tpl === "minimal" && i % 2 === 1;
    if (tpl === "card") {
      return (
        <div key={i} style={{ border: `1px solid ${accent}33`, borderRadius: 8, padding: "5px 7px", marginBottom: 5, background: "#fff" }}>
          <div className="flex justify-between">
            <span className="font-semibold">{item.name} ×{item.qty}</span>
            <span>{cur} {lineTotal.toFixed(2)}</span>
          </div>
          {mods.length > 0 && (
            <div className="flex justify-between" style={small}>
              <span style={{ color: "#555" }}>{mods.map((m) => m.name).join(" + ")}</span>
              <span>{cur} {(mods.reduce((s, m) => s + (m.priceDelta || 0), 0) * item.qty).toFixed(2)}</span>
            </div>
          )}
          {design.showDiscounts && item.discount ? (
            <div className="flex justify-between" style={small}><span>خصم {item.discount}%</span><span>- {cur} {(lineTotal * item.discount / 100).toFixed(2)}</span></div>
          ) : null}
          {design.showItemNotes && item.note && <div style={small}>* {item.note}</div>}
        </div>
      );
    }
    return (
      <div key={i} className="py-0.5" style={zebra ? { background: "#00000008", borderRadius: 4, padding: "3px 4px" } : undefined}>
        <div className="flex justify-between">
          <span>{item.name} ×{item.qty}</span>
          <span>{cur} {lineTotal.toFixed(2)}</span>
        </div>
        {mods.length > 0 && (
          <div className="flex justify-between" style={small}>
            <span style={{ color: "#555" }}>{mods.map((m) => m.name).join(" + ")}</span>
            <span>{cur} {(mods.reduce((s, m) => s + (m.priceDelta || 0), 0) * item.qty).toFixed(2)}</span>
          </div>
        )}
        {design.showDiscounts && item.discount ? (
          <div className="flex justify-between" style={small}><span>خصم {item.discount}%</span><span>- {cur} {(lineTotal * item.discount / 100).toFixed(2)}</span></div>
        ) : null}
        {design.showItemNotes && item.note && <div style={small}>* {item.note}</div>}
      </div>
    );
  });

  // ── Totals ──
  const totalsBlock = (
    <div className="space-y-0.5">
      <Row label="المجموع الفرعي:" value={`${cur} ${data.subtotal.toFixed(2)}`} />
      {design.showDiscounts && data.discount ? <Row label="الخصم:" value={`- ${cur} ${(data.discount || 0).toFixed(2)}`} /> : null}
      {data.tax ? <Row label="الضريبة:" value={`${cur} ${(data.tax || 0).toFixed(2)}`} /> : null}
      {data.serviceFee ? <Row label="رسوم خدمة:" value={`${cur} ${(data.serviceFee || 0).toFixed(2)}`} /> : null}
      {data.deliveryFee ? <Row label="رسوم توصيل:" value={`${cur} ${(data.deliveryFee || 0).toFixed(2)}`} /> : null}
      <div
        className={`flex justify-between ${design.boldTotal ? "font-bold" : ""}`}
        style={{
          ...sep(design.boldTotal ? { paddingTop: "4px", marginTop: "4px" } : undefined),
          fontSize: design.boldTotal ? `${design.fontSize + 2}px` : undefined,
          color: design.boldTotal && tpl !== "minimal" ? accent : undefined,
        }}
      >
        <span>الإجمالي:</span>
        <span>{cur} {data.total.toFixed(2)}</span>
      </div>
      {design.showPayments &&
        (data.paymentLines && data.paymentLines.length > 1
          ? data.paymentLines.map((p, i) => <Row key={i} label={`${PAY_LABEL[p.method] || p.method}:`} value={`${cur} ${p.amount.toFixed(2)}`} />)
          : <Row label="طريقة الدفع:" value={data.method} />)}
      {design.showChange && data.cashReceived != null && (
        <>
          <Row label="المستلم:" value={`${cur} ${(data.cashReceived || 0).toFixed(2)}`} />
          <Row label="الباقي:" value={`${cur} ${Math.max(0, data.change || 0).toFixed(2)}`} />
        </>
      )}
    </div>
  );

  const footer = (
    <div style={sep({ textAlign: "center", marginTop: "6px", paddingTop: "6px" })} className="mt-3">
      <p>{design.footerText || settings.receiptFooter}</p>
      {design.extraFooter && <p>{design.extraFooter}</p>}
    </div>
  );

  // ── Container & layout per template ──
  const containerClass = [
    "w-full text-black",
    tpl === "restaurant" ? "border-2 rounded-lg" : "",
    tpl === "modern" ? "rounded-xl" : "",
    tpl === "card" ? "rounded-xl" : "",
    tpl === "creative" ? "rounded-lg" : "",
    tpl === "grid" ? "rounded-md" : "",
  ].join(" ");

  const frameStyle: React.CSSProperties = tpl === "restaurant" ? { borderColor: accent, padding: 4 } : {};

  const inner = (() => {
    switch (tpl) {
      case "grid":
        return (
          <>
            {design.template === "modern" && <div style={{ height: 6, background: accent, borderRadius: 4, marginBottom: 8 }} />}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>{header}</div>
              <div style={{ flex: 1, border: `1px solid ${accent}55`, borderRadius: 6, padding: "4px 6px", fontSize: small.fontSize }}>
                <div className="flex justify-between"><span>الفاتورة:</span><span>{data.invoiceNumber}</span></div>
                {design.showTime && <div className="flex justify-between"><span>التاريخ:</span><span>{data.date}</span></div>}
              </div>
            </div>
            <div style={sep({ marginTop: "6px", paddingTop: "6px" })} className="grid grid-cols-2 gap-2">
              <div style={{ border: `1px solid ${accent}33`, borderRadius: 6, padding: "4px 6px" }}>{meta}</div>
              <div style={{ border: `1px solid ${accent}33`, borderRadius: 6, padding: "4px 6px" }}>
                {design.showCashier && <Row label="الكاشير:" value={data.cashier} />}
                {design.showCustomer && <Row label="العميل:" value={data.customer} />}
              </div>
            </div>
            <div style={sep({ marginTop: "6px", paddingTop: "6px" })} className="space-y-0.5">{itemsBlock}</div>
            <div style={sep({ marginTop: "6px", paddingTop: "6px" })}>{totalsBlock}</div>
            {design.showQR && <QrBox accent={accent} />}
            {design.showBarcode && <BarcodeBox />}
            {footer}
          </>
        );
      case "card":
        return (
          <>
            <div style={{ border: `1px solid ${accent}22`, borderRadius: 10, padding: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 6 }}>{header}</div>
            <div style={{ border: `1px solid ${accent}22`, borderRadius: 10, padding: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 6 }}>{meta}</div>
            <div style={{ ...sep({ marginTop: "6px", paddingTop: "6px" }), border: `1px solid ${accent}22`, borderRadius: 10, padding: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 6 }}>{itemsBlock}</div>
            <div style={{ border: `1px solid ${accent}22`, borderRadius: 10, padding: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>{totalsBlock}</div>
            {design.showQR && <QrBox accent={accent} />}
            {design.showBarcode && <BarcodeBox />}
            {footer}
          </>
        );
      case "b2b":
        return (
          <>
            {header}
            <div style={sep({ marginTop: "6px", paddingTop: "6px" })} className="space-y-0.5">{meta}</div>
            <div style={{ ...sep({ marginTop: "6px", paddingTop: "6px" }), fontSize: small.fontSize }}>
              <div className="flex justify-between font-bold" style={{ borderBottom: `1px solid ${accent}`, paddingBottom: 2 }}>
                <span>الصنف</span><span>الكمية</span><span>السعر</span><span>خصم</span><span>الإجمالي</span>
              </div>
              {data.items.map((item, i) => {
                const mods = item.selectedModifiers ?? [];
                const unit = item.price + mods.reduce((s, m) => s + (m.priceDelta || 0), 0);
                return (
                  <div key={i} className="flex justify-between" style={{ padding: "2px 0" }}>
                    <span style={{ flex: 2 }}>{item.name}</span>
                    <span style={{ flex: 1, textAlign: "center" }}>{item.qty}</span>
                    <span style={{ flex: 1, textAlign: "center" }}>{cur} {unit.toFixed(2)}</span>
                    <span style={{ flex: 1, textAlign: "center" }}>{item.discount ? `${item.discount}%` : "-"}</span>
                    <span style={{ flex: 1, textAlign: "left" }}>{cur} {(unit * item.qty).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
            <div style={sep({ marginTop: "6px", paddingTop: "6px" })} className="grid grid-cols-3 gap-2 text-center">
              <div style={{ border: `1px solid ${accent}33`, borderRadius: 6, padding: "3px" }}><div style={small}>الفرعي</div><div className="font-bold">{cur} {data.subtotal.toFixed(2)}</div></div>
              <div style={{ border: `1px solid ${accent}33`, borderRadius: 6, padding: "3px" }}><div style={small}>الضريبة</div><div className="font-bold">{cur} {(data.tax || 0).toFixed(2)}</div></div>
              <div style={{ border: `1px solid ${accent}33`, borderRadius: 6, padding: "3px" }}><div style={small}>الإجمالي</div><div className="font-bold" style={{ color: accent }}>{cur} {data.total.toFixed(2)}</div></div>
            </div>
            {design.showPayments && (
              <div style={{ ...sep({ marginTop: "6px", paddingTop: "6px" }) }} className="space-y-0.5">
                {data.paymentLines && data.paymentLines.length > 1
                  ? data.paymentLines.map((p, i) => <Row key={i} label={`${PAY_LABEL[p.method] || p.method}:`} value={`${cur} ${p.amount.toFixed(2)}`} />)
                  : <Row label="طريقة الدفع:" value={data.method} />}
              </div>
            )}
            {design.showQR && <QrBox accent={accent} />}
            {design.showBarcode && <BarcodeBox />}
            {footer}
          </>
        );
      case "minimal":
        return (
          <>
            {header}
            <div style={sep({ marginTop: "10px", paddingTop: "8px" })} className="space-y-1">{meta}</div>
            <div style={{ marginTop: "8px" }} className="space-y-0.5">{itemsBlock}</div>
            <div style={{ marginTop: "8px" }}>
              <div className="space-y-0.5">
                <Row label="المجموع الفرعي:" value={`${cur} ${data.subtotal.toFixed(2)}`} />
                {design.showDiscounts && data.discount ? <Row label="الخصم:" value={`- ${cur} ${(data.discount || 0).toFixed(2)}`} /> : null}
                {data.tax ? <Row label="الضريبة:" value={`${cur} ${(data.tax || 0).toFixed(2)}`} /> : null}
              </div>
              <div style={{ background: accent, color: "#fff", borderRadius: 8, padding: "6px 10px", marginTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: `${design.fontSize + 2}px` }}>
                <span>الإجمالي:</span><span>{cur} {data.total.toFixed(2)}</span>
              </div>
              {design.showPayments && (
                <div className="space-y-0.5" style={{ marginTop: 6 }}>
                  {data.paymentLines && data.paymentLines.length > 1
                    ? data.paymentLines.map((p, i) => <Row key={i} label={`${PAY_LABEL[p.method] || p.method}:`} value={`${cur} ${p.amount.toFixed(2)}`} />)
                    : <Row label="طريقة الدفع:" value={data.method} />}
                </div>
              )}
              {design.showChange && data.cashReceived != null && (
                <>
                  <Row label="المستلم:" value={`${cur} ${(data.cashReceived || 0).toFixed(2)}`} />
                  <Row label="الباقي:" value={`${cur} ${Math.max(0, data.change || 0).toFixed(2)}`} />
                </>
              )}
            </div>
            {design.showQR && <QrBox accent={accent} />}
            {design.showBarcode && <BarcodeBox />}
            {footer}
          </>
        );
      case "creative":
        return (
          <>
            <div style={{ ...sep({ marginTop: "6px", paddingTop: "6px" }) }} className="space-y-0.5">{meta}</div>
            <div style={{ ...sep({ marginTop: "6px", paddingTop: "6px" }), borderLeft: `3px solid ${accent}`, paddingLeft: 6 }} className="space-y-0.5">{itemsBlock}</div>
            <div style={{ ...sep({ marginTop: "6px", paddingTop: "6px" }) }}>{totalsBlock}</div>
            {design.showQR && <QrBox accent={accent} />}
            {design.showBarcode && <BarcodeBox />}
            {footer}
          </>
        );
      case "modern":
      case "restaurant":
        return (
          <>
            {tpl === "modern" && <div style={{ height: 6, background: accent, borderRadius: 4, marginBottom: 8 }} />}
            {header}
            <div style={sep({ marginTop: "6px", paddingTop: "6px" })} className="space-y-0.5">{meta}</div>
            <div style={sep({ marginTop: "6px", paddingTop: "6px" })} className="space-y-0.5">{itemsBlock}</div>
            <div style={sep({ marginTop: "6px", paddingTop: "6px" })}>{totalsBlock}</div>
            {design.showQR && <QrBox accent={accent} />}
            {design.showBarcode && <BarcodeBox />}
            {footer}
          </>
        );
      default:
        return (
          <>
            {header}
            <div style={sep({ marginTop: "6px", paddingTop: "6px" })} className="space-y-0.5">{meta}</div>
            <div style={sep({ marginTop: "6px", paddingTop: "6px" })} className="space-y-0.5">{itemsBlock}</div>
            <div style={sep({ marginTop: "6px", paddingTop: "6px" })}>{totalsBlock}</div>
            {design.showQR && <QrBox accent={accent} />}
            {design.showBarcode && <BarcodeBox />}
            {footer}
          </>
        );
    }
  })();

  return (
    <div dir="rtl" className={containerClass} style={{ ...frameStyle, lineHeight: 1.5 }}>
      {inner}
    </div>
  );
}

function QrBox({ accent }: { accent: string }) {
  return (
    <div style={{ marginTop: 6, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, margin: "0 auto", border: `2px solid ${accent}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8 }}>QR</div>
    </div>
  );
}

function BarcodeBox() {
  return (
    <div style={{ marginTop: 4, textAlign: "center", fontFamily: "monospace", letterSpacing: 1 }}>||·|||·||·|</div>
  );
}
