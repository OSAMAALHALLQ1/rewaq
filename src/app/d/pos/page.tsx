"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, Minus, Trash2, CreditCard, Banknote,
  LogOut, Home, Monitor, ClipboardList, ChevronLeft,
  ChevronRight, X, Check, Percent, Tag, User, Wifi, WifiOff,
  ShoppingCart, Printer, RotateCcw, PauseCircle, PlayCircle,
  Lock, Unlock, Utensils, ShoppingBag, Bike, Wallet,
  Landmark, Smartphone, AlertTriangle, Receipt, Undo2, StickyNote,
  Clock, Shield, Settings as SettingsIcon, Save
} from "lucide-react";
import { PosReceipt, ReceiptDesign, DEFAULT_DESIGN, SAMPLE_RECEIPT } from "@/components/dashboard/pos-receipt";
import { getTableDetails, updateTableStatus } from "@/server/actions/tables";
import { includesNormalized } from "@/lib/search/match";
import {
  saveQueuedInvoice,
  getQueuedInvoices,
  deleteQueuedInvoice,
  saveSyncLog,
  getSyncLogs,
  clearSyncLogs,
  type SyncLogEntry
} from "@/lib/db/offline";

// ─────────────────── Types ───────────────────
type PayMethod = "cash" | "card" | "bank_transfer" | "delivery_app" | "receivable" | "wallet";

type PaymentLine = { method: PayMethod; amount: number };

type QueuedInvoice = {
  id: string;
  idempotencyKey: string;
  paymentMethod: PayMethod;
  customerName: string;
  notes?: string;
  discount: number;
  serviceFee: number;
  deliveryFee: number;
  payments?: PaymentLine[];
  items: Array<{ catalogItemId: string; quantity: number }>;
  total: number;
  timestamp: number;
};

type CartItem = {
  id: string;
  catalogItemId: string;
  name: string;
  price: number;
  taxRate: number;
  qty: number;
  discount: number; // % per item
  note?: string;
  selectedModifiers: ModifierOption[];
};

type OpenOrderDraft = {
  cart: CartItem[];
  customerName: string;
  orderType: OrderType;
  tableId: string | null;
  tableName: string;
  orderNotes: string;
  orderDiscount: number;
  serviceFee: number;
  deliveryFee: number;
};

type DeviceSession = {
  token: string;
  name: string;
  orgId: string;
  branchId: string;
  role: string;
};

type ModifierOption = {
  id: string;
  name: string;
  priceDelta: number;
  isDefault?: boolean;
};

type ModifierGroup = {
  id: string;
  name: string;
  selectionType: "single" | "multiple";
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  options: ModifierOption[];
};

type PosCatalogItem = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  taxRate: number;
  barcodes: string[];
  modifierGroups: ModifierGroup[];
};

type Shift = {
  id: string;
  status: string;
  cashierName: string;
  openingCash: number;
  actualCash: number | null;
  expectedCash: number;
  cashSales: number;
  cardSales: number;
  expenses: number;
  withdrawals: number;
  deposits: number;
  difference: number;
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
};

type PosSettings = {
  storeName: string;
  storeAddress: string;
  taxNumber: string;
  currency: string;
  currencySymbol: string;
  taxRate: number;
  receiptHeader: string | null;
  receiptFooter: string;
  maxCashierDiscount: number;
  allowCashierRefund: boolean;
  requireShift: boolean;
  printOnCheckout: boolean;
  receiptWidth: string;
};

type HeldOrder = {
  id: string;
  customerName: string;
  notes: string;
  items: Array<{ catalogItemId: string; name: string; price: number; qty: number; taxRate: number; discount: number }>;
  total: number;
  itemCount: number;
  heldAt: string;
};

type PosInvoice = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  status: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  taxTotal: number;
  total: number;
  issuedAt: string;
  shiftId: string | null;
};

type OrderType = "dine_in" | "takeaway" | "delivery";




const DEFAULT_SETTINGS: PosSettings = {
  storeName: "رواق",
  storeAddress: "",
  taxNumber: "",
  currency: "ILS",
  currencySymbol: "₪",
  taxRate: 0,
  receiptHeader: null,
  receiptFooter: "شكراً لتعاملكم معنا",
  maxCashierDiscount: 0,
  allowCashierRefund: false,
  requireShift: true,
  printOnCheckout: true,
  receiptWidth: "80mm",
};

const PAY_METHODS: Array<{ id: PayMethod; label: string; icon: any }> = [
  { id: "cash", label: "نقدي", icon: Banknote },
  { id: "card", label: "بطاقة", icon: CreditCard },
  { id: "bank_transfer", label: "تحويل بنكي", icon: Landmark },
  { id: "wallet", label: "محفظة", icon: Smartphone },
  { id: "receivable", label: "آجل / دين", icon: Wallet },
  { id: "delivery_app", label: "تطبيق توصيل", icon: Bike },
];

const PAY_LABEL: Record<string, string> = {
  cash: "نقدي", card: "بطاقة", bank_transfer: "تحويل بنكي",
  wallet: "محفظة", receivable: "آجل / دين", delivery_app: "تطبيق توصيل",
  split: "دفع مجزأ",
};

const ORDER_TYPES: Array<{ id: OrderType; label: string; icon: any }> = [
  { id: "takeaway", label: "سفري", icon: ShoppingBag },
  { id: "dine_in", label: "محلي", icon: Utensils },
  { id: "delivery", label: "توصيل", icon: Bike },
];

