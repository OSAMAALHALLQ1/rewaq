"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, Minus, Trash2, CreditCard, Banknote,
  LogOut, Home, Monitor, ClipboardList, ChevronLeft,
  ChevronRight, MoreHorizontal, Eye, ChevronDown,
  X, Check, Percent, Tag, User, Wifi, WifiOff,
  ShoppingCart, Printer, RotateCcw
} from "lucide-react";

// ─────────────────── Types ───────────────────
type QueuedInvoice = {
  id: string;
  idempotencyKey: string;
  paymentMethod: "cash" | "card";
  customerName: string;
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
  discount: number;
};

type DeviceSession = {
  token: string;
  name: string;
  orgId: string;
  branchId: string;
  role: string;
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
};

type PaymentMode = "cash" | "card" | null;

// ─────────────────── Component ───────────────────
export default function CashierPOSWorkspace() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  const [device, setDevice] = useState<DeviceSession>({ token: "", name: "", orgId: "", branchId: "", role: "" });
  const [authorized, setAuthorized] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuItems, setMenuItems] = useState<PosCatalogItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("الكل");
  const [statusMessage, setStatusMessage] = useState("تحميل الأصناف...");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncQueue, setSyncQueue] = useState<QueuedInvoice[]>([]);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [paymentModal, setPaymentModal] = useState<PaymentMode>(null);
  const [cashReceived, setCashReceived] = useState("");
  const [orderIndex, setOrderIndex] = useState(1);
  const [customerName, setCustomerName] = useState("عميل سريع");
  const [showCustomerInput, setShowCustomerInput] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountInput, setDiscountInput] = useState("");

  const currentDate = new Date().toLocaleDateString("ar-PS", {
    year: "numeric", month: "2-digit", day: "2-digit"
  });
  const currentTime = new Date().toLocaleTimeString("ar-PS", {
    hour: "2-digit", minute: "2-digit"
  });

  // ── Online/offline tracking ──
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const q = localStorage.getItem("rwq_pos_queue");
    if (q) { try { setSyncQueue(JSON.parse(q)); } catch { } }
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => { if (isOnline && syncQueue.length > 0) syncPendingInvoices(); }, [isOnline]);

  const syncPendingInvoices = async () => {
    if (checkoutBusy || syncQueue.length === 0) return;
    setCheckoutBusy(true);
    const failed: QueuedInvoice[] = [];
    for (const inv of syncQueue) {
      try {
        const r = await fetch("/api/department/pos/checkout", {
          method: "POST",
          headers: { "content-type": "application/json", "x-department-key": device.token },
          body: JSON.stringify({ paymentMethod: inv.paymentMethod, customerName: inv.customerName, idempotencyKey: inv.idempotencyKey, items: inv.items }),
        });
        if (!r.ok) failed.push(inv);
      } catch { failed.push(inv); }
    }
    setSyncQueue(failed);
    localStorage.setItem("rwq_pos_queue", JSON.stringify(failed));
    setCheckoutBusy(false);
    setStatusMessage(failed.length === 0 ? "تمت المزامنة" : `${failed.length} فواتير معلقة`);
  };

  // ── Auth & catalog load ──
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
    fetch("/api/department/pos/catalog", { headers: { "x-department-key": token } })
      .then(async (r) => {
        const p = await r.json();
        if (!r.ok || !p.success) throw new Error(p.error || "تعذر تحميل الكتالوج");
        setMenuItems(p.items ?? []);
        setStatusMessage(p.items?.length ? `${p.items.length} صنف متاح` : "لا توجد أصناف");
      })
      .catch((e) => setStatusMessage(e instanceof Error ? e.message : "خطأ في التحميل"));
  }, [router]);

  // ── Cart helpers ──
  const handleAddToCart = (item: PosCatalogItem) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === item.id);
      if (ex) return prev.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: item.id, catalogItemId: item.id, name: item.name, price: item.price, taxRate: item.taxRate, qty: 1, discount: 0 }];
    });
    setSelectedItemId(item.id);
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter((i) => i.qty > 0));
  };

  const removeItem = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id));

  const applyDiscount = () => {
    const d = parseFloat(discountInput);
    if (!isNaN(d) && selectedItemId) {
      setCart((prev) => prev.map((i) => i.id === selectedItemId ? { ...i, discount: Math.min(100, Math.max(0, d)) } : i));
    }
    setShowDiscountInput(false);
    setDiscountInput("");
  };

  const selectedItem = cart.find((i) => i.id === selectedItemId);

  const itemTotal = (item: CartItem) => item.price * item.qty * (1 - item.discount / 100);
  const itemTax = (item: CartItem) => itemTotal(item) * (item.taxRate / 100);

  const subtotal = cart.reduce((s, i) => s + itemTotal(i), 0);
  const totalTax = cart.reduce((s, i) => s + itemTax(i), 0);
  const total = subtotal + totalTax;
  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const change = cashReceivedNum - total;

  // ── Categories ──
  const categories = ["الكل", ...Array.from(new Set(menuItems.map((i) => i.category).filter(Boolean)))];
  const filteredItems = menuItems.filter((item) => {
    const matchCat = activeCategory === "الكل" || item.category === activeCategory;
    const matchSearch = !searchQuery || item.name.includes(searchQuery) || item.code.includes(searchQuery);
    return matchCat && matchSearch;
  });

  // ── Checkout ──
  const handleCheckout = async (method: "cash" | "card") => {
    if (cart.length === 0 || checkoutBusy) return;
    const idempotencyKey = crypto.randomUUID();
    const invoiceTotal = total;
    const payloadBody = {
      paymentMethod: method, customerName,
      idempotencyKey,
      items: cart.map((i) => ({ catalogItemId: i.catalogItemId, quantity: i.qty })),
    };
    const receipt = {
      invoiceNumber: "PENDING-" + idempotencyKey.slice(0, 6).toUpperCase(),
      date: new Date().toLocaleString("ar-PS"),
      cashier: device.name,
      items: cart,
      subtotal,
      tax: totalTax,
      total: invoiceTotal,
      method: method === "cash" ? "نقدي" : "شبكة",
    };

    if (!isOnline) {
      const qi: QueuedInvoice = { id: crypto.randomUUID(), ...payloadBody, total: invoiceTotal, timestamp: Date.now() };
      const nq = [...syncQueue, qi];
      setSyncQueue(nq);
      localStorage.setItem("rwq_pos_queue", JSON.stringify(nq));
      setLastReceipt(receipt);
      setCart([]); setSelectedItemId(null); setPaymentModal(null);
      setTimeout(() => window.print(), 400);
      return;
    }

    try {
      setCheckoutBusy(true);
      const r = await fetch("/api/department/pos/checkout", {
        method: "POST",
        headers: { "content-type": "application/json", "x-department-key": device.token },
        body: JSON.stringify(payloadBody),
      });
      const p = await r.json();
      if (!r.ok || !p.success) throw new Error(p.error || "تعذر إصدار الفاتورة");
      setStatusMessage(`✓ فاتورة ${p.invoiceNumber}`);
      setLastReceipt({ ...receipt, invoiceNumber: p.invoiceNumber });
      setCart([]); setSelectedItemId(null); setPaymentModal(null);
      setOrderIndex((n) => n + 1);
      setTimeout(() => window.print(), 400);
    } catch (err) {
      const qi: QueuedInvoice = { id: crypto.randomUUID(), ...payloadBody, total: invoiceTotal, timestamp: Date.now() };
      const nq = [...syncQueue, qi];
      setSyncQueue(nq);
      localStorage.setItem("rwq_pos_queue", JSON.stringify(nq));
      setLastReceipt(receipt);
      setCart([]); setSelectedItemId(null); setPaymentModal(null);
      setTimeout(() => window.print(), 400);
    } finally { setCheckoutBusy(false); }
  };

  const handleLogout = () => {
    ["rwq_dept_key","rwq_dept_role","rwq_dept_org_id","rwq_dept_branch_id","rwq_dept_allowed","rwq_dept_device"].forEach((k) => localStorage.removeItem(k));
    document.cookie = "rwq_dept_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/d/gate");
  };

  if (!authorized) return null;

  // ─────────────────── RENDER ───────────────────
  return (
    <div dir="rtl" className="h-screen flex flex-col overflow-hidden bg-[#f0f2f5] select-none">

      {/* ═══════════ TOP HEADER ═══════════ */}
      <header className="h-12 shrink-0 bg-[#3d3d6b] text-white flex items-center px-3 gap-2 shadow-lg z-20">
        {/* User info */}
        <div className="flex items-center gap-2 min-w-[140px]">
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="leading-none">
            <div className="text-xs font-bold">{device.name}</div>
            <div className="text-[10px] text-white/60">{currentDate}، {currentTime}</div>
          </div>
        </div>

        {/* Nav icons */}
        <div className="flex items-center gap-1 border-r border-white/20 pr-2 mr-1">
          <button onClick={() => router.push("/dashboard")} className="w-8 h-8 rounded flex items-center justify-center hover:bg-white/10 transition-colors" title="الرئيسية">
            <Home className="h-4 w-4" />
          </button>
          <button className="w-8 h-8 rounded flex items-center justify-center bg-white/15 hover:bg-white/20 transition-colors" title="الكاشير">
            <Monitor className="h-4 w-4" />
          </button>
          <button className="w-8 h-8 rounded flex items-center justify-center hover:bg-white/10 transition-colors" title="الطلبات">
            <ClipboardList className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1" />

        {/* New order + counter */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setCart([]); setSelectedItemId(null); setOrderIndex((n) => n + 1); }}
            className="h-8 w-8 rounded bg-[#00a650] hover:bg-[#008a42] flex items-center justify-center transition-colors"
            title="طلب جديد"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button className="w-7 h-8 flex items-center justify-center hover:bg-white/10 rounded transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button className="w-7 h-8 flex items-center justify-center hover:bg-white/10 rounded transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="w-28 h-8 bg-white/10 rounded flex items-center justify-center text-xs font-semibold">
            طلب #{orderIndex}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 border-r border-white/20 pr-3 ml-1">
          {isOnline
            ? <Wifi className="h-3.5 w-3.5 text-green-400" />
            : <WifiOff className="h-3.5 w-3.5 text-red-400" />
          }
          {syncQueue.length > 0 && (
            <span className="text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded font-bold">
              {syncQueue.length} معلقة
            </span>
          )}
        </div>

        <button onClick={handleLogout} className="w-8 h-8 rounded flex items-center justify-center hover:bg-red-500/30 transition-colors text-red-300" title="خروج">
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {/* ═══════════ SEARCH & CATEGORIES BAR ═══════════ */}
      <div className="h-11 shrink-0 bg-white border-b border-gray-200 flex items-center px-3 gap-2 z-10 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            ref={searchRef}
            type="text"
            placeholder="بحث عن منتج..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-7 bg-gray-100 border border-gray-200 rounded pr-8 pl-3 text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#3d3d6b]/40 focus:bg-white transition-colors"
          />
        </div>

        {/* Category dropdown */}
        <div className="relative">
          <button className="h-7 px-3 bg-gray-100 border border-gray-200 rounded text-xs flex items-center gap-1.5 hover:bg-gray-200 transition-colors">
            <span>{activeCategory === "الكل" ? "المنتجات" : activeCategory}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* View toggles */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded p-0.5">
          <button
            onClick={() => setViewMode("grid")}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${viewMode === "grid" ? "bg-white shadow-sm text-[#3d3d6b]" : "text-gray-400 hover:text-gray-600"}`}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-[#3d3d6b]" : "text-gray-400 hover:text-gray-600"}`}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current"><rect x="1" y="2" width="14" height="2.5" rx="1"/><rect x="1" y="6.75" width="14" height="2.5" rx="1"/><rect x="1" y="11.5" width="14" height="2.5" rx="1"/></svg>
          </button>
        </div>

        <button className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded transition-colors text-gray-500">
          <MoreHorizontal className="h-4 w-4" />
        </button>
        <button className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded transition-colors text-gray-500">
          <Eye className="h-4 w-4" />
        </button>
        <button className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded transition-colors text-gray-500">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>

        <div className="text-xs text-gray-400 mr-auto">POS Client</div>
      </div>

      {/* ═══════════ MAIN CONTENT ═══════════ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── LEFT: CATEGORY SIDEBAR ─── */}
        <div className="w-28 shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-y-auto py-2 gap-0.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`mx-1.5 px-2 py-2.5 rounded text-xs font-medium text-center transition-all ${
                activeCategory === cat
                  ? "bg-[#3d3d6b] text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ─── CENTER: PRODUCT GRID ─── */}
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
                      inCart ? "border-[#3d3d6b]" : "border-gray-100 hover:border-[#3d3d6b]/40"
                    }`}
                  >
                    {/* Product image placeholder */}
                    <div className="h-20 bg-gradient-to-br from-[#3d3d6b]/5 to-[#3d3d6b]/10 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-[#3d3d6b]/10 flex items-center justify-center">
                        <Tag className="h-5 w-5 text-[#3d3d6b]/50" />
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-tight mb-1">{item.name}</p>
                      <p className="text-[11px] font-bold text-[#3d3d6b]">₪ {item.price.toFixed(2)}</p>
                    </div>
                    {inCart && (
                      <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-[#3d3d6b] rounded-full flex items-center justify-center">
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
                      inCart ? "border-[#3d3d6b]" : "border-gray-100 hover:border-[#3d3d6b]/40"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#3d3d6b]/8 flex items-center justify-center shrink-0">
                      <Tag className="h-4 w-4 text-[#3d3d6b]/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                      <p className="text-[10px] text-gray-400">{item.category} · {item.code}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[#3d3d6b]">₪ {item.price.toFixed(2)}</p>
                      {inCart && <p className="text-[10px] text-gray-400">x{inCart.qty}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── RIGHT: ORDER PANEL ─── */}
        <div className="w-72 xl:w-80 shrink-0 bg-white border-r border-gray-200 flex flex-col shadow-lg">

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
                  className="flex-1 text-xs border border-[#3d3d6b]/30 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#3d3d6b]/40"
                />
                <button onClick={() => setShowCustomerInput(false)} className="text-[#3d3d6b]"><Check className="h-4 w-4" /></button>
              </div>
            ) : (
              <button
                onClick={() => setShowCustomerInput(true)}
                className="flex items-center gap-2 text-xs text-gray-500 hover:text-[#3d3d6b] transition-colors group w-full"
              >
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{customerName}</span>
                <span className="mr-auto text-[10px] text-gray-300 group-hover:text-[#3d3d6b]/50">تعديل</span>
              </button>
            )}
          </div>

          {/* Order lines header */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100 shrink-0">
            <span className="text-xs font-semibold text-gray-600">{cart.length} بنود</span>
            {cart.length > 0 && (
              <button onClick={() => { setCart([]); setSelectedItemId(null); }} className="text-red-400 hover:text-red-600 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
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
                    selectedItemId === item.id ? "bg-[#3d3d6b]/5 border-r-2 border-r-[#3d3d6b]" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                      {item.discount > 0 && (
                        <p className="text-[10px] text-green-600">خصم {item.discount}%</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        ₪ {item.price.toFixed(2)} × {item.qty}
                        {item.taxRate > 0 && <span className="mr-1 text-amber-500">+ض {item.taxRate}%</span>}
                      </p>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="text-xs font-bold text-[#3d3d6b]">₪ {itemTotal(item).toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Qty controls (visible when selected) */}
                  {selectedItemId === item.id && (
                    <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="w-7 h-7 rounded border border-red-200 text-red-400 hover:bg-red-50 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <div className="flex items-center border border-gray-200 rounded overflow-hidden">
                        <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 hover:bg-gray-100 flex items-center justify-center transition-colors">
                          <Minus className="h-3 w-3 text-gray-600" />
                        </button>
                        <span className="w-8 h-7 text-xs font-bold text-center leading-7 border-x border-gray-200 bg-white">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 hover:bg-gray-100 flex items-center justify-center transition-colors">
                          <Plus className="h-3 w-3 text-gray-600" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Bottom controls: Discount / Price / Qty buttons */}
          <div className="border-t border-gray-100 px-3 py-2 flex items-center gap-1.5 bg-gray-50 shrink-0">
            <button
              onClick={() => removeItem(selectedItemId ?? "")}
              disabled={!selectedItemId}
              className="w-8 h-8 rounded border border-gray-200 bg-white flex items-center justify-center text-red-400 hover:bg-red-50 disabled:opacity-30 transition-colors"
              title="حذف"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              disabled={!selectedItemId}
              className="flex-1 h-8 rounded border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              السعر
            </button>
            <button
              onClick={() => { if (selectedItemId) setShowDiscountInput(true); }}
              disabled={!selectedItemId}
              className="flex-1 h-8 rounded border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors flex items-center justify-center gap-1"
            >
              <Percent className="h-3 w-3" /> خصم
            </button>
            <button
              disabled={!selectedItemId}
              className="flex-1 h-8 rounded border border-gray-200 bg-white text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              الكمية
            </button>
          </div>

          {/* Discount inline input */}
          {showDiscountInput && (
            <div className="px-3 pb-2 flex items-center gap-2 bg-gray-50 border-b border-gray-100">
              <input
                autoFocus
                type="number"
                placeholder="نسبة الخصم %"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyDiscount(); if (e.key === "Escape") setShowDiscountInput(false); }}
                className="flex-1 h-8 text-xs border border-[#3d3d6b]/30 rounded px-2 focus:outline-none focus:ring-1 focus:ring-[#3d3d6b]/40 text-right"
              />
              <button onClick={applyDiscount} className="h-8 px-3 bg-[#3d3d6b] text-white text-xs rounded hover:bg-[#2e2e55]">تطبيق</button>
              <button onClick={() => setShowDiscountInput(false)} className="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-gray-600"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}

          {/* Totals */}
          <div className="px-3 py-2.5 border-t border-gray-200 shrink-0">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>الإجمالي:</span>
              <span className="font-bold text-[#3d3d6b] text-sm">₪ {total.toFixed(2)}</span>
            </div>
            {totalTax > 0 && (
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>منها ضريبة:</span>
                <span>₪ {totalTax.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* CHECKOUT BUTTON */}
          <button
            onClick={() => setPaymentModal("cash")}
            disabled={cart.length === 0 || checkoutBusy}
            className="h-14 shrink-0 bg-[#00a650] hover:bg-[#008a42] disabled:bg-gray-300 text-white font-bold text-base transition-colors flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            {checkoutBusy ? (
              <RotateCcw className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                عملية الدفع
              </>
            )}
          </button>
        </div>
      </div>

      {/* ═══════════ PAYMENT MODAL ═══════════ */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {/* Modal header */}
            <div className="bg-[#3d3d6b] text-white px-5 py-4 flex items-center justify-between">
              <h2 className="font-bold text-base">إتمام عملية الدفع</h2>
              <button onClick={() => setPaymentModal(null)} className="hover:bg-white/20 p-1 rounded transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Total */}
              <div className="bg-[#3d3d6b]/5 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">المبلغ الإجمالي</p>
                <p className="text-3xl font-black text-[#3d3d6b]">₪ {total.toFixed(2)}</p>
                <p className="text-xs text-gray-400 mt-1">{cart.length} صنف · {customerName}</p>
              </div>

              {/* Payment method toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentModal("cash")}
                  className={`h-12 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
                    paymentModal === "cash"
                      ? "border-[#3d3d6b] bg-[#3d3d6b] text-white"
                      : "border-gray-200 text-gray-600 hover:border-[#3d3d6b]/40"
                  }`}
                >
                  <Banknote className="h-4 w-4" /> نقدي
                </button>
                <button
                  onClick={() => setPaymentModal("card")}
                  className={`h-12 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
                    paymentModal === "card"
                      ? "border-[#3d3d6b] bg-[#3d3d6b] text-white"
                      : "border-gray-200 text-gray-600 hover:border-[#3d3d6b]/40"
                  }`}
                >
                  <CreditCard className="h-4 w-4" /> شبكة
                </button>
              </div>

              {/* Cash received input */}
              {paymentModal === "cash" && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">المبلغ المستلم</label>
                  <input
                    autoFocus
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-11 border-2 border-gray-200 rounded-xl px-3 text-right text-base font-bold focus:outline-none focus:border-[#3d3d6b] transition-colors"
                  />
                  {cashReceivedNum > 0 && (
                    <div className={`mt-2 p-2.5 rounded-lg text-center text-sm font-bold ${change >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                      {change >= 0 ? `الباقي: ₪ ${change.toFixed(2)}` : `ناقص: ₪ ${Math.abs(change).toFixed(2)}`}
                    </div>
                  )}
                  {/* Quick cash buttons */}
                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {[10, 20, 50, 100].map((v) => (
                      <button
                        key={v}
                        onClick={() => setCashReceived(String(v))}
                        className="h-9 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 hover:border-[#3d3d6b]/30 transition-colors"
                      >
                        ₪{v}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {paymentModal === "card" && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                  <CreditCard className="h-8 w-8 text-blue-400 mx-auto mb-1" />
                  <p className="text-xs text-blue-600 font-medium">مرر البطاقة أو اقرأ QR</p>
                </div>
              )}
            </div>

            {/* Confirm buttons */}
            <div className="px-5 pb-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentModal(null)}
                className="h-11 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleCheckout(paymentModal as "cash" | "card")}
                disabled={checkoutBusy || (paymentModal === "cash" && cashReceivedNum > 0 && change < 0)}
                className="h-11 rounded-xl bg-[#00a650] hover:bg-[#008a42] disabled:bg-gray-300 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                {checkoutBusy ? <RotateCcw className="h-4 w-4 animate-spin" /> : <><Printer className="h-4 w-4" /> تأكيد وطباعة</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ PRINT RECEIPT (hidden) ═══════════ */}
      <div className="hidden print:block fixed inset-0 bg-white text-black text-right" style={{ width: "80mm", padding: "8px", fontSize: "12px", fontFamily: "monospace" }}>
        {lastReceipt && (
          <div>
            <div className="text-center mb-2">
              <p className="font-bold text-base">رواق - نقطة البيع</p>
              <p className="text-xs">فاتورة ضريبية مبسطة</p>
            </div>
            <div className="border-t border-dashed border-black pt-2 text-xs space-y-0.5 mb-2">
              <div className="flex justify-between"><span>رقم الفاتورة:</span><span>{lastReceipt.invoiceNumber}</span></div>
              <div className="flex justify-between"><span>التاريخ:</span><span>{lastReceipt.date}</span></div>
              <div className="flex justify-between"><span>الكاشير:</span><span>{lastReceipt.cashier}</span></div>
              <div className="flex justify-between"><span>العميل:</span><span>{lastReceipt.method === "نقدي" ? customerName : customerName}</span></div>
            </div>
            <div className="border-t border-dashed border-black pt-2 mb-2">
              {lastReceipt.items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-xs py-0.5">
                  <span>{item.name} x{item.qty}</span>
                  <span>₪ {(item.price * item.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-black pt-2 text-xs space-y-0.5">
              <div className="flex justify-between"><span>المجموع الفرعي:</span><span>₪ {lastReceipt.subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>الضريبة:</span><span>₪ {lastReceipt.tax.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-sm border-t border-black pt-1 mt-1"><span>الإجمالي:</span><span>₪ {lastReceipt.total.toFixed(2)}</span></div>
              <div className="flex justify-between mt-1"><span>طريقة الدفع:</span><span>{lastReceipt.method}</span></div>
            </div>
            <div className="text-center mt-3 text-xs border-t border-dashed border-black pt-2">شكراً لتعاملكم معنا</div>
          </div>
        )}
      </div>
    </div>
  );
}
