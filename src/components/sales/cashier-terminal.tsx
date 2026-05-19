"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArchiveRestore,
  BadgePercent,
  Banknote,
  Barcode,
  Boxes,
  CreditCard,
  Minus,
  PauseCircle,
  Plus,
  Printer,
  QrCode,
  ReceiptText,
  Scissors,
  Search,
  StickyNote,
  Smartphone,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  defaultInvoiceTemplateOptions,
  InvoiceTemplateRenderer,
  invoiceTemplates,
  type InvoiceQrMode,
  type InvoiceTemplateId,
  type InvoiceTemplateOptions,
} from "@/components/sales/invoice-template-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createQrDataUrl } from "@/lib/qr-code";
import { calculateSalesInventoryImpact, type IngredientDeduction } from "@/lib/sales/inventory-impact";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import type { Branch, BranchStock, CatalogItem, InventoryItem, MenuItem, Organization, Recipe, SalesShift } from "@/types/domain";

type CartItem = {
  id: string;
  code: string;
  name: string;
  barcode: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  itemDiscount: number;
};

type HeldInvoice = {
  id: string;
  name: string;
  cart: CartItem[];
  total: number;
  createdAt: string;
};

type SplitMode = "equal" | "items";
type TerminalView = "fast" | "invoice" | "operations" | "all";
type CashierModal =
  | "held"
  | "customer"
  | "discount"
  | "payment"
  | "notes"
  | "details"
  | "inventory"
  | "receipt"
  | "split"
  | "cancel"
  | "item";

type SalesLedgerEntry = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  salesTotal: number;
  ingredientCostTotal: number;
  estimatedGrossProfit: number;
  deductions: IngredientDeduction[];
};

const taxRates = [
  { label: "بدون ضريبة", value: 0 },
  { label: "ضريبة ١٦٪", value: 16 },
];

const paymentOptions = [
  { label: "نقدي", value: "cash", icon: Banknote },
  { label: "بطاقة", value: "card", icon: CreditCard },
  { label: "تطبيق توصيل", value: "delivery" },
  { label: "حوالة", value: "transfer" },
];

const documentTypes = [
  "فاتورة بيع",
  "فاتورة ضريبية",
  "فاتورة مبسطة",
  "عرض سعر",
  "طلبية",
  "إرسالية",
  "مرتجع بيع",
  "فاتورة معلقة",
];