// ─────────────────── Component ───────────────────
export default function CashierPOSWorkspace() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  const [device, setDevice] = useState<DeviceSession>({ token: "", name: "", orgId: "", branchId: "", role: "" });
  const [authorized, setAuthorized] = useState(false);
  const [settings, setSettings] = useState<PosSettings>(DEFAULT_SETTINGS);

  // ── shift state ──
  const [shift, setShift] = useState<Shift | null>(null);
  const [shiftChecked, setShiftChecked] = useState(false);
  const [shiftBusy, setShiftBusy] = useState(false);
  const [openingCash, setOpeningCash] = useState("");
  const [closeShiftModal, setCloseShiftModal] = useState(false);
  const [actualCash, setActualCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [zReport, setZReport] = useState<any>(null);
  const [shiftError, setShiftError] = useState("");

  // ── sale state ──
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuItems, setMenuItems] = useState<PosCatalogItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("الكل");
  const [statusMessage, setStatusMessage] = useState("تحميل الأصناف...");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncQueue, setSyncQueue] = useState<QueuedInvoice[]>([]);
  const [showSyncLogPanel, setShowSyncLogPanel] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [tableId, setTableId] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [orderIndex, setOrderIndex] = useState(1);
  const [lastOrderIndex, setLastOrderIndex] = useState(1);
  const orderDrafts = useRef(new Map<number, OpenOrderDraft>());
  const [savedOrderIndexes, setSavedOrderIndexes] = useState<number[]>([]);
  const [customerName, setCustomerName] = useState("عميل سريع");
  const [showCustomerInput, setShowCustomerInput] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // ── order meta ──
  const [orderType, setOrderType] = useState<OrderType>("takeaway");
  const [tableName, setTableName] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [orderDiscount, setOrderDiscount] = useState(0); // مبلغ
  const [serviceFee, setServiceFee] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [showOrderDiscount, setShowOrderDiscount] = useState(false);
  const [orderDiscountInput, setOrderDiscountInput] = useState("");
  const [discountError, setDiscountError] = useState("");
  const [showFeesInput, setShowFeesInput] = useState(false);

  // ── item-level inputs ──
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [showItemNoteInput, setShowItemNoteInput] = useState(false);
  const [itemNoteInput, setItemNoteInput] = useState("");
  const [showQtyInput, setShowQtyInput] = useState(false);
  const [qtyInput, setQtyInput] = useState("");

  // ── payment modal ──
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentLine[]>([]);
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");
  const [payAmount, setPayAmount] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [splitMode, setSplitMode] = useState(false);

  // ── held orders ──
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [showHeldPanel, setShowHeldPanel] = useState(false);
  const [holdBusy, setHoldBusy] = useState(false);

  // ── orders (today invoices) view ──
  const [view, setView] = useState<"sale" | "orders">("sale");
  const [todayInvoices, setTodayInvoices] = useState<PosInvoice[]>([]);
  const [todaySales, setTodaySales] = useState(0);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [refundTarget, setRefundTarget] = useState<PosInvoice | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundError, setRefundError] = useState("");

  // ── lock screen ──
  const [locked, setLocked] = useState(false);

  // ── add dish modal ──
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", price: "", cost: "", category: "", taxRate: "", unit: "", barcode: "" });
  const [linkInventory, setLinkInventory] = useState(true);
  const [addItemBusy, setAddItemBusy] = useState(false);
  const [addItemError, setAddItemError] = useState("");

  // ── modifier picker modal ──
  const [modifierTarget, setModifierTarget] = useState<PosCatalogItem | null>(null);
  const [modifierSelections, setModifierSelections] = useState<Record<string, string[]>>({});
  const [modifierError, setModifierError] = useState("");

  // ── settings modal ──
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"design" | "system">("design");
  const [design, setDesign] = useState<ReceiptDesign>(DEFAULT_DESIGN);
  const [sysForm, setSysForm] = useState<PosSettings>(DEFAULT_SETTINGS);
  const [sysBusy, setSysBusy] = useState(false);
  const [sysMsg, setSysMsg] = useState("");

  const isManager = device.role === "manager";
  const cur = settings.currencySymbol;

  const currentDate = new Date().toLocaleDateString("ar-PS", {
    year: "numeric", month: "2-digit", day: "2-digit"
  });
  const currentTime = new Date().toLocaleTimeString("ar-PS", {
    hour: "2-digit", minute: "2-digit"
  });

  const apiHeaders = useCallback((token?: string) => ({
    "content-type": "application/json",
    "x-department-key": token ?? device.token,
  }), [device.token]);

  // الأصناف التي يضيفها الكاشير تبقى محفوظة محليًا وتظهر دائمًا (مرتبطة بالكتالوج)
  const EXTRA_CATALOG_KEY = "rwq_pos_catalog_extra";
  const loadExtraCatalog = (): PosCatalogItem[] => {
    try {
      const raw = localStorage.getItem(EXTRA_CATALOG_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  };
  const saveExtraCatalog = (item: PosCatalogItem) => {
    const list = loadExtraCatalog();
    if (!list.find((i) => i.id === item.id)) {
      list.push(item);
      localStorage.setItem(EXTRA_CATALOG_KEY, JSON.stringify(list));
    }
  };
  const mergeExtraCatalog = (items: PosCatalogItem[]): PosCatalogItem[] => {
    const map = new Map<string, PosCatalogItem>();
    for (const i of items) map.set(i.id, i);
    for (const i of loadExtraCatalog()) if (!map.has(i.id)) map.set(i.id, i);
    return Array.from(map.values());
  };

  // ── Online/offline tracking ──
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    getQueuedInvoices().then(setSyncQueue);
    getSyncLogs().then(setSyncLogs);
    const dz = localStorage.getItem("rwq_receipt_design");
    if (dz) { try { setDesign({ ...DEFAULT_DESIGN, ...JSON.parse(dz) }); } catch { } }
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => { if (isOnline && syncQueue.length > 0) syncPendingInvoices(); }, [isOnline, syncQueue.length]);

  const syncPendingInvoices = async () => {
    if (checkoutBusy || syncQueue.length === 0) return;
    setCheckoutBusy(true);
    const activeQueue = [...syncQueue];
    const failed: QueuedInvoice[] = [];
    
    for (const inv of activeQueue) {
      try {
        const r = await fetch("/api/department/pos/checkout", {
          method: "POST",
          headers: apiHeaders(),
          body: JSON.stringify({
            paymentMethod: inv.paymentMethod, customerName: inv.customerName,
            notes: inv.notes, idempotencyKey: inv.idempotencyKey, items: inv.items,
            discount: inv.discount, serviceFee: inv.serviceFee, deliveryFee: inv.deliveryFee,
            payments: inv.payments,
          }),
        });
        const p = await r.json().catch(() => ({}));
        
        if (r.ok && p.success) {
          await deleteQueuedInvoice(inv.id);
          await saveSyncLog({
            id: inv.id,
            idempotencyKey: inv.idempotencyKey,
            customerName: inv.customerName,
            total: inv.total,
            timestamp: Date.now(),
            status: "success",
            message: `فاتورة ${p.invoiceNumber} تمت مزامنتها بنجاح`,
          });
        } else {
          if (r.status === 409 || r.status === 400) {
            await deleteQueuedInvoice(inv.id);
            await saveSyncLog({
              id: inv.id,
              idempotencyKey: inv.idempotencyKey,
              customerName: inv.customerName,
              total: inv.total,
              timestamp: Date.now(),
              status: "conflict",
              message: p.error || "تعارض في البيانات أو انتهاء الوردية - تم الرفض",
            });
          } else {
            failed.push(inv);
            await saveSyncLog({
              id: inv.id,
              idempotencyKey: inv.idempotencyKey,
              customerName: inv.customerName,
              total: inv.total,
              timestamp: Date.now(),
              status: "failed",
              message: p.error || `فشل في المزامنة (كود الخطأ: ${r.status})`,
            });
          }
        }
      } catch (err: any) {
        failed.push(inv);
        await saveSyncLog({
          id: inv.id,
          idempotencyKey: inv.idempotencyKey,
          customerName: inv.customerName,
          total: inv.total,
          timestamp: Date.now(),
          status: "failed",
          message: err.message || "فشل الاتصال بالخادم",
        });
      }
    }
    
    setSyncQueue(failed);
    const logs = await getSyncLogs();
    setSyncLogs(logs);
    setCheckoutBusy(false);
    setStatusMessage(failed.length === 0 ? "تمت المزامنة" : `${failed.length} فواتير معلقة`);
  };

  // ── Auth, settings, shift & catalog load ──
  useEffect(() => {
    const token = localStorage.getItem("rwq_dept_key");
    const role = localStorage.getItem("rwq_dept_role");
    const allowed = JSON.parse(localStorage.getItem("rwq_dept_allowed") || "[]");
    if (!token || !allowed.includes("pos")) { router.push("/d/gate"); return; }
    const d = {
      token, role: role ?? "",
      orgId: localStorage.getItem("rwq_dept_org_id") ?? "",
      branchId: localStorage.getItem("rwq_dept_branch_id") ?? "",
      name: localStorage.getItem("rwq_dept_device") ?? "كاشير",
    };
    setDevice(d);
    setAuthorized(true);

    // settings
    fetch("/api/department/pos/settings", { headers: { "x-department-key": token } })
      .then(async (r) => {
        const p = await r.json();
        if (r.ok && p.success && p.settings) setSettings({ ...DEFAULT_SETTINGS, ...p.settings });
      })
      .catch(() => { });

    // active shift
    fetch("/api/department/pos/shift", { headers: { "x-department-key": token } })
      .then(async (r) => {
        const p = await r.json();
        if (r.ok && p.success) setShift(p.activeShift ?? null);
      })
      .catch(() => { })
      .finally(() => setShiftChecked(true));

    // catalog
    fetch("/api/department/pos/catalog", { headers: { "x-department-key": token } })
        .then(async (r) => {
          const p = await r.json();
          if (!r.ok || !p.success) throw new Error(p.error || "تعذر تحميل الكتالوج");
          setMenuItems(mergeExtraCatalog(p.items ?? []));
          setStatusMessage(p.items?.length ? `${p.items.length} صنف متاح` : "لا توجد أصناف");
        })
      .catch((e) => setStatusMessage(e instanceof Error ? e.message : "خطأ في التحميل"));

    // held orders
    fetch("/api/department/pos/hold", { headers: { "x-department-key": token } })
      .then(async (r) => {
        const p = await r.json();
        if (r.ok && p.success) setHeldOrders(p.orders ?? []);
      })
      .catch(() => { });
  }, [router]);

  // Load table from query parameters on mount
  useEffect(() => {
    if (menuItems.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const tableIdParam = params.get("tableId");
    if (!tableIdParam) return;

    getTableDetails(tableIdParam).then((res) => {
      if (res && res.success && res.table) {
        setTableId(res.table.id);
        setTableName(String(res.table.number));
        setCustomerName(res.table.waiterName ? `طاولة ${res.table.number} - الجرسون ${res.table.waiterName}` : `طاولة ${res.table.number}`);
        setOrderType("dine_in");

        if (res.table.orderItems && res.table.orderItems.length > 0) {
          const loadedCart: CartItem[] = [];
          for (const item of res.table.orderItems) {
            const catalogItem = menuItems.find(m => m.name === item.name);
            if (catalogItem) {
              loadedCart.push({
                id: `cart-${catalogItem.id}-${Date.now()}-${Math.random()}`,
                catalogItemId: catalogItem.id,
                name: catalogItem.name,
                price: catalogItem.price,
                qty: item.quantity,
                taxRate: catalogItem.taxRate || 0,
                discount: 0,
                selectedModifiers: [],
              });
            }
          }
          if (loadedCart.length > 0) {
            setCart(loadedCart);
          }
        }
      }
    });
  }, [menuItems]);

  // ─────────────────── Shift actions ───────────────────
  const refreshShift = async () => {
    try {
      const r = await fetch("/api/department/pos/shift", { headers: apiHeaders() });
      const p = await r.json();
      if (r.ok && p.success) setShift(p.activeShift ?? null);
    } catch { }
  };

  const handleOpenShift = async () => {
    if (shiftBusy) return;
    setShiftBusy(true); setShiftError("");
    try {
      const r = await fetch("/api/department/pos/shift", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ action: "open", openingCash: parseFloat(openingCash) || 0, cashierName: device.name }),
      });
      const p = await r.json();
      if (!r.ok || !p.success) throw new Error(p.error || "تعذر فتح الوردية");
      setShift(p.shift);
      setOpeningCash("");
    } catch (e) {
      setShiftError(e instanceof Error ? e.message : "تعذر فتح الوردية");
      // قد تكون هناك وردية مفتوحة بالفعل — أعد التحقق
      refreshShift();
    } finally { setShiftBusy(false); }
  };

  const handleCloseShift = async () => {
    if (!shift || shiftBusy) return;
    setShiftBusy(true); setShiftError("");
    try {
      const r = await fetch("/api/department/pos/shift", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ action: "close", shiftId: shift.id, actualCash: parseFloat(actualCash) || 0, notes: closeNotes || undefined }),
      });
      const p = await r.json();
      if (!r.ok || !p.success) throw new Error(p.error || "تعذر إغلاق الوردية");
      setZReport(p.shift ?? p);
      setShift(null);
      setCloseShiftModal(false);
      setActualCash(""); setCloseNotes("");
    } catch (e) {
      setShiftError(e instanceof Error ? e.message : "تعذر إغلاق الوردية");
    } finally { setShiftBusy(false); }
  };

  // ─────────────────── Cart helpers ───────────────────
  const handleAddToCart = (item: PosCatalogItem) => {
    // items with modifiers open the picker; otherwise add directly
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      openModifierPicker(item);
      return;
    }
    setCart((prev) => {
      const ex = prev.find((i) => i.id === item.id);
      if (ex) return prev.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: item.id, catalogItemId: item.id, name: item.name, price: item.price, taxRate: item.taxRate, qty: 1, discount: 0, selectedModifiers: [] }];
    });
    setSelectedItemId(item.id);
  };

  const openModifierPicker = (item: PosCatalogItem) => {
    const initial: Record<string, string[]> = {};
    for (const g of item.modifierGroups) {
      const def = g.options.filter((o) => o.isDefault).map((o) => o.id);
      initial[g.id] = def;
    }
    setModifierTarget(item);
    setModifierSelections(initial);
    setModifierError("");
  };

  const toggleModifierOption = (groupId: string, optionId: string, multiple: boolean, max: number) => {
    setModifierSelections((prev) => {
      const cur = prev[groupId] ?? [];
      if (multiple) {
        if (cur.includes(optionId)) return { ...prev, [groupId]: cur.filter((id) => id !== optionId) };
        if (cur.length >= max) return prev;
        return { ...prev, [groupId]: [...cur, optionId] };
      }
      return { ...prev, [groupId]: cur.includes(optionId) ? [] : [optionId] };
    });
  };

  const modifierPriceDelta = (item: PosCatalogItem) => {
    let delta = 0;
    for (const g of item.modifierGroups) {
      for (const optId of modifierSelections[g.id] ?? []) {
        const opt = g.options.find((o) => o.id === optId);
        if (opt) delta += opt.priceDelta;
      }
    }
    return delta;
  };

  const confirmModifiers = () => {
    if (!modifierTarget) return;
    // validate required / min / max
    for (const g of modifierTarget.modifierGroups) {
      const sel = (modifierSelections[g.id] ?? []).length;
      if (g.isRequired && sel < Math.max(1, g.minSelect)) {
        setModifierError(`يجب اختيار ${g.name} على الأقل`);
        return;
      }
      if (sel < g.minSelect || sel > g.maxSelect) {
        setModifierError(`عدد اختيارات ${g.name} غير صحيح (من ${g.minSelect} إلى ${g.maxSelect})`);
        return;
      }
    }
    const selected: ModifierOption[] = [];
    for (const g of modifierTarget.modifierGroups) {
      for (const optId of modifierSelections[g.id] ?? []) {
        const opt = g.options.find((o) => o.id === optId);
        if (opt) selected.push(opt);
      }
    }
    setCart((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        catalogItemId: modifierTarget.id,
        name: modifierTarget.name,
        price: modifierTarget.price,
        taxRate: modifierTarget.taxRate,
        qty: 1,
        discount: 0,
        selectedModifiers: selected,
      },
    ]);
    setSelectedItemId(modifierTarget.id);
    setModifierTarget(null);
    setModifierSelections({});
    setModifierError("");
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter((i) => i.qty > 0));
  };

  const removeItem = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id));

  const resetOrder = () => {
    setCart([]); setSelectedItemId(null);
    setOrderDiscount(0); setServiceFee(0); setDeliveryFee(0);
    setOrderNotes(""); setTableId(null); setTableName("");
    setCustomerName("عميل سريع");
    setPayments([]); setCashReceived(""); setPayAmount(""); setSplitMode(false);
  };

  const saveCurrentOrderDraft = () => {
    orderDrafts.current.set(orderIndex, {
      cart,
      customerName,
      orderType,
      tableId,
      tableName,
      orderNotes,
      orderDiscount,
      serviceFee,
      deliveryFee,
    });
    setSavedOrderIndexes(Array.from(orderDrafts.current.keys()).sort((a, b) => a - b));
  };

  const restoreOrderDraft = (draft: OpenOrderDraft) => {
    setCart(draft.cart);
    setSelectedItemId(null);
    setCustomerName(draft.customerName);
    setOrderType(draft.orderType);
    setTableId(draft.tableId);
    setTableName(draft.tableName);
    setOrderNotes(draft.orderNotes);
    setOrderDiscount(draft.orderDiscount);
    setServiceFee(draft.serviceFee);
    setDeliveryFee(draft.deliveryFee);
    setPayments([]); setCashReceived(""); setPayAmount(""); setSplitMode(false);
  };

  const startNextOrder = (saveCurrent = true) => {
    if (saveCurrent) saveCurrentOrderDraft();
    else {
      orderDrafts.current.delete(orderIndex);
      setSavedOrderIndexes(Array.from(orderDrafts.current.keys()).sort((a, b) => a - b));
    }
    const nextIndex = lastOrderIndex + 1;
    resetOrder();
    setOrderIndex(nextIndex);
    setLastOrderIndex(nextIndex);
  };

  const navigateOrder = (targetIndex: number) => {
    if (targetIndex === orderIndex) return;
    const draft = orderDrafts.current.get(targetIndex);
    if (!draft) return;
    saveCurrentOrderDraft();
    restoreOrderDraft(draft);
    setOrderIndex(targetIndex);
  };

  const selectedItem = cart.find((i) => i.id === selectedItemId);

  const lineUnitPrice = (item: CartItem) =>
    item.price + item.selectedModifiers.reduce((s, m) => s + m.priceDelta, 0);
  const itemGross = (item: CartItem) => lineUnitPrice(item) * item.qty;
  const itemNet = (item: CartItem) => itemGross(item) * (1 - item.discount / 100);
  const itemTax = (item: CartItem) => itemNet(item) * (item.taxRate / 100);

  const subtotal = cart.reduce((s, i) => s + itemGross(i), 0);
  const itemDiscounts = cart.reduce((s, i) => s + (itemGross(i) - itemNet(i)), 0);
  const discountTotal = itemDiscounts + orderDiscount;
  const totalTax = cart.reduce((s, i) => s + itemTax(i), 0);
  const total = Math.max(0, subtotal - discountTotal + totalTax + serviceFee + deliveryFee);

  const paidSoFar = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, +(total - paidSoFar).toFixed(2));
  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const change = cashReceivedNum - total;

  // حد الخصم المسموح للكاشير (نسبة من المجموع الفرعي)
  const discountPct = subtotal > 0 ? (discountTotal / subtotal) * 100 : 0;
  const discountAllowed = isManager || discountPct <= settings.maxCashierDiscount + 0.001;

  // ── Item-level actions (respect cashier limit) ──
  const applyItemDiscount = () => {
    const d = parseFloat(discountInput);
    if (!isNaN(d) && selectedItemId) {
      const clamped = Math.min(100, Math.max(0, d));
      if (!isManager && clamped > settings.maxCashierDiscount) {
        setDiscountError(`حد خصم الكاشير ${settings.maxCashierDiscount}% — يتطلب مديرًا`);
        setShowDiscountInput(false); setDiscountInput("");
        return;
      }
      setCart((prev) => prev.map((i) => i.id === selectedItemId ? { ...i, discount: clamped } : i));
      setDiscountError("");
    }
    setShowDiscountInput(false);
    setDiscountInput("");
  };

  const applyOrderDiscount = () => {
    const d = parseFloat(orderDiscountInput);
    if (!isNaN(d) && d >= 0) {
      const amount = Math.min(subtotal, d);
      const pct = subtotal > 0 ? ((itemDiscounts + amount) / subtotal) * 100 : 0;
      if (!isManager && pct > settings.maxCashierDiscount + 0.001) {
        setDiscountError(`حد خصم الكاشير ${settings.maxCashierDiscount}% — يتطلب مديرًا`);
        setShowOrderDiscount(false); setOrderDiscountInput("");
        return;
      }
      setOrderDiscount(amount);
      setDiscountError("");
    }
    setShowOrderDiscount(false);
    setOrderDiscountInput("");
  };

  const applyItemNote = () => {
    if (selectedItemId) {
      setCart((prev) => prev.map((i) => i.id === selectedItemId ? { ...i, note: itemNoteInput.trim() || undefined } : i));
    }
    setShowItemNoteInput(false); setItemNoteInput("");
  };

  const applyQty = () => {
    const q = parseInt(qtyInput, 10);
    if (!isNaN(q) && selectedItemId) {
      if (q <= 0) removeItem(selectedItemId);
      else setCart((prev) => prev.map((i) => i.id === selectedItemId ? { ...i, qty: q } : i));
    }
    setShowQtyInput(false); setQtyInput("");
  };

  // ─────────────────── Add dish ───────────────────
  const handleAddItem = async () => {
    if (addItemBusy) return;
    setAddItemBusy(true); setAddItemError("");
    try {
      const r = await fetch("/api/department/pos/catalog", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          name: newItem.name.trim(),
          price: parseFloat(newItem.price) || 0,
          cost: parseFloat(newItem.cost) || 0,
          category: newItem.category.trim() || undefined,
          unit: newItem.unit.trim() || undefined,
          taxRate: parseFloat(newItem.taxRate) || 0,
          barcode: newItem.barcode.trim() || undefined,
          linkInventory,
        }),
      });
      const p = await r.json();
      if (!r.ok || !p.success) throw new Error(p.error || "تعذر إضافة الصنف");
      const fullItem: PosCatalogItem = { ...p.item, modifierGroups: [] };
      saveExtraCatalog(fullItem);
      setMenuItems((prev) => [...prev, fullItem]);
      handleAddToCart(fullItem);
      setShowAddItem(false);
      setNewItem({ name: "", price: "", cost: "", category: "", taxRate: "", unit: "", barcode: "" });
      setStatusMessage(`✓ أُضيف الصنف ${p.item.name}`);
    } catch (e) {
      setAddItemError(e instanceof Error ? e.message : "تعذر إضافة الصنف");
    } finally { setAddItemBusy(false); }
  };

  // ─────────────────── Settings ───────────────────
  const updateDesign = (patch: Partial<ReceiptDesign>) => {
    setDesign((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("rwq_receipt_design", JSON.stringify(next));
      return next;
    });
  };

  const openSettings = () => {
    setSysForm(settings);
    setSysMsg("");
    setSettingsTab("design");
    setShowSettings(true);
  };

  const saveSystemSettings = async () => {
    if (sysBusy) return;
    setSysBusy(true); setSysMsg("");
    try {
      const r = await fetch("/api/department/pos/settings", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          currency: sysForm.currency,
          taxRate: sysForm.taxRate,
          receiptHeader: sysForm.receiptHeader ?? "",
          receiptFooter: sysForm.receiptFooter,
          maxCashierDiscount: sysForm.maxCashierDiscount,
          allowCashierRefund: sysForm.allowCashierRefund,
          requireShift: sysForm.requireShift,
          printOnCheckout: sysForm.printOnCheckout,
          receiptWidth: sysForm.receiptWidth as "58mm" | "80mm",
        }),
      });
      const p = await r.json();
      if (!r.ok || !p.success) throw new Error(p.error || "تعذر حفظ الإعدادات");
      setSettings({ ...DEFAULT_SETTINGS, ...p.settings });
      setSysMsg("✓ تم حفظ إعدادات النظام");
    } catch (e) {
      setSysMsg(e instanceof Error ? e.message : "تعذر حفظ الإعدادات");
    } finally { setSysBusy(false); }
  };

  // ─────────────────── Hold orders ───────────────────
  const handleHold = async () => {
    if (cart.length === 0 || holdBusy) return;
    setHoldBusy(true);
    try {
      const noteParts = [orderNotes, tableName ? `طاولة: ${tableName}` : "", ORDER_TYPES.find(t => t.id === orderType)?.label ?? ""].filter(Boolean);
      const r = await fetch("/api/department/pos/hold", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          customerName,
          notes: noteParts.join(" · "),
          items: cart.map((i) => ({ catalogItemId: i.catalogItemId, name: i.name, price: i.price, qty: i.qty, taxRate: i.taxRate, discount: i.discount })),
        }),
      });
      const p = await r.json();
      if (!r.ok || !p.success) throw new Error(p.error || "تعذر تعليق الطلب");
      setHeldOrders((prev) => [...prev, p.order]);
      startNextOrder(false);
      setStatusMessage("✓ تم تعليق الطلب");
    } catch (e) {
      setStatusMessage(e instanceof Error ? e.message : "تعذر تعليق الطلب");
    } finally { setHoldBusy(false); }
  };

  const recallHeld = async (order: HeldOrder) => {
    if (cart.length > 0 && !confirm("سيتم استبدال السلة الحالية بالطلب المعلق. متابعة؟")) return;
    try {
      await fetch(`/api/department/pos/hold?id=${encodeURIComponent(order.id)}`, {
        method: "DELETE", headers: apiHeaders(),
      });
      setHeldOrders((prev) => prev.filter((o) => o.id !== order.id));
      setCart(order.items.map((i) => ({
        id: i.catalogItemId, catalogItemId: i.catalogItemId, name: i.name,
        price: i.price, taxRate: i.taxRate, qty: i.qty, discount: i.discount,
        selectedModifiers: [],
      })));
      setCustomerName(order.customerName || "عميل سريع");
      setShowHeldPanel(false);
      setStatusMessage("✓ تم استرجاع الطلب المعلق");
    } catch {
      setStatusMessage("تعذر استرجاع الطلب");
    }
  };

  const deleteHeld = async (id: string) => {
    if (!confirm("حذف الطلب المعلق نهائيًا؟")) return;
    try {
      await fetch(`/api/department/pos/hold?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: apiHeaders() });
      setHeldOrders((prev) => prev.filter((o) => o.id !== id));
    } catch { }
  };

  // ─────────────────── Today invoices & refund ───────────────────
  const loadInvoices = async () => {
    setInvoicesLoading(true);
    try {
      const r = await fetch("/api/department/pos/invoices", { headers: apiHeaders() });
      const p = await r.json();
      if (r.ok && p.success) {
        setTodayInvoices(p.invoices ?? []);
        setTodaySales(Number(p.totalSales ?? 0));
      }
    } catch { }
    setInvoicesLoading(false);
  };

  useEffect(() => { if (view === "orders" && authorized) loadInvoices(); }, [view, authorized]);

  const canRefund = isManager || settings.allowCashierRefund;
  const previousOrderIndex = [...savedOrderIndexes].reverse().find((index) => index < orderIndex);
  const nextOpenOrderIndex = savedOrderIndexes.find((index) => index > orderIndex);

  const handleRefund = async () => {
    if (!refundTarget || refundBusy) return;
    if (refundReason.trim().length < 2) { setRefundError("سبب الإرجاع مطلوب"); return; }
    setRefundBusy(true); setRefundError("");
    try {
      const r = await fetch("/api/department/pos/refund", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ invoiceId: refundTarget.id, reason: refundReason.trim() }),
      });
      const p = await r.json();
      if (!r.ok || !p.success) throw new Error(p.error || "تعذر تنفيذ المرتجع");
      setRefundTarget(null); setRefundReason("");
      loadInvoices();
      setStatusMessage(`✓ مرتجع ${p.refundNumber ?? ""}`);
    } catch (e) {
      setRefundError(e instanceof Error ? e.message : "تعذر تنفيذ المرتجع");
    } finally { setRefundBusy(false); }
  };

  // ─────────────────── Categories ───────────────────
  const categories = ["الكل", ...Array.from(new Set(menuItems.map((i) => i.category).filter(Boolean)))];
  const filteredItems = menuItems.filter((item) => {
    const matchCat = activeCategory === "الكل" || item.category === activeCategory;
    const matchSearch = includesNormalized(searchQuery, [item.name, item.code, ...(item.barcodes ?? [])]);
    return matchCat && matchSearch;
  });

  // ─────────────────── Payment & checkout ───────────────────
  const openPayment = () => {
    if (cart.length === 0) return;
    if (!discountAllowed) {
      setDiscountError(`إجمالي الخصم يتجاوز حد الكاشير (${settings.maxCashierDiscount}%) — يتطلب مديرًا`);
      return;
    }
    setPayments([]); setPayAmount(""); setCashReceived(""); setPayMethod("cash"); setSplitMode(false);
    setPaymentOpen(true);
  };

  const addPaymentLine = () => {
    const amt = Math.min(parseFloat(payAmount) || 0, remaining);
    if (amt <= 0) return;
    setPayments((prev) => {
      const ex = prev.find((p) => p.method === payMethod);
      if (ex) return prev.map((p) => p.method === payMethod ? { ...p, amount: +(p.amount + amt).toFixed(2) } : p);
      return [...prev, { method: payMethod, amount: +amt.toFixed(2) }];
    });
    setPayAmount("");
  };

  const removePaymentLine = (method: PayMethod) => setPayments((prev) => prev.filter((p) => p.method !== method));

  const buildOrderNote = () => {
    const parts = [
      ORDER_TYPES.find((t) => t.id === orderType)?.label ?? "",
      tableName ? `طاولة ${tableName}` : "",
      orderNotes,
      ...cart.filter((i) => i.note).map((i) => `${i.name}: ${i.note}`),
    ].filter(Boolean);
    return parts.join(" · ").slice(0, 300) || undefined;
  };

  const handleCheckout = async (opts: { method: PayMethod; splitPayments?: PaymentLine[] }) => {
    if (cart.length === 0 || checkoutBusy) return;
    const idempotencyKey = crypto.randomUUID();
    const invoiceTotal = total;
    const payloadBody = {
      paymentMethod: opts.method,
      customerName,
      notes: buildOrderNote(),
      idempotencyKey,
      items: cart.map((i) => ({
        catalogItemId: i.catalogItemId,
        quantity: i.qty,
        unitPrice: +lineUnitPrice(i).toFixed(2),
        modifierOptionIds: i.selectedModifiers.map((m) => m.id),
        modifierSummary: i.selectedModifiers.map((m) => m.name).join(" + ") || undefined,
      })),
      discount: +discountTotal.toFixed(2),
      serviceFee: +serviceFee.toFixed(2),
      deliveryFee: +deliveryFee.toFixed(2),
      payments: opts.splitPayments && opts.splitPayments.length > 1 ? opts.splitPayments : undefined,
    };
    const receipt = {
      invoiceNumber: "PENDING-" + idempotencyKey.slice(0, 6).toUpperCase(),
      date: new Date().toLocaleString("ar-PS"),
      cashier: device.name,
      customer: customerName,
      orderType: ORDER_TYPES.find((t) => t.id === orderType)?.label ?? "",
      table: tableName,
      items: cart,
      subtotal,
      discount: discountTotal,
      serviceFee,
      deliveryFee,
      tax: totalTax,
      total: invoiceTotal,
      method: opts.splitPayments && opts.splitPayments.length > 1 ? "دفع مجزأ" : (PAY_LABEL[opts.method] ?? opts.method),
      paymentLines: opts.splitPayments,
      cashReceived: opts.method === "cash" && cashReceivedNum > 0 ? cashReceivedNum : null,
      change: opts.method === "cash" && cashReceivedNum > 0 ? change : null,
    };

    const queueIt = async () => {
      const qi: QueuedInvoice = { id: crypto.randomUUID(), ...payloadBody, total: invoiceTotal, timestamp: Date.now() } as QueuedInvoice;
      await saveQueuedInvoice(qi);
      const nq = [...syncQueue, qi];
      setSyncQueue(nq);
      await saveSyncLog({
        id: qi.id,
        idempotencyKey: qi.idempotencyKey,
        customerName: qi.customerName,
        total: qi.total,
        timestamp: qi.timestamp,
        status: "failed",
        message: "تم الحفظ محلياً في وضع عدم الاتصال",
      });
      const logs = await getSyncLogs();
      setSyncLogs(logs);
    };

    const finishSale = () => {
      startNextOrder(false);
      setPaymentOpen(false);
      setTableId(null);
      setTableName("");
      if (settings.printOnCheckout) setTimeout(() => window.print(), 400);
    };

    if (!isOnline) {
      await queueIt();
      if (tableId) {
        await updateTableStatus(tableId, "available");
      }
      setLastReceipt(receipt);
      finishSale();
      return;
    }

    try {
      setCheckoutBusy(true);
      const r = await fetch("/api/department/pos/checkout", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify(payloadBody),
      });
      const p = await r.json();
      if (!r.ok || !p.success) throw new Error(p.error || "تعذر إصدار الفاتورة");
      setStatusMessage(`✓ فاتورة ${p.invoiceNumber}`);
      setLastReceipt({ ...receipt, invoiceNumber: p.invoiceNumber });
      if (tableId) {
        await updateTableStatus(tableId, "available");
      }
      finishSale();
    } catch (err) {
      // فشل التحقق من الوردية أو الخصم يجب ألا يذهب لقائمة الأوفلاين
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("وردية")) {
        setStatusMessage(msg);
        setPaymentOpen(false);
        refreshShift();
      } else {
        await queueIt();
        if (tableId) {
          await updateTableStatus(tableId, "available");
        }
        setLastReceipt(receipt);
        finishSale();
      }
    } finally { setCheckoutBusy(false); }
  };

  const confirmPayment = () => {
    if (splitMode) {
      if (remaining > 0.009 || payments.length === 0) return;
      handleCheckout({ method: payments[0].method, splitPayments: payments });
    } else {
      handleCheckout({ method: payMethod });
    }
  };

  const handleLogout = () => {
    ["rwq_dept_key", "rwq_dept_role", "rwq_dept_org_id", "rwq_dept_branch_id", "rwq_dept_allowed", "rwq_dept_device"].forEach((k) => localStorage.removeItem(k));
    document.cookie = "rwq_dept_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/d/gate");
  };

  if (!authorized) return null;

  // ═══════════════════ SHIFT GATE ═══════════════════
  const needShiftGate = settings.requireShift && shiftChecked && !shift;

  if (needShiftGate) {
    return (
      <div dir="rtl" className="h-screen flex items-center justify-center bg-[#F4F7FB] text-gray-900 select-none">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
          <div className="bg-[#1445D1] text-white px-6 py-5">
            <h1 className="font-bold text-lg flex items-center gap-2"><Clock className="h-5 w-5" /> فتح وردية جديدة</h1>
            <p className="text-xs text-white/60 mt-1">{settings.storeName} · {device.name} · {currentDate}</p>
          </div>
          <div className="p-6 space-y-4">
            {zReport && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs space-y-1.5">
                <p className="font-bold text-sm text-[#1445D1] mb-2 flex items-center gap-1.5"><Receipt className="h-4 w-4" /> ملخص الوردية السابقة (Z)</p>
                <div className="flex justify-between"><span className="text-gray-500">مبيعات نقدية:</span><span className="font-semibold">{cur} {Number(zReport.cashSales ?? 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">مبيعات بطاقة:</span><span className="font-semibold">{cur} {Number(zReport.cardSales ?? 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">النقدي المتوقع:</span><span className="font-semibold">{cur} {Number(zReport.expectedCash ?? 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">النقدي الفعلي:</span><span className="font-semibold">{cur} {Number(zReport.actualCash ?? 0).toFixed(2)}</span></div>
                <div className={`flex justify-between font-bold border-t border-gray-200 pt-1.5 mt-1 ${Number(zReport.difference ?? 0) < 0 ? "text-red-600" : "text-green-700"}`}>
                  <span>الفرق:</span><span>{cur} {Number(zReport.difference ?? 0).toFixed(2)}</span>
                </div>
              </div>
            )}
            <div>
              <label className="text-sm text-gray-600 mb-1.5 block font-medium">رصيد بداية الصندوق</label>
              <input
                autoFocus
                type="number"
                inputMode="decimal"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleOpenShift()}
                placeholder="0.00"
                className="w-full h-14 border-2 border-gray-200 rounded-xl px-4 text-right text-2xl font-bold focus:outline-none focus:border-[#1445D1] transition-colors"
              />
              <div className="grid grid-cols-4 gap-2 mt-2">
                {[100, 200, 500, 1000].map((v) => (
                  <button key={v} onClick={() => setOpeningCash(String(v))}
                    className="h-11 border border-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-50 hover:border-[#1445D1]/30 transition-colors">
                    {cur}{v}
                  </button>
                ))}
              </div>
            </div>
            {shiftError && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2.5">{shiftError}</p>}
            <button
              onClick={handleOpenShift}
              disabled={shiftBusy}
              className="w-full h-14 rounded-xl bg-[#1E5EFF] hover:bg-[#1445D1] disabled:bg-gray-300 text-white text-base font-bold transition-colors flex items-center justify-center gap-2"
            >
              {shiftBusy ? <RotateCcw className="h-5 w-5 animate-spin" /> : <><Unlock className="h-5 w-5" /> فتح الوردية وبدء البيع</>}
            </button>
            <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
              <button onClick={() => router.push("/dashboard")} className="hover:text-[#1445D1] flex items-center gap-1"><Home className="h-3.5 w-3.5" /> الرئيسية</button>
              <button onClick={handleLogout} className="hover:text-red-500 flex items-center gap-1"><LogOut className="h-3.5 w-3.5" /> تسجيل خروج</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════ LOCK SCREEN ═══════════════════
  if (locked) {
    return (
      <div dir="rtl" className="h-screen flex flex-col items-center justify-center bg-[#1445D1] select-none text-white gap-6">
        <Lock className="h-16 w-16 text-white/40" />
        <div className="text-center">
          <p className="text-xl font-bold">{settings.storeName} — الشاشة مقفلة</p>
          <p className="text-sm text-white/50 mt-1">{device.name} · {currentDate}</p>
        </div>
        <button
          onClick={() => setLocked(false)}
          className="h-14 px-10 rounded-xl bg-white text-[#1445D1] font-bold text-base hover:bg-gray-100 transition-colors flex items-center gap-2"
        >
          <Unlock className="h-5 w-5" /> فتح الشاشة
        </button>
      </div>
    );
  }

  // ─────────────────── RENDER ───────────────────
  return (
    <div dir="rtl" className="h-screen flex flex-col overflow-hidden bg-[#F4F7FB] text-gray-900 select-none">

      {/* ═══════════ TOP HEADER ═══════════ */}
      <header className="h-14 shrink-0 bg-[#1445D1] text-white flex items-center px-3 gap-2 shadow-lg z-20 print:hidden">
        {/* User info */}
        <div className="flex items-center gap-2 min-w-[150px]">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <User className="h-4 w-4" />
          </div>
          <div className="leading-none">
            <div className="text-xs font-bold flex items-center gap-1">
              {device.name}
              {isManager && <Shield className="h-3 w-3 text-amber-300" />}
            </div>
            <div className="text-[10px] text-white/60">{settings.storeName} · {currentDate}، {currentTime}</div>
          </div>
        </div>

        {/* Nav icons */}
        <div className="flex items-center gap-1 border-r border-white/20 pr-2 mr-1">
          <button onClick={() => router.push("/dashboard")} className="w-9 h-9 rounded flex items-center justify-center hover:bg-white/10 transition-colors" title="الرئيسية">
            <Home className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("sale")}
            className={`w-9 h-9 rounded flex items-center justify-center transition-colors ${view === "sale" ? "bg-white/15" : "hover:bg-white/10"}`}
            title="الكاشير"
          >
            <Monitor className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("orders")}
            className={`w-9 h-9 rounded flex items-center justify-center transition-colors ${view === "orders" ? "bg-white/15" : "hover:bg-white/10"}`}
            title="فواتير اليوم"
          >
            <ClipboardList className="h-4 w-4" />
          </button>
        </div>

        {/* Shift chip */}
        {shift && (
          <button
            onClick={() => { setCloseShiftModal(true); setShiftError(""); }}
            className="h-9 px-3 rounded bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-2"
            title="تفاصيل / إغلاق الوردية"
          >
            <Clock className="h-3.5 w-3.5 text-green-300" />
            <span className="text-[11px] font-semibold">وردية مفتوحة</span>
            <span className="text-[10px] text-white/60">منذ {new Date(shift.openedAt).toLocaleTimeString("ar-PS", { hour: "2-digit", minute: "2-digit" })}</span>
          </button>
        )}

        <div className="flex-1" />

        {/* New order + counter */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigateOrder(previousOrderIndex ?? orderIndex)}
            disabled={!previousOrderIndex}
            className="h-9 w-9 rounded bg-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35 flex items-center justify-center transition-colors"
            title="الطلب السابق"
            aria-label="الطلب السابق"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => startNextOrder()}
            className="h-9 w-9 rounded bg-[#1E5EFF] hover:bg-[#1445D1] flex items-center justify-center transition-colors"
            title="طلب جديد"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigateOrder(nextOpenOrderIndex ?? orderIndex)}
            disabled={!nextOpenOrderIndex}
            className="h-9 w-9 rounded bg-white/10 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35 flex items-center justify-center transition-colors"
            title="الطلب اللاحق"
            aria-label="الطلب اللاحق"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="w-28 h-9 bg-white/10 rounded flex items-center justify-center text-xs font-semibold">
            طلب #{orderIndex}
          </div>
          {/* Held orders */}
          <button
            onClick={() => setShowHeldPanel(true)}
            className="h-9 px-3 rounded bg-amber-500/90 hover:bg-amber-500 text-black flex items-center gap-1.5 transition-colors font-bold text-xs"
            title="الطلبات المعلقة"
          >
            <PauseCircle className="h-4 w-4" />
            معلقة {heldOrders.length > 0 && <span className="bg-black/20 rounded px-1.5">{heldOrders.length}</span>}
          </button>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 border-r border-white/20 pr-3 ml-1">
          <button
            onClick={async () => {
              const logs = await getSyncLogs();
              setSyncLogs(logs);
              setShowSyncLogPanel(true);
            }}
            className="flex items-center gap-1.5 hover:bg-white/10 p-1.5 rounded transition-colors"
            title="سجل المزامنة والطلبات غير المتصلة"
          >
            {isOnline
              ? <Wifi className="h-3.5 w-3.5 text-green-400" />
              : <WifiOff className="h-3.5 w-3.5 text-red-400" />
            }
            {syncQueue.length > 0 && (
              <span className="text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-bold">
                {syncQueue.length} معلق
              </span>
            )}
          </button>
        </div>

        <button onClick={openSettings} className="w-9 h-9 rounded flex items-center justify-center hover:bg-white/10 transition-colors" title="الإعدادات وتخصيص الفاتورة">
          <SettingsIcon className="h-4 w-4" />
        </button>
        <button onClick={() => setLocked(true)} className="w-9 h-9 rounded flex items-center justify-center hover:bg-white/10 transition-colors" title="قفل الشاشة">
          <Lock className="h-4 w-4" />
        </button>
        <button onClick={handleLogout} className="w-9 h-9 rounded flex items-center justify-center hover:bg-red-500/30 transition-colors text-red-300" title="خروج">
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {view === "orders" ? (
        /* ═══════════ TODAY ORDERS VIEW ═══════════ */
        <div className="flex-1 overflow-y-auto p-4 print:hidden">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">فواتير اليوم</h2>
                <p className="text-xs text-gray-500">{todayInvoices.length} فاتورة · إجمالي {cur} {todaySales.toFixed(2)}</p>
              </div>
              <button onClick={loadInvoices} className="h-10 px-4 rounded-lg bg-white border border-gray-200 text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                <RotateCcw className={`h-4 w-4 ${invoicesLoading ? "animate-spin" : ""}`} /> تحديث
              </button>
            </div>
            {invoicesLoading && todayInvoices.length === 0 ? (
              <div className="text-center text-gray-400 py-16 text-sm">جارٍ التحميل...</div>
            ) : todayInvoices.length === 0 ? (
              <div className="text-center text-gray-400 py-16">
                <Receipt className="h-12 w-12 mx-auto mb-3 text-gray-200" />
                <p className="text-sm">لا توجد فواتير اليوم</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-50">
                {todayInvoices.map((inv) => (
                  <div key={inv.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${inv.status === "refunded" ? "bg-red-400" : "bg-green-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{inv.invoiceNumber}</p>
                      <p className="text-[11px] text-gray-400">
                        {inv.customerName} · {PAY_LABEL[inv.paymentMethod] ?? inv.paymentMethod} · {new Date(inv.issuedAt).toLocaleTimeString("ar-PS", { hour: "2-digit", minute: "2-digit" })}
                        {inv.status === "refunded" && <span className="text-red-500 font-semibold mr-1">· مرجعة</span>}
                      </p>
                    </div>
                    {inv.discount > 0 && <span className="text-[10px] text-green-600 bg-green-50 rounded px-1.5 py-0.5">خصم {cur}{inv.discount.toFixed(2)}</span>}
                    <p className="text-sm font-bold text-[#1445D1] shrink-0">{cur} {inv.total.toFixed(2)}</p>
                    {canRefund && inv.status !== "refunded" && (
                      <button
                        onClick={() => { setRefundTarget(inv); setRefundReason(""); setRefundError(""); }}
                        className="h-9 px-3 rounded-lg border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 flex items-center gap-1 shrink-0"
                      >
                        <Undo2 className="h-3.5 w-3.5" /> مرتجع
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!canRefund && (
              <p className="text-[11px] text-gray-400 mt-3 flex items-center gap-1"><Shield className="h-3 w-3" /> المرتجعات تتطلب صلاحية مدير</p>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ═══════════ SEARCH & ORDER TYPE BAR ═══════════ */}
          <div className="h-12 shrink-0 bg-white border-b border-gray-200 flex items-center px-3 gap-2 z-10 shadow-sm print:hidden">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                placeholder="بحث بالاسم أو الكود أو الباركود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 bg-gray-100 border border-gray-200 rounded-lg pr-8 pl-3 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#1445D1]/40 focus:bg-white transition-colors"
              />
            </div>

            {/* Order type */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {ORDER_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setOrderType(t.id)}
                    className={`h-8 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      orderType === t.id ? "bg-[#1445D1] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {t.label}
                  </button>
                );
              })}
            </div>

            {/* Add dish */}
            <button
              onClick={() => { setAddItemError(""); setShowAddItem(true); }}
              className="h-9 px-3 rounded-lg bg-[#1445D1] text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-[#1237A8] transition-colors shrink-0"
              title="إضافة صنف جديد للكتالوج"
            >
              <Plus className="h-4 w-4" /> إضافة صنف
            </button>

            {/* Table name (dine-in) */}
            {orderType === "dine_in" && (
              <input
                type="text"
                placeholder="رقم الطاولة"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className="w-24 h-9 bg-gray-100 border border-gray-200 rounded-lg px-2 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#1445D1]/40"
              />
            )}

            {/* View toggles */}
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 mr-auto">
              <button
                onClick={() => setViewMode("grid")}
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${viewMode === "grid" ? "bg-white shadow-sm text-[#1445D1]" : "text-gray-400 hover:text-gray-600"}`}
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current"><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></svg>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-[#1445D1]" : "text-gray-400 hover:text-gray-600"}`}
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current"><rect x="1" y="2" width="14" height="2.5" rx="1" /><rect x="1" y="6.75" width="14" height="2.5" rx="1" /><rect x="1" y="11.5" width="14" height="2.5" rx="1" /></svg>
              </button>
            </div>
          </div>

          {/* ═══════════ MAIN CONTENT ═══════════ */}
          <div className="flex-1 flex overflow-hidden print:hidden">

            {/* ─── CATEGORY SIDEBAR ─── */}
            <div className="w-28 shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-y-auto py-2 gap-0.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`mx-1.5 px-2 py-3 rounded-lg text-xs font-medium text-center transition-all ${
                    activeCategory === cat
                      ? "bg-[#1445D1] text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* ─── PRODUCT GRID ─── */}
            <div className="flex-1 overflow-y-auto p-3">
              {filteredItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                  <ShoppingCart className="h-12 w-12 text-gray-200" />
                  <p className="text-sm font-medium">لا توجد أصناف</p>
                  <p className="text-xs text-gray-300">{statusMessage}</p>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                  {filteredItems.map((item) => {
                    const inCart = cart.find((c) => c.id === item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleAddToCart(item)}
                        className={`group relative bg-white rounded-lg border-2 transition-all text-right p-0 overflow-hidden shadow-sm hover:shadow-md active:scale-95 ${
                          inCart ? "border-[#1445D1]" : "border-gray-100 hover:border-[#1445D1]/40"
                        }`}
                      >
                        <div className="h-20 bg-gradient-to-br from-[#1445D1]/5 to-[#1445D1]/10 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-[#1445D1]/10 flex items-center justify-center">
                            <Tag className="h-5 w-5 text-[#1445D1]/50" />
                          </div>
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-tight mb-1">{item.name}</p>
                          <p className="text-[11px] font-bold text-[#1445D1]">{cur} {item.price.toFixed(2)}</p>
                        </div>
                        {inCart && (
                          <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-[#1445D1] rounded-full flex items-center justify-center">
                            <span className="text-white text-[9px] font-bold">{inCart.qty}</span>
                          </div>
                        )}
                        {item.taxRate > 0 && (
                          <div className="absolute top-1.5 right-1.5 text-[8px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded font-medium">
                            +{item.taxRate}%
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredItems.map((item) => {
                    const inCart = cart.find((c) => c.id === item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleAddToCart(item)}
                        className={`w-full flex items-center gap-3 bg-white rounded-lg border-2 p-2.5 text-right transition-all hover:shadow-sm active:scale-[0.99] ${
                          inCart ? "border-[#1445D1]" : "border-gray-100 hover:border-[#1445D1]/40"
                        }`}
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#1445D1]/8 flex items-center justify-center shrink-0">
                          <Tag className="h-4 w-4 text-[#1445D1]/40" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                          <p className="text-[10px] text-gray-400">{item.category} · {item.code}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-[#1445D1]">{cur} {item.price.toFixed(2)}</p>
                          {inCart && <p className="text-[10px] text-gray-400">x{inCart.qty}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── ORDER PANEL ─── */}
            <div className="w-80 xl:w-96 shrink-0 bg-white border-r border-gray-200 flex flex-col shadow-lg">

              {/* Customer */}
              <div className="px-3 pt-2.5 pb-2 border-b border-gray-100">
                {showCustomerInput ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      onBlur={() => setShowCustomerInput(false)}
                      onKeyDown={(e) => e.key === "Enter" && setShowCustomerInput(false)}
                      className="flex-1 text-sm border border-[#1445D1]/30 rounded px-2 py-2 focus:outline-none focus:ring-1 focus:ring-[#1445D1]/40"
                    />
                    <button onClick={() => setShowCustomerInput(false)} className="text-[#1445D1]"><Check className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCustomerInput(true)}
                      className="flex items-center gap-2 text-xs text-gray-500 hover:text-[#1445D1] transition-colors group flex-1 min-w-0"
                    >
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{customerName}</span>
                      <span className="text-[10px] text-gray-300 group-hover:text-[#1445D1]/50">تعديل</span>
                    </button>
                    <button
                      onClick={() => { setShowNotesInput((v) => !v); }}
                      className={`h-7 px-2 rounded text-[10px] flex items-center gap-1 transition-colors ${orderNotes ? "bg-amber-50 text-amber-600" : "text-gray-400 hover:text-[#1445D1]"}`}
                      title="ملاحظة على الطلب"
                    >
                      <StickyNote className="h-3.5 w-3.5" /> {orderNotes ? "ملاحظة ✓" : "ملاحظة"}
                    </button>
                  </div>
                )}
                {showNotesInput && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <input
                      autoFocus
                      type="text"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && setShowNotesInput(false)}
                      placeholder="ملاحظة للمطبخ / الفاتورة..."
                      className="flex-1 text-xs border border-amber-200 rounded px-2 py-2 focus:outline-none focus:ring-1 focus:ring-amber-300"
                    />
                    <button onClick={() => setShowNotesInput(false)} className="text-amber-500"><Check className="h-4 w-4" /></button>
                  </div>
                )}
              </div>

              {/* Order lines header */}
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100 shrink-0">
                <span className="text-xs font-semibold text-gray-600">
                  {cart.length} بنود · {ORDER_TYPES.find((t) => t.id === orderType)?.label}
                  {orderType === "dine_in" && tableName && ` · طاولة ${tableName}`}
                </span>
                {cart.length > 0 && (
                  <button onClick={() => { if (confirm("إلغاء الطلب الحالي؟")) resetOrder(); }} className="text-red-400 hover:text-red-600 transition-colors" title="إلغاء الطلب">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Cart items */}
              <div className="flex-1 overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                    <ShoppingCart className="h-10 w-10" />
                    <p className="text-xs">السلة فارغة</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className={`px-3 py-2.5 border-b border-gray-50 cursor-pointer transition-colors ${
                        selectedItemId === item.id ? "bg-[#1445D1]/5 border-r-2 border-r-[#1445D1]" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                          {item.discount > 0 && (
                            <p className="text-[10px] text-green-600">خصم {item.discount}%</p>
                          )}
                          {item.note && (
                            <p className="text-[10px] text-amber-600 truncate">📝 {item.note}</p>
                          )}
                          {item.selectedModifiers.length > 0 && (
                            <p className="text-[10px] text-[#1445D1]/70 truncate">
                              {item.selectedModifiers.map((m) => m.name).join(" + ")}
                            </p>
                          )}
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {cur} {lineUnitPrice(item).toFixed(2)} × {item.qty}
                            {item.taxRate > 0 && <span className="mr-1 text-amber-500">+ض {item.taxRate}%</span>}
                          </p>
                        </div>
                        <div className="text-left shrink-0">
                          <p className="text-xs font-bold text-[#1445D1]">{cur} {itemNet(item).toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Qty controls (visible when selected) */}
                      {selectedItemId === item.id && (
                        <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="w-9 h-9 rounded border border-red-200 text-red-400 hover:bg-red-50 flex items-center justify-center transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <div className="flex items-center border border-gray-200 rounded overflow-hidden">
                            <button onClick={() => updateQty(item.id, -1)} className="w-9 h-9 hover:bg-gray-100 flex items-center justify-center transition-colors">
                              <Minus className="h-3.5 w-3.5 text-gray-600" />
                            </button>
                            <span className="w-10 h-9 text-sm font-bold text-center leading-9 border-x border-gray-200 bg-white">{item.qty}</span>
                            <button onClick={() => updateQty(item.id, 1)} className="w-9 h-9 hover:bg-gray-100 flex items-center justify-center transition-colors">
                              <Plus className="h-3.5 w-3.5 text-gray-600" />
                            </button>
                          </div>
                          <button
                            onClick={() => { setItemNoteInput(item.note ?? ""); setShowItemNoteInput(true); }}
                            className="w-9 h-9 rounded border border-amber-200 text-amber-500 hover:bg-amber-50 flex items-center justify-center transition-colors"
                            title="ملاحظة على الصنف"
                          >
                            <StickyNote className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Item action bar */}
              <div className="border-t border-gray-100 px-3 py-2 flex items-center gap-1.5 bg-gray-50 shrink-0">
                <button
                  onClick={() => { if (selectedItemId) { setQtyInput(String(selectedItem?.qty ?? 1)); setShowQtyInput(true); } }}
                  disabled={!selectedItemId}
                  className="flex-1 h-10 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors font-medium"
                >
                  الكمية
                </button>
                <button
                  onClick={() => { if (selectedItemId) setShowDiscountInput(true); }}
                  disabled={!selectedItemId}
                  className="flex-1 h-10 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors flex items-center justify-center gap-1 font-medium"
                >
                  <Percent className="h-3.5 w-3.5" /> خصم صنف
                </button>
                <button
                  onClick={() => { setOrderDiscountInput(orderDiscount ? String(orderDiscount) : ""); setShowOrderDiscount(true); }}
                  disabled={cart.length === 0}
                  className="flex-1 h-10 rounded-lg border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors flex items-center justify-center gap-1 font-medium"
                >
                  <Tag className="h-3.5 w-3.5" /> خصم فاتورة
                </button>
                <button
                  onClick={() => setShowFeesInput((v) => !v)}
                  disabled={cart.length === 0}
                  className={`flex-1 h-10 rounded-lg border text-xs transition-colors font-medium disabled:opacity-30 ${
                    serviceFee > 0 || deliveryFee > 0 ? "border-[#1445D1]/40 bg-[#1445D1]/5 text-[#1445D1]" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  رسوم
                </button>
              </div>

              {/* Inline inputs */}
              {showDiscountInput && (
                <div className="px-3 py-2 flex items-center gap-2 bg-gray-50 border-t border-gray-100">
                  <input
                    autoFocus type="number" inputMode="decimal" placeholder="نسبة خصم الصنف %"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") applyItemDiscount(); if (e.key === "Escape") setShowDiscountInput(false); }}
                    className="flex-1 h-10 text-sm border border-[#1445D1]/30 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#1445D1]/40 text-right"
                  />
                  <button onClick={applyItemDiscount} className="h-10 px-4 bg-[#1445D1] text-white text-xs rounded-lg hover:bg-[#1237A8]">تطبيق</button>
                  <button onClick={() => setShowDiscountInput(false)} className="h-10 w-10 flex items-center justify-center text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                </div>
              )}
              {showOrderDiscount && (
                <div className="px-3 py-2 flex items-center gap-2 bg-gray-50 border-t border-gray-100">
                  <input
                    autoFocus type="number" inputMode="decimal" placeholder={`مبلغ الخصم (${cur})`}
                    value={orderDiscountInput}
                    onChange={(e) => setOrderDiscountInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") applyOrderDiscount(); if (e.key === "Escape") setShowOrderDiscount(false); }}
                    className="flex-1 h-10 text-sm border border-[#1445D1]/30 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#1445D1]/40 text-right"
                  />
                  <button onClick={applyOrderDiscount} className="h-10 px-4 bg-[#1445D1] text-white text-xs rounded-lg hover:bg-[#1237A8]">تطبيق</button>
                  <button onClick={() => setShowOrderDiscount(false)} className="h-10 w-10 flex items-center justify-center text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                </div>
              )}
              {showItemNoteInput && (
                <div className="px-3 py-2 flex items-center gap-2 bg-amber-50/50 border-t border-amber-100">
                  <input
                    autoFocus type="text" placeholder="بدون بصل، زيادة صوص..."
                    value={itemNoteInput}
                    onChange={(e) => setItemNoteInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") applyItemNote(); if (e.key === "Escape") setShowItemNoteInput(false); }}
                    className="flex-1 h-10 text-sm border border-amber-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-amber-300 text-right"
                  />
                  <button onClick={applyItemNote} className="h-10 px-4 bg-amber-500 text-white text-xs rounded-lg hover:bg-amber-600">حفظ</button>
                  <button onClick={() => setShowItemNoteInput(false)} className="h-10 w-10 flex items-center justify-center text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                </div>
              )}
              {showQtyInput && (
                <div className="px-3 py-2 flex items-center gap-2 bg-gray-50 border-t border-gray-100">
                  <input
                    autoFocus type="number" inputMode="numeric" placeholder="الكمية"
                    value={qtyInput}
                    onChange={(e) => setQtyInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") applyQty(); if (e.key === "Escape") setShowQtyInput(false); }}
                    className="flex-1 h-10 text-sm border border-[#1445D1]/30 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#1445D1]/40 text-right"
                  />
                  <button onClick={applyQty} className="h-10 px-4 bg-[#1445D1] text-white text-xs rounded-lg hover:bg-[#1237A8]">تطبيق</button>
                  <button onClick={() => setShowQtyInput(false)} className="h-10 w-10 flex items-center justify-center text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                </div>
              )}
              {showFeesInput && (
                <div className="px-3 py-2 space-y-2 bg-gray-50 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-gray-500 w-20 shrink-0">رسوم خدمة</label>
                    <input
                      type="number" inputMode="decimal" value={serviceFee || ""}
                      onChange={(e) => setServiceFee(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0.00"
                      className="flex-1 h-9 text-sm border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#1445D1]/40 text-right"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-gray-500 w-20 shrink-0">رسوم توصيل</label>
                    <input
                      type="number" inputMode="decimal" value={deliveryFee || ""}
                      onChange={(e) => setDeliveryFee(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0.00"
                      className="flex-1 h-9 text-sm border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#1445D1]/40 text-right"
                    />
                    <button onClick={() => setShowFeesInput(false)} className="h-9 px-3 bg-[#1445D1] text-white text-xs rounded-lg hover:bg-[#1237A8]">تم</button>
                  </div>
                </div>
              )}

              {discountError && (
                <div className="px-3 py-2 bg-red-50 border-t border-red-100 flex items-center gap-2 text-xs text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1">{discountError}</span>
                  <button onClick={() => setDiscountError("")} className="text-red-400"><X className="h-3.5 w-3.5" /></button>
                </div>
              )}

              {/* Totals */}
              <div className="px-3 py-2.5 border-t border-gray-200 shrink-0 space-y-1">
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>المجموع الفرعي:</span>
                  <span>{cur} {subtotal.toFixed(2)}</span>
                </div>
                {discountTotal > 0 && (
                  <div className="flex justify-between text-[11px] text-green-600">
                    <span>الخصم:</span>
                    <span>- {cur} {discountTotal.toFixed(2)}</span>
                  </div>
                )}
                {totalTax > 0 && (
                  <div className="flex justify-between text-[11px] text-gray-400">
                    <span>الضريبة:</span>
                    <span>{cur} {totalTax.toFixed(2)}</span>
                  </div>
                )}
                {serviceFee > 0 && (
                  <div className="flex justify-between text-[11px] text-gray-400">
                    <span>رسوم خدمة:</span>
                    <span>{cur} {serviceFee.toFixed(2)}</span>
                  </div>
                )}
                {deliveryFee > 0 && (
                  <div className="flex justify-between text-[11px] text-gray-400">
                    <span>رسوم توصيل:</span>
                    <span>{cur} {deliveryFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                  <span className="text-xs text-gray-600 font-semibold">الإجمالي:</span>
                  <span className="font-black text-[#1445D1] text-lg">{cur} {total.toFixed(2)}</span>
                </div>
              </div>

              {/* MAIN ACTIONS */}
              <div className="shrink-0 grid grid-cols-4 gap-1.5 p-2 bg-gray-50 border-t border-gray-100">
                <button
                  onClick={handleHold}
                  disabled={cart.length === 0 || holdBusy}
                  className="h-14 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold text-xs transition-colors flex flex-col items-center justify-center gap-0.5"
                >
                  <PauseCircle className="h-5 w-5" />
                  تعليق
                </button>
                <button
                  onClick={openPayment}
                  disabled={cart.length === 0 || checkoutBusy}
                  className="col-span-3 h-14 rounded-xl bg-[#1E5EFF] hover:bg-[#1445D1] disabled:bg-gray-300 text-white font-bold text-lg transition-colors flex items-center justify-center gap-2 active:scale-[0.99]"
                >
                  {checkoutBusy ? (
                    <RotateCcw className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="h-6 w-6" />
                      الدفع · {cur} {total.toFixed(2)}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════ PAYMENT MODAL ═══════════ */}
      {paymentOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal header */}
            <div className="bg-[#1445D1] text-white px-5 py-4 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-base">إتمام عملية الدفع</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setSplitMode((v) => !v); setPayments([]); setPayAmount(""); }}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${splitMode ? "bg-white text-[#1445D1]" : "bg-white/15 hover:bg-white/25"}`}
                >
                  دفع مجزأ
                </button>
                <button onClick={() => setPaymentOpen(false)} className="hover:bg-white/20 p-1 rounded transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Total */}
              <div className="bg-[#1445D1]/5 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">المبلغ الإجمالي</p>
                <p className="text-3xl font-black text-[#1445D1]">{cur} {total.toFixed(2)}</p>
                <p className="text-xs text-gray-400 mt-1">{cart.length} صنف · {customerName}</p>
                {splitMode && (
                  <p className={`text-sm font-bold mt-2 ${remaining > 0 ? "text-amber-600" : "text-green-600"}`}>
                    {remaining > 0 ? `المتبقي: ${cur} ${remaining.toFixed(2)}` : "✓ اكتمل المبلغ"}
                  </p>
                )}
              </div>

              {/* Payment methods */}
              <div className="grid grid-cols-3 gap-2">
                {PAY_METHODS.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setPayMethod(m.id)}
                      className={`h-14 rounded-xl border-2 flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-all ${
                        payMethod === m.id
                          ? "border-[#1445D1] bg-[#1445D1] text-white"
                          : "border-gray-200 text-gray-600 hover:border-[#1445D1]/40"
                      }`}
                    >
                      <Icon className="h-4 w-4" /> {m.label}
                    </button>
                  );
                })}
              </div>

              {splitMode ? (
                <>
                  {/* Split payment lines */}
                  <div className="flex items-center gap-2">
                    <input
                      type="number" inputMode="decimal"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addPaymentLine()}
                      placeholder={`المبلغ (متبقي ${remaining.toFixed(2)})`}
                      className="flex-1 h-12 border-2 border-gray-200 rounded-xl px-3 text-right text-base font-bold focus:outline-none focus:border-[#1445D1] transition-colors"
                    />
                    <button
                      onClick={() => setPayAmount(String(remaining))}
                      className="h-12 px-3 rounded-xl border border-gray-200 text-xs font-semibold hover:bg-gray-50"
                    >
                      الباقي
                    </button>
                    <button
                      onClick={addPaymentLine}
                      disabled={(parseFloat(payAmount) || 0) <= 0 || remaining <= 0}
                      className="h-12 w-12 rounded-xl bg-[#1445D1] text-white flex items-center justify-center disabled:bg-gray-300"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                  {payments.length > 0 && (
                    <div className="space-y-1.5">
                      {payments.map((p) => (
                        <div key={p.method} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
                          <span className="font-medium text-gray-700">{PAY_LABEL[p.method]}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#1445D1]">{cur} {p.amount.toFixed(2)}</span>
                            <button onClick={() => removePaymentLine(p.method)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : payMethod === "cash" ? (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">المبلغ المستلم</label>
                  <input
                    autoFocus
                    type="number" inputMode="decimal"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-12 border-2 border-gray-200 rounded-xl px-3 text-right text-lg font-bold focus:outline-none focus:border-[#1445D1] transition-colors"
                  />
                  {cashReceivedNum > 0 && (
                    <div className={`mt-2 p-3 rounded-lg text-center text-base font-bold ${change >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                      {change >= 0 ? `الباقي: ${cur} ${change.toFixed(2)}` : `ناقص: ${cur} ${Math.abs(change).toFixed(2)}`}
                    </div>
                  )}
                  {/* Quick cash buttons */}
                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {[Math.ceil(total), 20, 50, 100, 200].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).map((v) => (
                      <button
                        key={v}
                        onClick={() => setCashReceived(String(v))}
                        className="h-11 border border-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-50 hover:border-[#1445D1]/30 transition-colors"
                      >
                        {cur}{v}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                  {(() => { const M = PAY_METHODS.find((m) => m.id === payMethod)?.icon ?? CreditCard; return <M className="h-8 w-8 text-blue-400 mx-auto mb-1" />; })()}
                  <p className="text-xs text-blue-600 font-medium">
                    {payMethod === "card" ? "مرر البطاقة أو اقرأ QR" :
                      payMethod === "receivable" ? `سيسجل المبلغ دينًا على: ${customerName}` :
                        `تحصيل عبر ${PAY_LABEL[payMethod]}`}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm buttons */}
            <div className="px-5 pb-5 pt-2 grid grid-cols-2 gap-2 shrink-0">
              <button
                onClick={() => setPaymentOpen(false)}
                className="h-13 min-h-[52px] rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={confirmPayment}
                disabled={
                  checkoutBusy ||
                  (splitMode ? (remaining > 0.009 || payments.length === 0)
                    : (payMethod === "cash" && cashReceivedNum > 0 && change < 0))
                }
                className="h-13 min-h-[52px] rounded-xl bg-[#1E5EFF] hover:bg-[#1445D1] disabled:bg-gray-300 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                {checkoutBusy ? <RotateCcw className="h-4 w-4 animate-spin" /> : <><Printer className="h-4 w-4" /> تأكيد وطباعة</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ HELD ORDERS PANEL ═══════════ */}
      {showHeldPanel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[85vh] flex flex-col">
            <div className="bg-amber-500 text-black px-5 py-4 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-base flex items-center gap-2"><PauseCircle className="h-5 w-5" /> الطلبات المعلقة ({heldOrders.length})</h2>
              <button onClick={() => setShowHeldPanel(false)} className="hover:bg-black/10 p-1 rounded transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {heldOrders.length === 0 ? (
                <div className="text-center text-gray-400 py-10">
                  <PauseCircle className="h-10 w-10 mx-auto mb-2 text-gray-200" />
                  <p className="text-sm">لا توجد طلبات معلقة</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {heldOrders.map((o) => (
                    <div key={o.id} className="border border-gray-200 rounded-xl p-3 hover:border-amber-300 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-bold text-gray-800">{o.customerName}</p>
                        <p className="text-sm font-bold text-[#1445D1]">{cur} {o.total.toFixed(2)}</p>
                      </div>
                      <p className="text-[11px] text-gray-400 mb-2">
                        {o.itemCount} صنف · {new Date(o.heldAt).toLocaleTimeString("ar-PS", { hour: "2-digit", minute: "2-digit" })}
                        {o.notes && ` · ${o.notes}`}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => recallHeld(o)}
                          className="flex-1 h-10 rounded-lg bg-[#1445D1] text-white text-xs font-bold hover:bg-[#1237A8] flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <PlayCircle className="h-4 w-4" /> استرجاع
                        </button>
                        <button
                          onClick={() => deleteHeld(o.id)}
                          className="h-10 w-10 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ SYNC LOG PANEL ═══════════ */}
      {showSyncLogPanel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[85vh] flex flex-col">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-base flex items-center gap-2"><Wifi className="h-5 w-5" /> سجل مزامنة الطلبات غير المتصلة ({syncQueue.length} معلقة)</h2>
              <button onClick={() => setShowSyncLogPanel(false)} className="hover:bg-white/10 p-1 rounded transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={async () => {
                    await syncPendingInvoices();
                  }}
                  disabled={syncQueue.length === 0 || checkoutBusy}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
                >
                  {checkoutBusy ? "جاري المزامنة..." : "مزامنة الآن"}
                </button>
                <button
                  onClick={async () => {
                    await clearSyncLogs();
                    setSyncLogs([]);
                  }}
                  className="px-3 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg transition-colors"
                >
                  مسح السجل
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-500">حالة المزامنة والطلبات:</h3>
                {syncLogs.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">لا توجد عمليات مزامنة مسجلة</p>
                ) : (
                  <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
                    {syncLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`border rounded-xl p-3 text-right text-xs ${
                          log.status === "success"
                            ? "bg-green-50/50 border-green-200"
                            : log.status === "conflict"
                            ? "bg-rose-50/50 border-rose-200"
                            : "bg-amber-50/50 border-amber-200"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-gray-800">{log.customerName}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              log.status === "success"
                                ? "bg-green-100 text-green-800"
                                : log.status === "conflict"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {log.status === "success" ? "مكتملة" : log.status === "conflict" ? "مرفوضة" : "فشلت"}
                          </span>
                        </div>
                        <p className="text-gray-500 mb-1.5">القيمة: {cur} {log.total.toFixed(2)} · {log.message}</p>
                        <p className="text-[10px] text-gray-400">
                          {new Date(log.timestamp).toLocaleString("ar-PS")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ CLOSE SHIFT MODAL ═══════════ */}
      {closeShiftModal && shift && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-[#1445D1] text-white px-5 py-4 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-base flex items-center gap-2"><Clock className="h-5 w-5" /> إغلاق الوردية</h2>
              <button onClick={() => setCloseShiftModal(false)} className="hover:bg-white/20 p-1 rounded transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-gray-500">الكاشير:</span><span className="font-semibold">{shift.cashierName}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">فتحت في:</span><span className="font-semibold">{new Date(shift.openedAt).toLocaleTimeString("ar-PS", { hour: "2-digit", minute: "2-digit" })}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">رصيد افتتاحي:</span><span className="font-semibold">{cur} {shift.openingCash.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">مبيعات نقدية:</span><span className="font-semibold">{cur} {shift.cashSales.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">مبيعات بطاقة:</span><span className="font-semibold">{cur} {shift.cardSales.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold border-t border-gray-200 pt-1.5 mt-1 text-[#1445D1]">
                  <span>النقدي المتوقع بالدرج:</span><span>{cur} {shift.expectedCash.toFixed(2)}</span>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1.5 block font-medium">النقدي الفعلي بالدرج (بعد العد)</label>
                <input
                  autoFocus
                  type="number" inputMode="decimal"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-13 min-h-[52px] border-2 border-gray-200 rounded-xl px-4 text-right text-xl font-bold focus:outline-none focus:border-[#1445D1] transition-colors"
                />
                {actualCash !== "" && (
                  <div className={`mt-2 p-2.5 rounded-lg text-center text-sm font-bold ${
                    (parseFloat(actualCash) || 0) - shift.expectedCash < -0.009 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"
                  }`}>
                    الفرق: {cur} {((parseFloat(actualCash) || 0) - shift.expectedCash).toFixed(2)}
                  </div>
                )}
              </div>
              <input
                type="text"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="ملاحظات الإغلاق (اختياري)"
                className="w-full h-11 border border-gray-200 rounded-xl px-3 text-right text-sm focus:outline-none focus:ring-1 focus:ring-[#1445D1]/40"
              />
              {shiftError && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2.5">{shiftError}</p>}
            </div>
            <div className="px-5 pb-5 pt-2 grid grid-cols-2 gap-2 shrink-0">
              <button
                onClick={() => setCloseShiftModal(false)}
                className="h-13 min-h-[52px] rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                متابعة العمل
              </button>
              <button
                onClick={handleCloseShift}
                disabled={shiftBusy || actualCash === ""}
                className="h-13 min-h-[52px] rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                {shiftBusy ? <RotateCcw className="h-4 w-4 animate-spin" /> : <><Lock className="h-4 w-4" /> إغلاق الوردية (Z)</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ REFUND MODAL ═══════════ */}
      {refundTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-red-500 text-white px-5 py-4 flex items-center justify-between">
              <h2 className="font-bold text-base flex items-center gap-2"><Undo2 className="h-5 w-5" /> مرتجع فاتورة</h2>
              <button onClick={() => setRefundTarget(null)} className="hover:bg-white/20 p-1 rounded transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">الفاتورة:</span><span className="font-semibold">{refundTarget.invoiceNumber}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">العميل:</span><span className="font-semibold">{refundTarget.customerName}</span></div>
                <div className="flex justify-between font-bold text-red-600 border-t border-gray-200 pt-1 mt-1"><span>مبلغ الإرجاع:</span><span>{cur} {refundTarget.total.toFixed(2)}</span></div>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1.5 block font-medium">سبب الإرجاع *</label>
                <input
                  autoFocus
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="خطأ في الطلب، شكوى عميل..."
                  className="w-full h-11 border-2 border-gray-200 rounded-xl px-3 text-right text-sm focus:outline-none focus:border-red-400 transition-colors"
                />
              </div>
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                سيُرجع المخزون ويُعكس القيد المحاسبي تلقائيًا.
              </p>
              {refundError && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2.5">{refundError}</p>}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setRefundTarget(null)}
                  className="h-12 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleRefund}
                  disabled={refundBusy || refundReason.trim().length < 2}
                  className="h-12 rounded-xl bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                  {refundBusy ? <RotateCcw className="h-4 w-4 animate-spin" /> : "تأكيد المرتجع"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ ADD DISH MODAL ═══════════ */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
            <div className="bg-[#1445D1] text-white px-5 py-4 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-base flex items-center gap-2"><Plus className="h-5 w-5" /> إضافة صنف جديد</h2>
              <button onClick={() => setShowAddItem(false)} className="hover:bg-white/20 p-1 rounded transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">اسم الصنف *</label>
                <input
                  autoFocus type="text" value={newItem.name}
                  onChange={(e) => setNewItem((v) => ({ ...v, name: e.target.value }))}
                  placeholder="منتج جديد..."
                  className="w-full h-11 border-2 border-gray-200 rounded-xl px-3 text-right text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-[#1445D1] transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">سعر البيع ({cur}) *</label>
                  <input
                    type="number" inputMode="decimal" value={newItem.price}
                    onChange={(e) => setNewItem((v) => ({ ...v, price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full h-11 border-2 border-gray-200 rounded-xl px-3 text-right text-sm font-bold text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-[#1445D1] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">التكلفة ({cur})</label>
                  <input
                    type="number" inputMode="decimal" value={newItem.cost}
                    onChange={(e) => setNewItem((v) => ({ ...v, cost: e.target.value }))}
                    placeholder="0.00"
                    className="w-full h-11 border-2 border-gray-200 rounded-xl px-3 text-right text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-[#1445D1] transition-colors"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">الضريبة %</label>
                  <input
                    type="number" inputMode="decimal" value={newItem.taxRate}
                    onChange={(e) => setNewItem((v) => ({ ...v, taxRate: e.target.value }))}
                    placeholder="0"
                    className="w-full h-11 border-2 border-gray-200 rounded-xl px-3 text-right text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-[#1445D1] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block font-medium">الوحدة</label>
                  <input
                    type="text" value={newItem.unit}
                    onChange={(e) => setNewItem((v) => ({ ...v, unit: e.target.value }))}
                    placeholder="قطعة / حبة..."
                    className="w-full h-11 border-2 border-gray-200 rounded-xl px-3 text-right text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-[#1445D1] transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">التصنيف</label>
                <input
                  type="text" value={newItem.category} list="pos-categories"
                  onChange={(e) => setNewItem((v) => ({ ...v, category: e.target.value }))}
                  placeholder="أصناف، مشروبات..."
                  className="w-full h-11 border-2 border-gray-200 rounded-xl px-3 text-right text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-[#1445D1] transition-colors"
                />
                <datalist id="pos-categories">
                  {categories.filter((c) => c !== "الكل").map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">باركود (اختياري)</label>
                <input
                  type="text" value={newItem.barcode}
                  onChange={(e) => setNewItem((v) => ({ ...v, barcode: e.target.value }))}
                  placeholder="امسح أو اكتب الباركود"
                  className="w-full h-11 border-2 border-gray-200 rounded-xl px-3 text-right text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:border-[#1445D1] transition-colors"
                />
              </div>
              <label className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer">
                <span className="text-xs text-gray-700 font-medium">ربط الصنف بالمخزن (يظهر في المخزون ويبقى دائمًا)</span>
                <input type="checkbox" checked={linkInventory} onChange={(e) => setLinkInventory(e.target.checked)} className="h-4 w-4 accent-[#1E5EFF]" />
              </label>
              {addItemError && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2.5">{addItemError}</p>}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => setShowAddItem(false)}
                  className="h-12 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleAddItem}
                  disabled={addItemBusy || newItem.name.trim().length < 2 || newItem.price === ""}
                  className="h-12 rounded-xl bg-[#1E5EFF] hover:bg-[#1445D1] disabled:bg-gray-300 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                  {addItemBusy ? <RotateCcw className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> إضافة وبيع</>}
                </button>
              </div>
               <p className="text-[10px] text-gray-400 text-center">يُحفظ الصنف في الكتالوج ويُربط بالمخزن ويُضاف للسلة مباشرة</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ MODIFIER PICKER MODAL ═══════════ */}
      {modifierTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[92vh] flex flex-col">
            <div className="bg-[#1445D1] text-white px-5 py-4 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-base flex items-center gap-2"><Tag className="h-5 w-5" /> تخصيص {modifierTarget.name}</h2>
              <button onClick={() => { setModifierTarget(null); setModifierSelections({}); }} className="hover:bg-white/20 p-1 rounded transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              {modifierTarget.modifierGroups.map((g) => (
                <div key={g.id} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-gray-800">{g.name}</p>
                    <span className="text-[10px] text-gray-400 bg-gray-100 rounded px-2 py-0.5">
                      {g.selectionType === "single" ? (g.isRequired ? "إلزامي" : "اختيار واحد") : `حتى ${g.maxSelect}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {g.options.map((o) => {
                      const selected = (modifierSelections[g.id] ?? []).includes(o.id);
                      return (
                        <button
                          key={o.id}
                          onClick={() => toggleModifierOption(g.id, o.id, g.selectionType === "multiple", g.maxSelect)}
                          className={`h-12 rounded-xl border-2 px-2 text-xs font-semibold flex items-center justify-between transition-all ${
                            selected
                              ? "border-[#1445D1] bg-[#1445D1] text-white"
                              : "border-gray-200 text-gray-700 hover:border-[#1445D1]/40"
                          }`}
                        >
                          <span className="truncate">{o.name}</span>
                          {o.priceDelta > 0 && <span className={selected ? "text-white/80" : "text-[#1445D1]"}>+{cur}{o.priceDelta.toFixed(2)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {modifierError && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2.5">{modifierError}</p>}
            </div>
            <div className="px-5 pb-5 pt-2 grid grid-cols-2 gap-2 shrink-0">
              <button
                onClick={() => { setModifierTarget(null); setModifierSelections({}); }}
                className="h-13 min-h-[52px] rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={confirmModifiers}
                className="h-13 min-h-[52px] rounded-xl bg-[#1E5EFF] hover:bg-[#1445D1] text-white text-sm font-bold transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="h-4 w-4" />
                إضافة · {cur} {(modifierTarget.price + modifierPriceDelta(modifierTarget)).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ SETTINGS MODAL ═══════════ */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="bg-[#1445D1] text-white px-5 py-4 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-base flex items-center gap-2"><SettingsIcon className="h-5 w-5" /> إعدادات نقطة البيع</h2>
              <button onClick={() => setShowSettings(false)} className="hover:bg-white/20 p-1 rounded transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 shrink-0">
              <button
                onClick={() => setSettingsTab("design")}
                className={`flex-1 h-12 text-sm font-semibold transition-colors ${settingsTab === "design" ? "text-[#1445D1] border-b-2 border-[#1445D1] bg-[#1445D1]/5" : "text-gray-400 hover:text-gray-600"}`}
              >
                🧾 تصميم الفاتورة
              </button>
              <button
                onClick={() => setSettingsTab("system")}
                className={`flex-1 h-12 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${settingsTab === "system" ? "text-[#1445D1] border-b-2 border-[#1445D1] bg-[#1445D1]/5" : "text-gray-400 hover:text-gray-600"}`}
              >
                <Shield className="h-4 w-4" /> إعدادات النظام {!isManager && <span className="text-[10px] bg-gray-100 rounded px-1.5 py-0.5">مدير فقط</span>}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {settingsTab === "design" ? (
                <div className="flex flex-col lg:flex-row">
                  {/* Design controls */}
                  <div className="flex-1 p-5 space-y-5 bg-gray-50/60">
                    {/* ── قسم القالب ── */}
                    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/80">
                        <Receipt className="h-4 w-4 text-[#1445D1]" />
                        <h3 className="text-sm font-bold text-gray-800">قالب الفاتورة</h3>
                        <span className="mr-auto text-[11px] text-gray-400">اختر الشكل العام للإيصال</span>
                      </header>
                      <div className="p-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {([
                            ["classic", "كلاسيكي", "جدول بسيط"],
                            ["modern", "عصري", "شريط لوني"],
                            ["restaurant", "مطعم", "إطار فاخر"],
                            ["minimal", "بسيط", "مساحات بيضاء"],
                            ["grid", "شبكي", "رأس مقسم"],
                            ["creative", "إبداعي", "خلفية لونية"],
                            ["card", "بطاقات", "بطاقات بظل"],
                            ["b2b", "مؤسسات", "جدول مفصل"],
                          ] as Array<[ReceiptDesign["template"], string, string]>).map(([tpl, label, desc]) => {
                            const active = design.template === tpl;
                            const ac = design.accentColor;
                            return (
                              <button
                                key={tpl}
                                onClick={() => updateDesign({ template: tpl })}
                                className={`group rounded-xl border-2 p-2 text-right transition-all ${active ? "border-[#1445D1] bg-[#1445D1]/[0.04] shadow-sm" : "border-gray-200 hover:border-[#1445D1]/40 hover:bg-gray-50"}`}
                              >
                                {/* Mini receipt preview */}
                                <div className="h-14 rounded-md bg-white border border-gray-200 p-1.5 mb-1.5 flex flex-col gap-[3px] overflow-hidden shadow-inner">
                                  {tpl === "modern" && <div className="h-1 rounded-full" style={{ background: ac }} />}
                                  {tpl === "creative"
                                    ? <div className="rounded px-1 py-[3px] flex flex-col gap-[2px]" style={{ background: ac }}>
                                        <div className="h-[3px] w-2/3 mx-auto rounded-full bg-white/90" />
                                        <div className="h-[2px] w-1/2 mx-auto rounded-full bg-white/50" />
                                      </div>
                                    : <div className="h-[3px] rounded-full mx-auto" style={{ width: "60%", background: tpl === "minimal" ? "#d1d5db" : ac }} />}
                                  {tpl === "grid" ? (
                                    <div className="grid grid-cols-2 gap-[3px] mt-[2px]">
                                      <div className="h-3 rounded-sm" style={{ background: `${ac}22` }} />
                                      <div className="h-3 rounded-sm" style={{ background: `${ac}22` }} />
                                    </div>
                                  ) : tpl === "card" ? (
                                    <div className="flex flex-col gap-[3px] mt-[2px]">
                                      <div className="h-2 rounded-sm border border-gray-200 bg-gray-50" />
                                      <div className="h-2 rounded-sm border border-gray-200 bg-gray-50" />
                                    </div>
                                  ) : tpl === "b2b" ? (
                                    <div className="flex flex-col gap-[2px] mt-[2px]">
                                      <div className="h-[2px] rounded-full bg-gray-300" />
                                      <div className="h-[2px] rounded-full bg-gray-200" />
                                      <div className="h-[2px] rounded-full bg-gray-200" />
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-[2px] mt-[1px]">
                                      <div className="h-[2px] rounded-full bg-gray-200" />
                                      <div className="h-[2px] rounded-full bg-gray-200 w-4/5" />
                                      <div className="h-[2px] rounded-full bg-gray-200 w-3/5" />
                                    </div>
                                  )}
                                  <div className="mt-auto h-[3px] rounded-full self-end" style={{ width: "40%", background: ac }} />
                                </div>
                                <p className={`text-xs font-bold ${active ? "text-[#1445D1]" : "text-gray-800"}`}>{label}</p>
                                <p className="text-[9px] text-gray-400">{desc}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </section>

                    {/* ── قسم الهوية والألوان ── */}
                    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/80">
                        <Tag className="h-4 w-4 text-[#1445D1]" />
                        <h3 className="text-sm font-bold text-gray-800">الهوية والألوان</h3>
                      </header>
                      <div className="p-4 space-y-4">
                        <div>
                          <label className="text-xs text-gray-500 mb-1.5 block font-medium">اللون المميز</label>
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              type="color" value={design.accentColor}
                              onChange={(e) => updateDesign({ accentColor: e.target.value })}
                              className="h-9 w-12 rounded-lg border border-gray-200 cursor-pointer bg-white"
                            />
                            {["#1445D1", "#1E5EFF", "#e11d48", "#ea580c", "#0ea5e9", "#111827"].map((c) => (
                              <button key={c} onClick={() => updateDesign({ accentColor: c })}
                                className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${design.accentColor === c ? "border-gray-900 ring-2 ring-offset-1 ring-gray-300" : "border-white shadow"}`}
                                style={{ background: c }}
                              />
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1.5 block font-medium">شعار / رمز أعلى الفاتورة</label>
                          <input
                            type="text" value={design.logoText}
                            onChange={(e) => updateDesign({ logoText: e.target.value })}
                            placeholder="🍔 أو نص مختصر"
                            className="w-full h-10 border border-gray-200 rounded-lg px-3 text-right text-sm focus:outline-none focus:ring-2 focus:ring-[#1445D1]/30 focus:border-[#1445D1]/40"
                          />
                        </div>
                      </div>
                    </section>

                    {/* ── قسم الطباعة والخط ── */}
                    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/80">
                        <Printer className="h-4 w-4 text-[#1445D1]" />
                        <h3 className="text-sm font-bold text-gray-800">الطباعة والخط</h3>
                      </header>
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-gray-500 mb-1.5 block font-medium">حجم الخط ({design.fontSize}px)</label>
                            <input
                              type="range" min={10} max={16} step={1}
                              value={design.fontSize}
                              onChange={(e) => updateDesign({ fontSize: parseInt(e.target.value, 10) })}
                              className="w-full accent-[#1445D1] mt-2"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1.5 block font-medium">نوع الخط</label>
                            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                              {(["mono", "sans"] as const).map((f) => (
                                <button key={f} onClick={() => updateDesign({ font: f })}
                                  className={`flex-1 h-8 rounded-md text-xs font-semibold transition-colors ${design.font === f ? "bg-[#1445D1] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                                  {f === "mono" ? "طابعة حرارية" : "عادي"}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-gray-500 mb-1.5 block font-medium">خط الفصل</label>
                            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                              {(["dashed", "solid", "double"] as const).map((s) => (
                                <button key={s} onClick={() => updateDesign({ separator: s })}
                                  className={`flex-1 h-8 rounded-md text-xs font-semibold transition-colors ${design.separator === s ? "bg-[#1445D1] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                                  {s === "dashed" ? "متقطع" : s === "solid" ? "متصل" : "مزدوج"}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1.5 block font-medium">محاذاة الرأس</label>
                            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                              {(["center", "right"] as const).map((a) => (
                                <button key={a} onClick={() => updateDesign({ headerAlign: a })}
                                  className={`flex-1 h-8 rounded-md text-xs font-semibold transition-colors ${design.headerAlign === a ? "bg-[#1445D1] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                                  {a === "center" ? "وسط" : "يمين"}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* ── قسم النصوص ── */}
                    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/80">
                        <StickyNote className="h-4 w-4 text-[#1445D1]" />
                        <h3 className="text-sm font-bold text-gray-800">نصوص الترويسة والتذييل</h3>
                      </header>
                      <div className="p-4 space-y-4">
                        <div>
                          <label className="text-xs text-gray-500 mb-1.5 block font-medium">ترويسة مخصصة</label>
                          <input
                            type="text" value={design.headerText}
                            onChange={(e) => updateDesign({ headerText: e.target.value })}
                            placeholder="أهلاً بكم في مطعمنا"
                            className="w-full h-10 border border-gray-200 rounded-lg px-3 text-right text-sm focus:outline-none focus:ring-2 focus:ring-[#1445D1]/30 focus:border-[#1445D1]/40"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1.5 block font-medium">تذييل مخصص أسفل الفاتورة</label>
                          <input
                            type="text" value={design.footerText}
                            onChange={(e) => updateDesign({ footerText: e.target.value })}
                            placeholder="شكرًا لزيارتكم — نتطلع لخدمتكم"
                            className="w-full h-10 border border-gray-200 rounded-lg px-3 text-right text-sm focus:outline-none focus:ring-2 focus:ring-[#1445D1]/30 focus:border-[#1445D1]/40"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1.5 block font-medium">سطر إضافي أسفل الفاتورة</label>
                          <input
                            type="text" value={design.extraFooter}
                            onChange={(e) => updateDesign({ extraFooter: e.target.value })}
                            placeholder="للتوصيل: 0599-000000 · واتساب..."
                            className="w-full h-10 border border-gray-200 rounded-lg px-3 text-right text-sm focus:outline-none focus:ring-2 focus:ring-[#1445D1]/30 focus:border-[#1445D1]/40"
                          />
                        </div>
                      </div>
                    </section>

                    {/* ── قسم عناصر الظهور ── */}
                    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/80">
                        <Check className="h-4 w-4 text-[#1445D1]" />
                        <h3 className="text-sm font-bold text-gray-800">عناصر الفاتورة</h3>
                        <span className="mr-auto text-[11px] text-gray-400">إظهار / إخفاء</span>
                      </header>
                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-1.5">
                          {([
                            ["showLogo", "الشعار/الرمز"],
                            ["showStoreName", "اسم المتجر"],
                            ["showStoreAddress", "عنوان المتجر"],
                            ["showTaxNumber", "الرقم الضريبي"],
                            ["showCashier", "اسم الكاشير"],
                            ["showCustomer", "اسم العميل"],
                            ["showOrderType", "نوع الطلب"],
                            ["showTable", "رقم الطاولة"],
                            ["showTime", "الوقت/التاريخ"],
                            ["showItemNotes", "ملاحظات الأصناف"],
                            ["showDiscounts", "تفاصيل الخصومات"],
                            ["showPayments", "تفاصيل الدفع"],
                            ["showChange", "المستلم والباقي"],
                            ["showQR", "رمز QR"],
                            ["showBarcode", "الباركود"],
                            ["boldTotal", "إجمالي بخط عريض"],
                          ] as Array<[keyof ReceiptDesign, string]>).map(([key, label]) => (
                            <button
                              key={key}
                              onClick={() => updateDesign({ [key]: !design[key] } as Partial<ReceiptDesign>)}
                              className={`h-10 rounded-lg border text-xs font-medium transition-colors flex items-center justify-between px-3 ${
                                design[key] ? "border-[#1E5EFF]/40 bg-[#1E5EFF]/5 text-[#1445D1]" : "border-gray-200 text-gray-400 hover:border-gray-300"
                              }`}
                            >
                              <span>{label}</span>
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center ${design[key] ? "bg-[#1E5EFF] text-white" : "bg-gray-200"}`}>
                                {design[key] && <Check className="h-3 w-3" />}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </section>

                    <div className="flex items-center justify-between gap-3 px-1 pt-1">
                      <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                        <Save className="h-3.5 w-3.5" />
                        يُحفظ التصميم تلقائيًا على هذا الجهاز وينطبق على كل الفواتير
                      </p>
                      <button
                        onClick={() => { localStorage.removeItem("rwq_receipt_design"); setDesign(DEFAULT_DESIGN); }}
                        className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 rounded-lg px-3 h-8 transition-colors"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        استعادة الافتراضي
                      </button>
                    </div>
                  </div>

                  {/* Live preview */}
                  <div className="lg:w-96 shrink-0 bg-gradient-to-b from-gray-100 to-gray-200 p-5 flex flex-col items-center border-t lg:border-t-0 lg:border-r border-gray-200">
                    <div className="lg:sticky lg:top-0 w-full flex flex-col items-center">
                      <p className="text-xs text-gray-500 font-bold mb-3 flex items-center gap-1.5">
                        <Printer className="h-4 w-4" /> معاينة حية
                      </p>
                      <div className="w-full bg-white rounded-lg shadow-lg p-4 max-h-[62vh] overflow-y-auto" style={{ maxWidth: settings.receiptWidth === "58mm" ? 240 : 300 }}>
                        <PosReceipt design={design} settings={settings} data={SAMPLE_RECEIPT} />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-3 flex items-center gap-1">
                        <Receipt className="h-3 w-3" /> عرض الورق: {settings.receiptWidth} · بيانات تجريبية
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* System settings tab */
                <div className="p-5 space-y-4 max-w-lg">
                  {!isManager && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-center gap-2">
                      <Shield className="h-4 w-4 shrink-0" />
                      هذه الإعدادات للعرض فقط — تعديلها يتطلب جهازًا بدور مدير.
                    </div>
                  )}
                  <fieldset disabled={!isManager} className="space-y-4 disabled:opacity-60">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block font-medium">العملة</label>
                        <select
                          value={sysForm.currency}
                          onChange={(e) => setSysForm((v) => ({ ...v, currency: e.target.value }))}
                          className="w-full h-11 border border-gray-200 rounded-lg px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1445D1]/40 bg-white"
                        >
                          <option value="ILS">شيكل ₪</option>
                          <option value="USD">دولار $</option>
                          <option value="JOD">دينار د.أ</option>
                          <option value="EGP">جنيه ج.م</option>
                          <option value="SAR">ريال ر.س</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block font-medium">الضريبة الافتراضية %</label>
                        <input
                          type="number" inputMode="decimal" value={sysForm.taxRate}
                          onChange={(e) => setSysForm((v) => ({ ...v, taxRate: parseFloat(e.target.value) || 0 }))}
                          className="w-full h-11 border border-gray-200 rounded-lg px-3 text-right text-sm focus:outline-none focus:ring-1 focus:ring-[#1445D1]/40"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block font-medium">ترويسة الفاتورة (يطبع أعلى الفاتورة)</label>
                      <input
                        type="text" value={sysForm.receiptHeader ?? ""}
                        onChange={(e) => setSysForm((v) => ({ ...v, receiptHeader: e.target.value }))}
                        placeholder="أهلاً بكم في مطعمنا"
                        className="w-full h-11 border border-gray-200 rounded-lg px-3 text-right text-sm focus:outline-none focus:ring-1 focus:ring-[#1445D1]/40"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block font-medium">تذييل الفاتورة</label>
                      <input
                        type="text" value={sysForm.receiptFooter}
                        onChange={(e) => setSysForm((v) => ({ ...v, receiptFooter: e.target.value }))}
                        className="w-full h-11 border border-gray-200 rounded-lg px-3 text-right text-sm focus:outline-none focus:ring-1 focus:ring-[#1445D1]/40"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block font-medium">حد خصم الكاشير %</label>
                        <input
                          type="number" inputMode="decimal" value={sysForm.maxCashierDiscount}
                          onChange={(e) => setSysForm((v) => ({ ...v, maxCashierDiscount: parseFloat(e.target.value) || 0 }))}
                          className="w-full h-11 border border-gray-200 rounded-lg px-3 text-right text-sm focus:outline-none focus:ring-1 focus:ring-[#1445D1]/40"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block font-medium">عرض ورق الطباعة</label>
                        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                          {(["80mm", "58mm"] as const).map((w) => (
                            <button key={w} type="button" onClick={() => setSysForm((v) => ({ ...v, receiptWidth: w }))}
                              className={`flex-1 h-9 rounded-md text-xs font-semibold transition-colors ${sysForm.receiptWidth === w ? "bg-[#1445D1] text-white" : "text-gray-500"}`}>
                              {w}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {([
                        ["requireShift", "إلزام فتح وردية قبل البيع"],
                        ["allowCashierRefund", "السماح للكاشير بالمرتجعات"],
                        ["printOnCheckout", "طباعة تلقائية بعد الدفع"],
                      ] as Array<[keyof PosSettings, string]>).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSysForm((v) => ({ ...v, [key]: !v[key] }))}
                          className={`w-full h-12 rounded-xl border-2 text-sm font-medium transition-colors flex items-center justify-between px-4 ${
                            sysForm[key] ? "border-[#1E5EFF]/40 bg-[#1E5EFF]/5 text-[#1445D1]" : "border-gray-200 text-gray-500"
                          }`}
                        >
                          <span>{label}</span>
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center ${sysForm[key] ? "bg-[#1E5EFF] text-white" : "bg-gray-200"}`}>
                            {sysForm[key] === true && <Check className="h-3.5 w-3.5" />}
                          </span>
                        </button>
                      ))}
                    </div>
                    {sysMsg && (
                      <p className={`text-xs rounded-lg p-2.5 ${sysMsg.startsWith("✓") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{sysMsg}</p>
                    )}
                    {isManager && (
                      <button
                        onClick={saveSystemSettings}
                        disabled={sysBusy}
                        className="w-full h-13 min-h-[52px] rounded-xl bg-[#1445D1] hover:bg-[#1237A8] disabled:bg-gray-300 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
                      >
                        {sysBusy ? <RotateCcw className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> حفظ إعدادات النظام</>}
                      </button>
                    )}
                  </fieldset>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ PRINT RECEIPT (hidden) ═══════════ */}
      <div
        className="hidden print:block fixed inset-0 bg-white text-black text-right"
        style={{
          width: settings.receiptWidth === "58mm" ? "58mm" : "80mm",
          padding: "8px",
          fontSize: `${design.fontSize}px`,
          fontFamily: design.font === "mono" ? "monospace" : "inherit",
          lineHeight: 1.5,
        }}
      >
        {lastReceipt && <PosReceipt design={design} settings={settings} data={lastReceipt} />}
      </div>
    </div>
  );
}
