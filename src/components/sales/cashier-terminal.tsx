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
  RotateCcw,
  Scissors,
  Search,
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
  const [barcodeValue, setBarcodeValue] = useState("");
  const [category, setCategory] = useState("الكل");
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [serviceFee, setServiceFee] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [documentType, setDocumentType] = useState("فاتورة بيع");
  const [managerMode, setManagerMode] = useState(false);
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

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const itemDiscountTotal = cart.reduce((sum, item) => sum + item.itemDiscount * item.quantity, 0);
  const taxableAmount = Math.max(subtotal - itemDiscountTotal - invoiceDiscount + serviceFee + deliveryFee, 0);
  const taxTotal = taxableAmount * (taxRate / 100);
  const total = taxableAmount + taxTotal;
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
  const canEditPrice = managerMode;
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

  function scanBarcode() {
    const normalized = barcodeValue.trim();
    if (!normalized) return;
    const found = catalogItems.find((item) => item.barcodes.includes(normalized) || item.units.some((unit) => unit.barcode === normalized));
    if (!found) {
      setNotice("لم يتم العثور على صنف بهذا الباركود");
      return;
    }
    addCatalogItem(found, normalized);
    setBarcodeValue("");
    setNotice(`تمت إضافة ${found.name} إلى الفاتورة`);
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
      const rawValue = results[0]?.rawValue?.trim();
      if (!rawValue) {
        setNotice("لم يتم العثور على باركود واضح في الصورة.");
        return;
      }
      const found = catalogItems.find((item) => item.barcodes.includes(rawValue) || item.units.some((unit) => unit.barcode === rawValue));
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

  function updateLine(id: string, changes: Partial<Pick<CartItem, "unitPrice" | "itemDiscount" | "unit">>) {
    setCart((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
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

  function makeReturn() {
    setDocumentType("مرتجع بيع");
    setNotice("تم تحويل العملية إلى مرتجع بيع");
  }

  function closeShift() {
    setNotice("تم تجهيز تقرير إغلاق الوردية للمراجعة");
  }

  function printInvoice() {
    window.print();
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_500px]">
      <section className="space-y-4 print:hidden">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_180px]">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="ps-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث بالصنف أو الكود" />
              </div>
              <div className="relative">
                <Barcode className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="ps-9"
                  value={barcodeValue}
                  onChange={(event) => setBarcodeValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") scanBarcode();
                  }}
                  placeholder="مسح باركود"
                />
              </div>
              <Button type="button" variant="outline" onClick={scanBarcode}>
                <Barcode className="h-4 w-4" />
                إدخال الباركود
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-teal-50 p-3">
              <div>
                <p className="font-bold text-teal-950">الجوال ماسح باركود</p>
                <p className="text-sm text-teal-800">استخدم كاميرا الجوال لإضافة الصنف بدون جهاز ماسح منفصل.</p>
              </div>
              <Button type="button" onClick={openPhoneCamera}>
                <Smartphone className="h-4 w-4" />
                مسح من كاميرا الجوال
              </Button>
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

            <div className="flex flex-wrap gap-2">
              {categories.map((label) => (
                <Button key={label} variant={category === label ? "default" : "outline"} size="sm" onClick={() => setCategory(label)}>
                  {label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">الأصناف مرتبطة بقائمة الطعام وعدد أطباق المنيو الجاهزة للبيع {formatNumber(menuItems.length)}</p>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => addCatalogItem(item)}
              className="focus-ring rounded-lg border bg-white p-4 text-start shadow-sm transition hover:border-primary hover:bg-teal-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">كود {item.code}</p>
                  <h3 className="mt-1 font-bold">{item.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{item.categoryName} · {item.mainUnit}</p>
                </div>
                <Badge tone={item.isActive ? "success" : "muted"}>{item.isActive ? "نشط" : "متوقف"}</Badge>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <span className="text-2xl font-black text-primary">{formatCurrency(item.retailPrice)}</span>
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-white">
                  <Plus className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>المخزون {formatNumber(item.stockQuantity)}</span>
                <span>{item.barcodes[0]}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <aside className="space-y-4 print:hidden">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-primary" />
              شاشة بيع سريعة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-teal-50 px-3 py-2 text-sm text-teal-900">{notice}</div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>نوع المستند</Label>
                <Select value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                  {documentTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>الفرع</Label>
                <Select value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)}>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold">
                  <UserRound className="h-4 w-4 text-primary" />
                  عميل/مورد
                </div>
                <Button type="button" variant={managerMode ? "default" : "outline"} size="sm" onClick={() => setManagerMode((value) => !value)}>
                  صلاحية تعديل السعر
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>الاسم</Label>
                  <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>الهاتف</Label>
                  <Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="اختياري" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>الرقم الضريبي</Label>
                <Input value={customerTaxNumber} onChange={(event) => setCustomerTaxNumber(event.target.value)} placeholder="اختياري" />
              </div>
            </div>

            <div className="rounded-lg border">
              {cart.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">امسح باركود أو اختر صنفًا لبدء الفاتورة.</div>
              ) : (
                <div className="divide-y">
                  {cart.map((item) => {
                    const source = catalogItems.find((catalogItem) => catalogItem.id === item.id);
                    return (
                      <div key={item.id} className="space-y-3 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-xs text-muted-foreground">كود {item.code} · باركود {item.barcode}</p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => updateQuantity(item.id, 0)} aria-label="حذف الصنف">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="grid gap-1">
                            <Label>الوحدة</Label>
                            <Select value={item.unit} onChange={(event) => updateLine(item.id, { unit: event.target.value })}>
                              {(source?.units ?? [{ name: item.unit, factor: 1 }]).map((unit) => (
                                <option key={unit.name}>{unit.name}</option>
                              ))}
                            </Select>
                          </div>
                          <div className="grid gap-1">
                            <Label>السعر</Label>
                            <Input
                              type="number"
                              value={item.unitPrice}
                              disabled={!canEditPrice}
                              min="0"
                              onChange={(event) => updateLine(item.id, { unitPrice: Number(event.target.value) })}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-[1fr_120px] gap-3">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label="إنقاص">
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              className="w-20 text-center font-bold"
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(event) => updateQuantity(item.id, Number(event.target.value))}
                            />
                            <Button variant="outline" size="icon" onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label="زيادة">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="grid gap-1">
                            <Label>خصم الصنف</Label>
                            <Input
                              type="number"
                              min="0"
                              value={item.itemDiscount}
                              onChange={(event) => updateLine(item.id, { itemDiscount: Number(event.target.value) })}
                            />
                          </div>
                        </div>
                        <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 font-bold">
                          <span>صافي السطر</span>
                          <span>{formatCurrency(Math.max((item.unitPrice - item.itemDiscount) * item.quantity, 0))}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>خصم الفاتورة</Label>
                <Input type="number" value={invoiceDiscount} onChange={(event) => setInvoiceDiscount(Number(event.target.value))} min="0" />
              </div>
              <div className="grid gap-2">
                <Label>الضريبة</Label>
                <Select value={String(taxRate)} onChange={(event) => setTaxRate(Number(event.target.value))}>
                  {taxRates.map((rate) => (
                    <option key={rate.value} value={rate.value}>
                      {rate.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>خدمة</Label>
                <Input type="number" value={serviceFee} onChange={(event) => setServiceFee(Number(event.target.value))} min="0" />
              </div>
              <div className="grid gap-2">
                <Label>رسوم توصيل</Label>
                <Input type="number" value={deliveryFee} onChange={(event) => setDeliveryFee(Number(event.target.value))} min="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>طريقة الدفع</Label>
                <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                  {paymentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>الحالة</Label>
                <Select defaultValue="مدفوعة">
                  <option>مدفوعة</option>
                  <option>غير مدفوعة</option>
                  <option>جزئية</option>
                </Select>
              </div>
            </div>

            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="ملاحظات" />

            <TotalsBox
              subtotal={subtotal}
              itemDiscountTotal={itemDiscountTotal}
              invoiceDiscount={invoiceDiscount}
              serviceFee={serviceFee}
              deliveryFee={deliveryFee}
              taxTotal={taxTotal}
              total={total}
            />

            <SalesInventoryImpactPanel
              impact={inventoryImpact}
              salesLedger={salesLedger}
              onIssue={issueAndDeductInventory}
              canIssue={cart.length > 0}
            />

            <DigitalReceiptPanel
              receiptUrl={receiptUrl}
              customerName={customerName}
              organizationName={organization.name}
              total={total}
              enabled={digitalReceipt}
              onToggle={setDigitalReceipt}
            />

            <InvoiceTemplateCustomizer options={invoiceTemplateOptions} onChange={setInvoiceTemplateOptions} />

            <SplitBillPanel
              cart={cart}
              splitMode={splitMode}
              splitPeople={splitPeople}
              splitAssignments={splitAssignments}
              splitBills={splitBills}
              onModeChange={setSplitMode}
              onPeopleChange={setSplitPeople}
              onAssignItem={(itemId, personNumber) =>
                setSplitAssignments((current) => ({
                  ...current,
                  [itemId]: personNumber,
                }))
              }
              onPrint={printSplitBill}
            />

            <div className="grid grid-cols-2 gap-2">
              <Button className="col-span-2" onClick={printInvoice} disabled={cart.length === 0}>
                <Printer className="h-4 w-4" />
                طباعة فاتورة
              </Button>
              <Button className="col-span-2" type="button" variant="secondary" onClick={issueAndDeductInventory} disabled={cart.length === 0}>
                <Boxes className="h-4 w-4" />
                إصدار وخصم المخزون
              </Button>
              <Button type="button" variant="outline" onClick={suspendInvoice} disabled={cart.length === 0}>
                <PauseCircle className="h-4 w-4" />
                تعليق
              </Button>
              <Button type="button" variant="outline" onClick={makeReturn}>
                <RotateCcw className="h-4 w-4" />
                مرتجع
              </Button>
              <Button type="button" variant="outline" onClick={cancelInvoice}>
                <XCircle className="h-4 w-4" />
                إلغاء
              </Button>
              <Button type="button" variant="outline" onClick={closeShift}>
                <BadgePercent className="h-4 w-4" />
                إغلاق وردية
              </Button>
            </div>
          </CardContent>
        </Card>

        <HeldInvoices invoices={heldInvoices} onRestore={restoreInvoice} />
        <ShiftSummary shift={shift} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">معاينة القالب المختار</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto bg-slate-100 p-4">
            <InvoiceTemplateRenderer data={printableInvoice} options={invoiceTemplateOptions} />
          </CardContent>
        </Card>
      </aside>

      <div className="hidden print:block">
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

function ShiftSummary({ shift }: { shift: SalesShift }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">ملخص الوردية</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-muted-foreground">الكاشير</p>
          <p className="font-bold">{shift.cashierName}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-muted-foreground">رصيد افتتاحي</p>
          <p className="font-bold">{formatCurrency(shift.openingCash)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-muted-foreground">مبيعات نقدية</p>
          <p className="font-bold">{formatCurrency(shift.cashSales)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-muted-foreground">مبيعات بطاقة</p>
          <p className="font-bold">{formatCurrency(shift.cardSales)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-muted-foreground">مصروفات</p>
          <p className="font-bold">{formatCurrency(shift.expenses)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-muted-foreground">فرق الصندوق</p>
          <p className="font-bold">{formatCurrency(shift.difference)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