export function CashierTerminal({
  menuItems,
  catalogItems,
  recipes,
  inventoryItems,
  branchStock,
  branches,
  shift,
  organization,
}: {
  menuItems: MenuItem[];
  catalogItems: CatalogItem[];
  recipes: Recipe[];
  inventoryItems: InventoryItem[];
  branchStock: BranchStock[];
  branches: Branch[];
  shift: SalesShift;
  organization: Organization;
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [heldInvoices, setHeldInvoices] = useState<HeldInvoice[]>([]);
  const [query, setQuery] = useState("");
  const [terminalView, setTerminalView] = useState<TerminalView>("fast");
  const [activeModal, setActiveModal] = useState<CashierModal | null>(null);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [barcodeValue, setBarcodeValue] = useState("");
  const [category, setCategory] = useState("الكل");
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [serviceFee, setServiceFee] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [documentType, setDocumentType] = useState("فاتورة بيع");
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [splitPeople, setSplitPeople] = useState(2);
  const [splitAssignments, setSplitAssignments] = useState<Record<string, number>>({});
  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id ?? "");
  const [customerName, setCustomerName] = useState("عميل نقدي");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerTaxNumber, setCustomerTaxNumber] = useState("");
  const [notes, setNotes] = useState("شكرًا لزيارتكم");
  const [notice, setNotice] = useState("الوردية مفتوحة وجاهزة للبيع");
  const [digitalReceipt, setDigitalReceipt] = useState(true);
  const [invoiceTemplateOptions, setInvoiceTemplateOptions] = useState<InvoiceTemplateOptions>(defaultInvoiceTemplateOptions);
  const [committedDeductions, setCommittedDeductions] = useState<Record<string, number>>({});
  const [salesLedger, setSalesLedger] = useState<SalesLedgerEntry[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => ["الكل", ...Array.from(new Set(catalogItems.map((item) => item.categoryName)))], [catalogItems]);
  const filteredItems = useMemo(() => {
    return catalogItems.filter((item) => {
      const matchesQuery =
        item.name.includes(query) ||
        item.code.includes(query) ||
        item.barcodes.some((barcode) => barcode.includes(query));
      const matchesCategory = category === "الكل" || item.categoryName === category;
      return matchesQuery && matchesCategory;
    });
  }, [catalogItems, category, query]);
  const quickMatches = useMemo(() => filteredItems.slice(0, 6), [filteredItems]);

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const itemDiscountTotal = cart.reduce((sum, item) => sum + item.itemDiscount * item.quantity, 0);
  const taxableAmount = Math.max(subtotal - itemDiscountTotal - invoiceDiscount + serviceFee + deliveryFee, 0);
  const taxTotal = taxableAmount * (taxRate / 100);
  const total = taxableAmount + taxTotal;
  const remainingAmount = Math.max(total - paidAmount, 0);
  const invoiceNumber = useMemo(() => {
    const stamp = new Date();
    return `فاتورة-${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, "0")}-${String(stamp.getHours()).padStart(2, "0")}${String(stamp.getMinutes()).padStart(2, "0")}`;
  }, []);
  const receiptOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
  const receiptToken = useMemo(() => `inv-${invoiceNumber.replace(/[^\d]/g, "")}`, [invoiceNumber]);
  const receiptUrl = `${receiptOrigin}/r/${receiptToken}/image?t=${Math.round(total)}`;
  const receiptQr = useMemo(() => createQrDataUrl(receiptUrl), [receiptUrl]);
  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? branches[0];
  const paymentLabel = paymentOptions.find((option) => option.value === paymentMethod)?.label ?? "نقدي";
  const inventoryImpact = useMemo(
    () =>
      calculateSalesInventoryImpact({
        cart,
        menuItems,
        recipes,
        inventoryItems,
        branchStock,
        branchId: selectedBranchId,
        invoiceDiscount,
        committedDeductions,
      }),
    [branchStock, cart, committedDeductions, inventoryItems, invoiceDiscount, menuItems, recipes, selectedBranchId],
  );
  const printableInvoice = useMemo(
    () => ({
      documentType,
      invoiceNumber,
      organizationName: organization.name,
      branchName: selectedBranch?.name ?? "",
      branchAddress: selectedBranch?.address ?? "",
      customerName,
      customerPhone,
      customerTaxNumber,
      paymentLabel,
      issuedAt: new Date().toISOString(),
      receiptUrl,
      receiptQr,
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.itemDiscount,
        unit: item.unit,
        total: Math.max((item.unitPrice - item.itemDiscount) * item.quantity, 0),
      })),
      subtotal,
      itemDiscountTotal,
      invoiceDiscount,
      serviceFee,
      deliveryFee,
      taxTotal,
      total,
      notes,
    }),
    [
      cart,
      customerName,
      customerPhone,
      customerTaxNumber,
      deliveryFee,
      documentType,
      invoiceDiscount,
      invoiceNumber,
      itemDiscountTotal,
      notes,
      organization.name,
      paymentLabel,
      receiptQr,
      receiptUrl,
      selectedBranch?.address,
      selectedBranch?.name,
      serviceFee,
      subtotal,
      taxTotal,
      total,
    ],
  );
  const splitBills = useMemo(() => {
    if (!cart.length) return [];
    if (splitMode === "equal") {
      const share = total / Math.max(splitPeople, 1);
      return Array.from({ length: Math.max(splitPeople, 1) }).map((_, index) => ({
        name: `فاتورة فرعية ${formatNumber(index + 1)}`,
        items: cart,
        total: share,
      }));
    }

    return Array.from({ length: Math.max(splitPeople, 1) }).map((_, index) => {
      const personNumber = index + 1;
      const assignedItems = cart.filter((item) => (splitAssignments[item.id] ?? 1) === personNumber);
      const assignedSubtotal = assignedItems.reduce((sum, item) => sum + Math.max((item.unitPrice - item.itemDiscount) * item.quantity, 0), 0);
      const proportionalTotal = subtotal > 0 ? total * (assignedSubtotal / Math.max(subtotal - itemDiscountTotal, 1)) : 0;
      return {
        name: `فاتورة فرعية ${formatNumber(personNumber)}`,
        items: assignedItems,
        total: Math.max(proportionalTotal, 0),
      };
    });
  }, [cart, itemDiscountTotal, splitAssignments, splitMode, splitPeople, subtotal, total]);

  function normalizeScannedCode(value: string) {
    const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
    const easternArabicDigits = "۰۱۲۳۴۵۶۷۸۹";
    return value
      .trim()
      .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
      .replace(/[۰-۹]/g, (digit) => String(easternArabicDigits.indexOf(digit)))
      .replace(/\s+/g, "")
      .toUpperCase();
  }

  function itemMatchesScannedCode(item: CatalogItem, scannedCode: string) {
    const codes = [item.code, ...item.barcodes, ...item.units.map((unit) => unit.barcode)].filter((code): code is string => Boolean(code));
    return codes.some((code) => normalizeScannedCode(code) === scannedCode);
  }

  function addCatalogItem(item: CatalogItem, barcode = item.barcodes[0] ?? "") {
    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.id === item.id && cartItem.unit === item.mainUnit);
      if (existing) {
        return current.map((cartItem) =>
          cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem,
        );
      }

      return [
        ...current,
        {
          id: item.id,
          code: item.code,
          name: item.name,
          barcode,
          unit: item.mainUnit,
          unitPrice: item.retailPrice,
          quantity: 1,
          itemDiscount: 0,
        },
      ];
    });
  }

  function scanBarcode(value = barcodeValue) {
    const normalized = normalizeScannedCode(value);
    if (!normalized) return;
    const found = catalogItems.find((item) => itemMatchesScannedCode(item, normalized));
    if (!found) {
      setNotice(`لم يتم العثور على صنف بهذا الكود: ${normalized}`);
      barcodeInputRef.current?.select();
      return;
    }
    addCatalogItem(found, normalized);
    setBarcodeValue("");
    setNotice(`تمت إضافة ${found.name} إلى الفاتورة`);
    barcodeInputRef.current?.focus();
  }

  function openPhoneCamera() {
    cameraInputRef.current?.click();
  }

  async function scanFromPhoneCamera(file?: File) {
    if (!file) return;
    const barcodeDetectorConstructor = (globalThis as typeof globalThis & {
      BarcodeDetector?: new (options?: { formats?: string[] }) => {
        detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
      };
    }).BarcodeDetector;

    if (!barcodeDetectorConstructor) {
      setNotice("المتصفح لا يدعم قراءة الباركود من الكاميرا. استخدم إدخال الباركود اليدوي.");
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      const detector = new barcodeDetectorConstructor({
        formats: ["ean_13", "ean_8", "code_128", "code_39", "qr_code", "upc_a", "upc_e"],
      });
      const results = await detector.detect(bitmap);
      const rawValue = normalizeScannedCode(results[0]?.rawValue ?? "");
      if (!rawValue) {
        setNotice("لم يتم العثور على باركود واضح في الصورة.");
        return;
      }
      const found = catalogItems.find((item) => itemMatchesScannedCode(item, rawValue));
      if (!found) {
        setNotice(`تمت قراءة الباركود ${rawValue} لكنه غير مربوط بأي صنف.`);
        return;
      }
      addCatalogItem(found, rawValue);
      setNotice(`تم مسح ${found.name} بكاميرا الجوال وإضافته للفاتورة`);
    } catch {
      setNotice("تعذر قراءة الباركود من الصورة. حاول بصورة أوضح.");
    }
  }

  function updateQuantity(id: string, quantity: number) {
    if (quantity <= 0) {
      setCart((current) => current.filter((item) => item.id !== id));
      return;
    }
    setCart((current) => current.map((item) => (item.id === id ? { ...item, quantity } : item)));
  }

  function suspendInvoice() {
    if (!cart.length) return;
    setHeldInvoices((current) => [
      {
        id: `معلقة-${current.length + 1}`,
        name: customerName || "عميل نقدي",
        cart,
        total,
        createdAt: new Date().toLocaleTimeString("ar-PS", { hour: "2-digit", minute: "2-digit" }),
      },
      ...current,
    ]);
    setCart([]);
    setNotice("تم تعليق الفاتورة ويمكن استرجاعها لاحقًا");
  }

  function restoreInvoice(invoice: HeldInvoice) {
    setCart(invoice.cart);
    setHeldInvoices((current) => current.filter((item) => item.id !== invoice.id));
    setNotice("تم استرجاع الفاتورة المعلقة");
  }

  function cancelInvoice() {
    setCart([]);
    setInvoiceDiscount(0);
    setServiceFee(0);
    setDeliveryFee(0);
    setNotice("تم إلغاء الفاتورة الحالية");
  }

  function printInvoice() {
    window.print();
  }

  function updateInvoiceTemplateOptions(options: InvoiceTemplateOptions) {
    setInvoiceTemplateOptions(options);
    setDigitalReceipt(options.qrMode !== "none");
  }

  function issueAndDeductInventory() {
    if (!cart.length) return;
    if (inventoryImpact.insufficientCount > 0) {
      setNotice("لا يمكن ترحيل البيع لأن هناك مواد لا تكفي في المخزون.");
      return;
    }

    setCommittedDeductions((current) => {
      const next = { ...current };
      inventoryImpact.deductions.forEach((deduction) => {
        next[deduction.itemId] = (next[deduction.itemId] ?? 0) + deduction.requiredQuantity;
      });
      return next;
    });
    setSalesLedger((current) => [
      {
        id: `sale-${Date.now()}`,
        invoiceNumber,
        createdAt: new Date().toLocaleString("ar-PS"),
        salesTotal: inventoryImpact.salesTotal,
        ingredientCostTotal: inventoryImpact.ingredientCostTotal,
        estimatedGrossProfit: inventoryImpact.estimatedGrossProfit,
        deductions: inventoryImpact.deductions,
      },
      ...current,
    ]);
    setCart([]);
    setInvoiceDiscount(0);
    setServiceFee(0);
    setDeliveryFee(0);
    setNotice("تم إصدار الفاتورة وخصم مكونات الوجبات من المخزون وتسجيل أثر الربح.");
  }

  function printSplitBill(name: string) {
    setNotice(`تم تجهيز ${name} للطباعة كإيصال منفصل`);
  }

  return (
    <div className="space-y-4">
      <Card className="print:hidden">
        <CardContent className="p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px] lg:items-center">
            <div>
              <h2 className="text-xl font-black">كاشير سريع</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {shift.cashierName} · شاشة واحدة للبيع: ابحث، أضف، عدل الكمية، ادفع. أي شيء ثانوي خلف زر واضح.
              </p>
            </div>
            <Select value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)} aria-label="اختيار الفرع">
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </Select>
            <div className="grid grid-cols-3 gap-2">
              {(["fast", "invoice", "operations"] as TerminalView[]).map((mode) => (
                <Button key={mode} type="button" size="sm" variant={terminalView === mode ? "default" : "outline"} onClick={() => setTerminalView(mode)}>
                  {mode === "fast" ? "بيع" : mode === "invoice" ? "طاولات" : "إدارة"}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="space-y-4 print:hidden">
          <Card>
            <CardContent className="space-y-3 p-3 sm:p-4">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] lg:grid-cols-[minmax(0,1fr)_220px_160px]">
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
                  <Input
                    className="h-11 sm:h-12 border-blue-100 bg-blue-50/60 ps-10 text-base font-semibold"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="ابحث..."
                  />
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1 sm:flex-none sm:w-40">
                    <Barcode className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={barcodeInputRef}
                      className="h-11 sm:h-12 ps-9"
                      value={barcodeValue}
                      onChange={(event) => setBarcodeValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") scanBarcode();
                      }}
                      placeholder="باركود"
                    />
                  </div>
                  <Button className="h-11 sm:h-12" type="button" variant="outline" onClick={openPhoneCamera}>
                    <Smartphone className="h-4 w-4 sm:hidden" />
                    <span className="hidden sm:inline"><Smartphone className="h-4 w-4" /> كاميرا</span>
                  </Button>
                </div>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => {
                    void scanFromPhoneCamera(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </div>

              {query ? (
                <div className="grid gap-2 rounded-lg border border-blue-100 bg-white p-3 md:grid-cols-2 xl:grid-cols-3">
                  {quickMatches.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addCatalogItem(item)}
                      className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2 text-start text-sm transition hover:border-primary hover:bg-blue-50"
                    >
                      <span>
                        <span className="block font-semibold">{item.name}</span>
                        <span className="text-xs text-muted-foreground">{item.code}</span>
                      </span>
                      <span className="font-bold text-primary">{formatCurrency(item.retailPrice)}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map((label) => (
                  <Button key={label} className="shrink-0" variant={category === label ? "default" : "outline"} size="sm" onClick={() => setCategory(label)}>
                    {label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="rounded-lg border bg-white p-3 sm:p-4 shadow-sm transition hover:border-primary hover:bg-blue-50">
                <button type="button" className="w-full text-start" onClick={() => addCatalogItem(item)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">كود {item.code}</p>
                      <h3 className="mt-0.5 font-bold text-sm sm:text-base truncate">{item.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground hidden sm:block">{item.categoryName} · مخزون {formatNumber(item.stockQuantity)}</p>
                    </div>
                    <Badge className="shrink-0" tone={item.isActive ? "success" : "muted"}>{item.isActive ? "متاح" : "متوقف"}</Badge>
                  </div>
                  <div className="mt-3 sm:mt-5 flex items-center justify-between">
                    <span className="text-xl sm:text-2xl font-black text-primary">{formatCurrency(item.retailPrice)}</span>
                    <span className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-lg bg-primary text-white"><Plus className="h-4 w-4" /></span>
                  </div>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 sm:mt-2 w-full text-xs"
                  onClick={() => {
                    setSelectedItem(item);
                    setActiveModal("item");
                  }}
                >
                  تفاصيل
                </Button>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4 print:hidden">
          <Card className="sticky top-20">
            <CardHeader className="p-3 sm:p-4">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <ReceiptText className="h-5 w-5 text-primary" />
                <span className="hidden sm:inline">الطلب الحالي</span>
                <span className="sm:hidden">السلة</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-3 sm:p-4">
              <div className="rounded-lg border bg-blue-50 px-2 py-2 text-xs sm:text-sm text-blue-900">{notice}</div>

              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <Button className="text-xs py-1.5 sm:py-2" type="button" variant="outline" size="sm" onClick={() => setActiveModal("customer")}><UserRound className="h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">{customerName || "عميل"}</span><span className="sm:hidden">عميل</span></Button>
                <Button className="text-xs py-1.5 sm:py-2" type="button" variant="outline" size="sm" onClick={() => setActiveModal("held")}><PauseCircle className="h-3 w-3 sm:h-4 sm:w-4" />معلقات</Button>
                <Button className="text-xs py-1.5 sm:py-2" type="button" variant="outline" size="sm" onClick={() => setActiveModal("discount")}><BadgePercent className="h-3 w-3 sm:h-4 sm:w-4" />خصم</Button>
                <Button className="text-xs py-1.5 sm:py-2" type="button" variant="outline" size="sm" onClick={() => setActiveModal("notes")}><StickyNote className="h-3 w-3 sm:h-4 sm:w-4" />ملاحظات</Button>
              </div>

              <div className="rounded-lg border">
                {cart.length === 0 ? (
                  <div className="p-4 sm:p-8 text-center text-xs sm:text-sm text-muted-foreground">أضف صنفًا لبدء الطلب.</div>
                ) : (
                  <div className="max-h-[35vh] sm:max-h-[42vh] divide-y overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.id} className="space-y-2 p-2 sm:p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground hidden sm:block">{formatCurrency(item.unitPrice)} · خصم {formatCurrency(item.itemDiscount)}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => updateQuantity(item.id, 0)} aria-label="حذف"><Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-destructive" /></Button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label="إنقاص"><Minus className="h-3 w-3 sm:h-4 sm:w-4" /></Button>
                            <Input className="w-12 sm:w-16 text-center font-bold text-sm py-1" type="number" min="1" value={item.quantity} onChange={(event) => updateQuantity(item.id, Number(event.target.value))} />
                            <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label="زيادة"><Plus className="h-3 w-3 sm:h-4 sm:w-4" /></Button>
                          </div>
                          <span className="font-black text-sm sm:text-base text-primary">{formatCurrency(Math.max((item.unitPrice - item.itemDiscount) * item.quantity, 0))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <TotalsBox subtotal={subtotal} itemDiscountTotal={itemDiscountTotal} invoiceDiscount={invoiceDiscount} serviceFee={serviceFee} deliveryFee={deliveryFee} taxTotal={taxTotal} total={total} />

              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="col-span-2 h-12 text-base"
                  type="button"
                  onClick={() => {
                    setPaidAmount(Math.round(total));
                    setActiveModal("payment");
                  }}
                  disabled={cart.length === 0}
                >
                  <Banknote className="h-4 w-4" />
                  الدفع
                </Button>
                <Button type="button" variant="outline" onClick={suspendInvoice} disabled={cart.length === 0}><PauseCircle className="h-4 w-4" />تعليق</Button>
                <Button type="button" variant="outline" onClick={() => setActiveModal("cancel")} disabled={cart.length === 0}><XCircle className="h-4 w-4" />إلغاء</Button>
                <Button type="button" variant="outline" onClick={() => setActiveModal("inventory")}><Boxes className="h-4 w-4" />المخزون</Button>
                <Button type="button" variant="outline" onClick={() => setActiveModal("details")}><ReceiptText className="h-4 w-4" />تفاصيل</Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Modal open={activeModal === "held"} title="الطلبات المعلقة" description="استرجع طلبًا بسرعة." onClose={() => setActiveModal(null)}>
        <HeldInvoices invoices={heldInvoices} onRestore={(invoice) => { restoreInvoice(invoice); setActiveModal(null); }} />
      </Modal>

      <Modal open={activeModal === "customer"} title="اختيار العميل" description="اختياري، اتركه عميل نقدي عند البيع السريع." onClose={() => setActiveModal(null)}>
        <div className="space-y-4">
          <div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" /><Input className="ps-9" placeholder="بحث بالاسم أو رقم الهاتف" /></div>
          {[["أحمد محمد", "059xxxxxxx"], ["شركة النور", "056xxxxxxx"], ["عميل نقدي", ""]].map(([name, phone]) => (
            <div key={name} className="flex items-center justify-between rounded-lg border p-3">
              <div><p className="font-semibold">{name}</p><p className="text-sm text-muted-foreground">{phone || "بدون رقم"}</p></div>
              <Button type="button" size="sm" onClick={() => { setCustomerName(name); setCustomerPhone(phone); setActiveModal(null); }}>اختيار</Button>
            </div>
          ))}
          <div className="grid gap-3 rounded-lg border bg-slate-50 p-3 sm:grid-cols-2">
            <div className="grid gap-2"><Label>اسم عميل جديد</Label><Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></div>
            <div className="grid gap-2"><Label>رقم الهاتف</Label><Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>الرقم الضريبي</Label>
              <Input value={customerTaxNumber} onChange={(event) => setCustomerTaxNumber(event.target.value)} placeholder="اختياري للفواتير الضريبية" />
            </div>
            <Button className="sm:col-span-2" type="button" onClick={() => setActiveModal(null)}>حفظ</Button>
          </div>
        </div>
      </Modal>

      <Modal open={activeModal === "discount"} title="تطبيق خصم" onClose={() => setActiveModal(null)}>
        <div className="space-y-4">
          <div className="grid gap-2"><Label>خصم الفاتورة</Label><Input type="number" min="0" value={invoiceDiscount} onChange={(event) => setInvoiceDiscount(Number(event.target.value))} /></div>
          <div className="grid gap-2"><Label>خصم سريع للصنف المحدد</Label><Input type="number" min="0" placeholder="اختياري" disabled /></div>
          <div className="grid gap-2"><Label>سبب الخصم</Label><Textarea placeholder="اختياري" /></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setActiveModal(null)}>إلغاء</Button><Button type="button" onClick={() => setActiveModal(null)}>تطبيق</Button></div>
        </div>
      </Modal>

      <Modal
        open={activeModal === "payment"}
        title="الدفع ومراجعة الفاتورة"
        description="راجع بيانات الفاتورة وشكل الطباعة قبل الإغلاق."
        onClose={() => setActiveModal(null)}
        className="sm:max-w-6xl"
      >
        <div className="grid max-h-[78vh] gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">بيانات الدفع والعميل</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {paymentOptions.map((option) => (
                    <Button key={option.value} type="button" variant={paymentMethod === option.value ? "default" : "outline"} onClick={() => setPaymentMethod(option.value)}>
                      {option.label}
                    </Button>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>اسم العميل</Label>
                    <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>رقم الهاتف</Label>
                    <Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="اختياري" />
                  </div>
                  <div className="grid gap-2">
                    <Label>الرقم الضريبي</Label>
                    <Input value={customerTaxNumber} onChange={(event) => setCustomerTaxNumber(event.target.value)} placeholder="اختياري" />
                  </div>
                  <div className="grid gap-2">
                    <Label>نوع المستند</Label>
                    <Select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                      {documentTypes.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>الضريبة</Label>
                    <Select value={String(taxRate)} onChange={(event) => setTaxRate(Number(event.target.value))}>
                      {taxRates.map((rate) => (
                        <option key={rate.value} value={rate.value}>{rate.label}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>المبلغ المدفوع</Label>
                    <Input type="number" min="0" value={paidAmount} onChange={(event) => setPaidAmount(Number(event.target.value))} />
                  </div>
                </div>

                <div className="grid gap-3 rounded-lg border bg-slate-50 p-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">الإجمالي</p>
                    <p className="text-lg font-black">{formatCurrency(total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">المدفوع</p>
                    <p className="text-lg font-black text-primary">{formatCurrency(paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">المتبقي</p>
                    <p className="text-lg font-black">{formatCurrency(remainingAmount)}</p>
                  </div>
                </div>

                <label className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-primary" />
                    تفعيل الفاتورة الرقمية وإظهار QR على الفاتورة
                  </span>
                  <input
                    type="checkbox"
                    checked={digitalReceipt}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      setDigitalReceipt(enabled);
                      updateInvoiceTemplateOptions({ ...invoiceTemplateOptions, qrMode: enabled ? "invoice" : "none" });
                    }}
                    className="h-5 w-5 accent-blue-700"
                  />
                </label>

                {digitalReceipt ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <span className="min-w-0 truncate" dir="ltr">{receiptUrl}</span>
                    <Button asChild size="sm" variant="outline">
                      <a href={receiptUrl} target="_blank" rel="noreferrer">فتح الفاتورة الرقمية</a>
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <InvoiceTemplateCustomizer options={invoiceTemplateOptions} onChange={updateInvoiceTemplateOptions} />
          </div>

          <aside className="space-y-3">
            <div className="rounded-lg border bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-bold">معاينة الطباعة</p>
                  <p className="text-xs text-muted-foreground">هذا هو الشكل الذي سيخرج للطابعة.</p>
                </div>
                <Badge tone="default">{invoiceTemplateOptions.paperWidth}mm</Badge>
              </div>
              <div className="max-h-[58vh] overflow-auto rounded-lg bg-white p-3">
                <InvoiceTemplateRenderer data={printableInvoice} options={invoiceTemplateOptions} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setActiveModal(null)}>رجوع</Button>
              <Button
                type="button"
                onClick={() => {
                  printInvoice();
                  setActiveModal(null);
                }}
              >
                <Printer className="h-4 w-4" />
                تأكيد وطباعة
              </Button>
            </div>
          </aside>
        </div>
      </Modal>

      <Modal open={activeModal === "notes"} title="ملاحظات الطلب" onClose={() => setActiveModal(null)}>
        <div className="space-y-4">
          <div className="grid gap-2"><Label>ملاحظة للمطبخ</Label><Textarea placeholder="مثال: بدون صوص" /></div>
          <div className="grid gap-2"><Label>ملاحظة تظهر في الفاتورة</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setActiveModal(null)}>إلغاء</Button><Button type="button" onClick={() => setActiveModal(null)}>حفظ</Button></div>
        </div>
      </Modal>

      <Modal open={activeModal === "inventory"} title="أثر المخزون" onClose={() => setActiveModal(null)} className="sm:max-w-3xl">
        <SalesInventoryImpactPanel impact={inventoryImpact} salesLedger={salesLedger} onIssue={issueAndDeductInventory} canIssue={cart.length > 0} />
      </Modal>

      <Modal open={activeModal === "details"} title="تفاصيل إضافية" onClose={() => setActiveModal(null)} className="sm:max-w-4xl">
        <div className="grid gap-4 lg:grid-cols-2">
          <DigitalReceiptPanel receiptUrl={receiptUrl} customerName={customerName} organizationName={organization.name} total={total} enabled={digitalReceipt} onToggle={setDigitalReceipt} />
          <InvoiceTemplateCustomizer options={invoiceTemplateOptions} onChange={updateInvoiceTemplateOptions} />
          <div className="lg:col-span-2"><SplitBillPanel cart={cart} splitMode={splitMode} splitPeople={splitPeople} splitAssignments={splitAssignments} splitBills={splitBills} onModeChange={setSplitMode} onPeopleChange={setSplitPeople} onAssignItem={(itemId, personNumber) => setSplitAssignments((current) => ({ ...current, [itemId]: personNumber }))} onPrint={printSplitBill} /></div>
        </div>
      </Modal>

      <Modal open={activeModal === "cancel"} title="تأكيد إلغاء الطلب" description="هذا الإجراء يمسح السلة الحالية." onClose={() => setActiveModal(null)}>
        <div className="space-y-4"><div className="rounded-lg border bg-red-50 p-4 text-sm leading-6 text-red-700">هل تريد إلغاء الطلب الحالي؟</div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setActiveModal(null)}>رجوع</Button><Button type="button" variant="destructive" onClick={() => { cancelInvoice(); setActiveModal(null); }}>إلغاء الطلب</Button></div></div>
      </Modal>

      <Modal open={activeModal === "item" && Boolean(selectedItem)} title="تفاصيل الصنف" onClose={() => setActiveModal(null)}>
        {selectedItem ? (
          <div className="space-y-4">
            <div className="flex gap-4 rounded-lg border bg-slate-50 p-4"><div className="grid h-20 w-20 place-items-center rounded-lg bg-white text-3xl">🍽</div><div><h3 className="text-lg font-bold">{selectedItem.name}</h3><p className="mt-1 text-sm text-muted-foreground">المتاح {formatNumber(selectedItem.stockQuantity)} · {selectedItem.categoryName}</p><p className="mt-2 text-2xl font-black text-primary">{formatCurrency(selectedItem.retailPrice)}</p></div></div>
            <div><p className="mb-2 text-sm font-bold">الإضافات</p><div className="flex flex-wrap gap-2">{["جبنة", "صوص", "حجم كبير", "بدون بصل"].map((addon) => (<Button key={addon} type="button" variant="outline" size="sm">{addon}</Button>))}</div></div>
            <Textarea placeholder="ملاحظة للصنف فقط" />
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setActiveModal(null)}>إلغاء</Button><Button type="button" onClick={() => { addCatalogItem(selectedItem); setActiveModal(null); }}>إضافة للسلة</Button></div>
          </div>
        ) : null}
      </Modal>

      <div className="invoice-print-root hidden print:block">
        <InvoiceTemplateRenderer data={printableInvoice} options={invoiceTemplateOptions} />
      </div>
    </div>
  );
}
function InvoiceTemplateCustomizer({
  options,
  onChange,
}: {
  options: InvoiceTemplateOptions;
  onChange: (options: InvoiceTemplateOptions) => void;
}) {
  const update = (patch: Partial<InvoiceTemplateOptions>) => onChange({ ...options, ...patch });
  const uploadLogo = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      update({ logoImageUrl: String(reader.result), showLogo: true });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ReceiptText className="h-4 w-4 text-primary" />
          تخصيص شكل الفاتورة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>القالب الجاهز</Label>
            <Select value={options.template} onChange={(event) => update({ template: event.target.value as InvoiceTemplateId })}>
              {invoiceTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>نص الشعار</Label>
            <Input value={options.logoText} onChange={(event) => update({ logoText: event.target.value })} placeholder="اسم المطعم أو المحل" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between rounded-lg border bg-slate-50 p-3 text-sm font-medium">
            <span>إظهار الشعار</span>
            <input
              type="checkbox"
              checked={options.showLogo}
              onChange={(event) => update({ showLogo: event.target.checked })}
              className="h-4 w-4 accent-teal-700"
            />
          </label>
          <div className="grid gap-2">
            <Label>رفع شعار</Label>
            <Input type="file" accept="image/*" onChange={(event) => uploadLogo(event.target.files?.[0])} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>لون القالب</Label>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={options.accentColor}
                onChange={(event) => update({ accentColor: event.target.value })}
                className="h-10 w-16 p-1"
              />
              <Input value={options.accentColor} onChange={(event) => update({ accentColor: event.target.value })} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>ألوان جاهزة</Label>
            <div className="flex flex-wrap gap-2">
              {["#111827", "#0F766E", "#F97316", "#991B1B"].map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label="اختيار لون"
                  onClick={() => update({ accentColor: color })}
                  className="h-10 w-10 rounded-lg border"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>عرض الورقة بالمليمتر</Label>
            <Input
              type="number"
              min={58}
              max={210}
              value={options.paperWidth}
              onChange={(event) => update({ paperWidth: Number(event.target.value) })}
            />
          </div>
          <div className="grid gap-2">
            <Label>حجم الخط</Label>
            <Input
              type="number"
              min={80}
              max={130}
              value={options.fontScale}
              onChange={(event) => update({ fontScale: Number(event.target.value) })}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border bg-slate-50 p-3">
          <div className="grid gap-2">
            <Label>رمز الفاتورة أو السوشيال</Label>
            <Select value={options.qrMode} onChange={(event) => update({ qrMode: event.target.value as InvoiceQrMode })}>
              <option value="invoice">رمز الفاتورة</option>
              <option value="facebook">رمز فيسبوك</option>
              <option value="instagram">رمز إنستغرام</option>
              <option value="custom">رابط مخصص</option>
              <option value="none">بدون رمز</option>
            </Select>
          </div>

          {options.qrMode === "facebook" ? (
            <div className="grid gap-2">
              <Label>رابط فيسبوك</Label>
              <Input dir="ltr" value={options.facebookUrl} onChange={(event) => update({ facebookUrl: event.target.value })} />
            </div>
          ) : null}

          {options.qrMode === "instagram" ? (
            <div className="grid gap-2">
              <Label>رابط إنستغرام</Label>
              <Input dir="ltr" value={options.instagramUrl} onChange={(event) => update({ instagramUrl: event.target.value })} />
            </div>
          ) : null}

          {options.qrMode === "custom" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>الرابط المخصص</Label>
                <Input dir="ltr" value={options.customQrUrl} onChange={(event) => update({ customQrUrl: event.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>النص أسفل الرمز</Label>
                <Input value={options.customQrLabel} onChange={(event) => update({ customQrLabel: event.target.value })} />
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-2">
          {invoiceTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => update({ template: template.id })}
              className={`rounded-lg border p-3 text-right text-sm transition ${
                options.template === template.id ? "border-teal-600 bg-teal-50 text-teal-950" : "bg-white hover:bg-slate-50"
              }`}
            >
              <span className="block font-bold">{template.name}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{template.description}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TotalsBox({
  subtotal,
  itemDiscountTotal,
  invoiceDiscount,
  serviceFee,
  deliveryFee,
  taxTotal,
  total,
}: {
  subtotal: number;
  itemDiscountTotal: number;
  invoiceDiscount: number;
  serviceFee: number;
  deliveryFee: number;
  taxTotal: number;
  total: number;
}) {
  return (
    <div className="space-y-3 rounded-lg bg-slate-50 p-4">
      {[
        ["المجموع الفرعي", subtotal],
        ["خصومات الأصناف", itemDiscountTotal],
        ["خصم الفاتورة", invoiceDiscount],
        ["الخدمة", serviceFee],
        ["التوصيل", deliveryFee],
        ["الضريبة", taxTotal],
      ].map(([label, value]) => (
        <div key={label} className="flex justify-between text-sm">
          <span>{label}</span>
          <span>{formatCurrency(Number(value))}</span>
        </div>
      ))}
      <div className="flex justify-between border-t pt-3 text-xl font-black">
        <span>الإجمالي</span>
        <span>{formatCurrency(total)}</span>
      </div>
    </div>
  );
}

function SalesInventoryImpactPanel({
  impact,
  salesLedger,
  canIssue,
  onIssue,
}: {
  impact: ReturnType<typeof calculateSalesInventoryImpact>;
  salesLedger: SalesLedgerEntry[];
  canIssue: boolean;
  onIssue: () => void;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Boxes className="h-4 w-4 text-primary" />
          تكامل البيع مع المخزون والربح
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-muted-foreground">مبيعات الفاتورة</p>
            <p className="font-black">{formatCurrency(impact.salesTotal)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-muted-foreground">تكلفة المواد</p>
            <p className="font-black">{formatCurrency(impact.ingredientCostTotal)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-muted-foreground">ربح تقديري</p>
            <p className="font-black">{formatCurrency(impact.estimatedGrossProfit)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-muted-foreground">نسبة تكلفة الطعام</p>
            <p className="font-black">{formatPercent(impact.foodCostPercent)}</p>
          </div>
        </div>

        {impact.missingRecipes.length ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            هذه الأصناف لا تملك وصفة مربوطة، لذلك لا يمكن خصم موادها تلقائيًا: {impact.missingRecipes.join("، ")}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">المواد التي ستنقص من المخزون</p>
            <div className="flex gap-2">
              {impact.lowStockCount ? <Badge tone="warning">{formatNumber(impact.lowStockCount)} منخفض</Badge> : null}
              {impact.insufficientCount ? <Badge tone="danger">{formatNumber(impact.insufficientCount)} لا يكفي</Badge> : null}
            </div>
          </div>

          {impact.deductions.length === 0 ? (
            <p className="rounded-lg border bg-white p-3 text-sm text-muted-foreground">
              أضف وجبة مرتبطة بوصفة حتى تظهر المواد الخام التي ستنقص من المخزون.
            </p>
          ) : (
            <div className="max-h-72 overflow-auto rounded-lg border bg-white">
              {impact.deductions.map((deduction) => (
                <div key={deduction.itemId} className="grid gap-2 border-b p-3 text-sm last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold">{deduction.itemName}</p>
                      <p className="text-xs text-muted-foreground">{deduction.categoryName}</p>
                    </div>
                    <Badge tone={deduction.status === "insufficient" ? "danger" : deduction.status === "low" ? "warning" : "success"}>
                      {deduction.status === "insufficient" ? "لا يكفي" : deduction.status === "low" ? "سينخفض" : "كافي"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded bg-slate-50 p-2">
                      <span className="block text-muted-foreground">سيتم خصم</span>
                      <strong>
                        {formatNumber(deduction.requiredQuantity)} {deduction.unit}
                      </strong>
                    </div>
                    <div className="rounded bg-slate-50 p-2">
                      <span className="block text-muted-foreground">بعد البيع</span>
                      <strong>
                        {formatNumber(Math.max(deduction.projectedQuantity, 0))} {deduction.unit}
                      </strong>
                    </div>
                    <div className="rounded bg-slate-50 p-2">
                      <span className="block text-muted-foreground">تكلفة</span>
                      <strong>{formatCurrency(deduction.totalCost)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button type="button" className="w-full" onClick={onIssue} disabled={!canIssue || impact.insufficientCount > 0}>
          <Boxes className="h-4 w-4" />
          إصدار الفاتورة وخصم المواد الآن
        </Button>

        <div className="rounded-lg border bg-slate-50 p-3">
          <p className="mb-2 text-sm font-bold">آخر فواتير تم ترحيلها للمخزون</p>
          {salesLedger.length === 0 ? (
            <p className="text-sm text-muted-foreground">لم يتم ترحيل أي فاتورة في هذه الجلسة بعد.</p>
          ) : (
            <div className="space-y-2">
              {salesLedger.slice(0, 3).map((entry) => (
                <div key={entry.id} className="rounded-lg bg-white p-2 text-xs">
                  <div className="flex justify-between gap-2 font-bold">
                    <span>{entry.invoiceNumber}</span>
                    <span>{formatCurrency(entry.estimatedGrossProfit)}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {entry.createdAt} · تكلفة مواد {formatCurrency(entry.ingredientCostTotal)} · {formatNumber(entry.deductions.length)} مواد
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DigitalReceiptPanel({
  receiptUrl,
  customerName,
  organizationName,
  total,
  enabled,
  onToggle,
}: {
  receiptUrl: string;
  customerName: string;
  organizationName: string;
  total: number;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const qrDataUrl = useMemo(() => createQrDataUrl(receiptUrl), [receiptUrl]);

  return (
    <Card className="border-teal-200 bg-teal-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-teal-950">
          <QrCode className="h-4 w-4" />
          فاتورة رقمية بدون ورق
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-[130px_1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="h-32 w-32 rounded-lg border bg-white p-2" src={qrDataUrl} alt="رمز الفاتورة الرقمية" />
        <div className="space-y-3 text-sm text-teal-950">
          <p>
            عند إتمام البيع يظهر رمز استجابة للزبون. يفتحه من كاميرا جواله ويتم تحميل صورة الفاتورة مباشرة بدل طباعة الورق.
          </p>
          <div className="rounded-lg bg-white/80 p-3">
            <p className="text-teal-800">الجهة</p>
            <p className="mt-1 font-bold">{organizationName}</p>
            <p className="mt-2 text-teal-800">الزبون</p>
            <p className="mt-1 font-bold">{customerName || "عميل نقدي"}</p>
            <p className="text-teal-800">رابط الفاتورة</p>
            <a className="mt-1 block break-all font-bold underline" href={receiptUrl} target="_blank" rel="noreferrer">
              {receiptUrl}
            </a>
            <p className="mt-1 text-teal-800">الإجمالي {formatCurrency(total)}</p>
          </div>
          <Button type="button" variant={enabled ? "default" : "outline"} onClick={() => onToggle(!enabled)}>
            {enabled ? "الفاتورة الرقمية مفعلة" : "تفعيل الفاتورة الرقمية"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SplitBillPanel({
  cart,
  splitMode,
  splitPeople,
  splitAssignments,
  splitBills,
  onModeChange,
  onPeopleChange,
  onAssignItem,
  onPrint,
}: {
  cart: CartItem[];
  splitMode: SplitMode;
  splitPeople: number;
  splitAssignments: Record<string, number>;
  splitBills: { name: string; items: CartItem[]; total: number }[];
  onModeChange: (mode: SplitMode) => void;
  onPeopleChange: (people: number) => void;
  onAssignItem: (itemId: string, personNumber: number) => void;
  onPrint: (name: string) => void;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Scissors className="h-4 w-4 text-primary" />
          فصل الفاتورة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>طريقة الفصل</Label>
            <Select value={splitMode} onChange={(event) => onModeChange(event.target.value as SplitMode)}>
              <option value="equal">بالتساوي</option>
              <option value="items">حسب الأصناف</option>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>عدد الأشخاص</Label>
            <Input type="number" min="1" max="12" value={splitPeople} onChange={(event) => onPeopleChange(Number(event.target.value))} />
          </div>
        </div>

        {splitMode === "items" ? (
          <div className="space-y-2 rounded-lg border bg-slate-50 p-3">
            <p className="text-sm font-bold">توزيع الأصناف</p>
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground">أضف أصنافًا أولًا لتوزيعها على فواتير فرعية.</p>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_140px] items-center gap-2 rounded-lg bg-white p-2 text-sm">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(item.quantity)} × {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <Select value={String(splitAssignments[item.id] ?? 1)} onChange={(event) => onAssignItem(item.id, Number(event.target.value))}>
                    {Array.from({ length: Math.max(splitPeople, 1) }).map((_, index) => (
                      <option key={index + 1} value={index + 1}>
                        شخص {formatNumber(index + 1)}
                      </option>
                    ))}
                  </Select>
                </div>
              ))
            )}
          </div>
        ) : null}

        <div className="grid gap-2">
          {splitBills.map((bill) => (
            <div key={bill.name} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <p className="font-bold">{bill.name}</p>
                <p className="text-muted-foreground">
                  {splitMode === "equal" ? "حصة متساوية" : `${formatNumber(bill.items.length)} أصناف`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-black text-primary">{formatCurrency(bill.total)}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => onPrint(bill.name)} disabled={!cart.length}>
                  <Printer className="h-4 w-4" />
                  طباعة
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HeldInvoices({ invoices, onRestore }: { invoices: HeldInvoice[]; onRestore: (invoice: HeldInvoice) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ArchiveRestore className="h-4 w-4 text-primary" />
          الفواتير المعلقة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد فواتير معلقة الآن.</p>
        ) : (
          invoices.map((invoice) => (
            <div key={invoice.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <p className="font-bold">{invoice.name}</p>
                <p className="text-muted-foreground">
                  {invoice.createdAt} · {formatCurrency(invoice.total)}
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => onRestore(invoice)}>
                استرجاع
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
