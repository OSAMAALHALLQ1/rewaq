"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Receipt, ShoppingCart, LogOut, Search, Plus, Minus, Trash2, 
  CreditCard, Banknote, BadgeCent
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

export default function CashierPOSWorkspace() {
  const router = useRouter();
  const [device, setDevice] = useState<DeviceSession>({ token: "", name: "", orgId: "", branchId: "", role: "" });
  const [authorized, setAuthorized] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuItems, setMenuItems] = useState<PosCatalogItem[]>([]);
  const [statusMessage, setStatusMessage] = useState("تحميل أصناف الكاشير...");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [syncQueue, setSyncQueue] = useState<QueuedInvoice[]>([]);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const activeShift = "الوردية الصباحية - نشطة";

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const queued = localStorage.getItem("rwq_pos_queue");
    if (queued) {
      try {
        setSyncQueue(JSON.parse(queued));
      } catch (e) {}
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline && syncQueue.length > 0) {
      syncPendingInvoices();
    }
  }, [isOnline, syncQueue.length]);

  const syncPendingInvoices = async () => {
    if (checkoutBusy || syncQueue.length === 0) return;
    setCheckoutBusy(true);
    setStatusMessage("جاري مزامنة الفواتير المعلقة...");
    
    let currentQueue = [...syncQueue];
    const failedQueue: QueuedInvoice[] = [];

    for (const invoice of currentQueue) {
      try {
        const response = await fetch("/api/department/pos/checkout", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-department-key": device.token,
          },
          body: JSON.stringify({
            paymentMethod: invoice.paymentMethod,
            customerName: invoice.customerName,
            idempotencyKey: invoice.idempotencyKey,
            items: invoice.items,
          }),
        });

        if (!response.ok) {
          throw new Error("فشل المزامنة");
        }
      } catch (err) {
        failedQueue.push(invoice);
      }
    }

    setSyncQueue(failedQueue);
    localStorage.setItem("rwq_pos_queue", JSON.stringify(failedQueue));
    setCheckoutBusy(false);
    if (failedQueue.length === 0) {
      setStatusMessage("تمت المزامنة بنجاح");
    } else {
      setStatusMessage(`تبقت ${failedQueue.length} فواتير معلقة`);
    }
  };

  useEffect(() => {
    // 1. Session verification
    const token = localStorage.getItem("rwq_dept_key");
    const role = localStorage.getItem("rwq_dept_role");
    const allowed = JSON.parse(localStorage.getItem("rwq_dept_allowed") || "[]");

    if (!token || !allowed.includes("pos")) {
      router.push("/d/gate");
      return;
    }

    const nextDevice = {
      token,
      role: role ?? "",
      orgId: localStorage.getItem("rwq_dept_org_id") ?? "",
      branchId: localStorage.getItem("rwq_dept_branch_id") ?? "",
      name: localStorage.getItem("rwq_dept_device") ?? "جهاز كاشير",
    };

    setDevice(nextDevice);
    setAuthorized(true);

    fetch("/api/department/pos/catalog", {
      headers: {
        "x-department-key": token,
      },
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "تعذر تحميل أصناف الكاشير.");
        }
        setMenuItems(payload.items ?? []);
        setStatusMessage(payload.items?.length ? "متصل بكتالوج Supabase" : "لا توجد أصناف فعالة في الكتالوج.");
      })
      .catch((error) => {
        setStatusMessage(error instanceof Error ? error.message : "تعذر تحميل أصناف الكاشير.");
      });
  }, [router]);

  const handleAddToCart = (item: PosCatalogItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { id: item.id, catalogItemId: item.id, name: item.name, price: item.price, taxRate: item.taxRate, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const handleClearCart = () => setCart([]);

  const handleCheckout = async (method: "cash" | "card") => {
    if (cart.length === 0) return;

    const idempotencyKey = crypto.randomUUID();
    const invoiceTotal = cart.reduce((sum, item) => sum + item.price * item.qty * (1 + item.taxRate / 100), 0);
    
    const payloadBody = {
      paymentMethod: method,
      customerName: "عميل سفري سريع",
      idempotencyKey,
      items: cart.map((item) => ({
        catalogItemId: item.catalogItemId,
        quantity: item.qty,
      })),
    };

    const newReceipt = {
      invoiceNumber: "PENDING-" + idempotencyKey.slice(0, 6).toUpperCase(),
      date: new Date().toLocaleString("ar-SA"),
      cashier: device.name,
      items: cart,
      subtotal: cart.reduce((sum, item) => sum + item.price * item.qty, 0),
      tax: cart.reduce((sum, item) => sum + item.price * item.qty * (item.taxRate / 100), 0),
      total: invoiceTotal,
      method: method === "cash" ? "نقدي" : "شبكة"
    };

    if (!isOnline) {
      const queuedInvoice: QueuedInvoice = {
        id: crypto.randomUUID(),
        ...payloadBody,
        total: invoiceTotal,
        timestamp: Date.now(),
      };
      const newQueue = [...syncQueue, queuedInvoice];
      setSyncQueue(newQueue);
      localStorage.setItem("rwq_pos_queue", JSON.stringify(newQueue));
      setStatusMessage("تم الحفظ محلياً (بدون إنترنت)");
      
      setLastReceipt(newReceipt);
      setCart([]);
      setTimeout(() => window.print(), 500);
      return;
    }

    try {
      setCheckoutBusy(true);
      const response = await fetch("/api/department/pos/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-department-key": device.token,
        },
        body: JSON.stringify(payloadBody),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "تعذر إصدار الفاتورة.");
      }

      setStatusMessage(`تم حفظ الفاتورة ${payload.invoiceNumber} في Supabase`);
      
      setLastReceipt({
        ...newReceipt,
        invoiceNumber: payload.invoiceNumber
      });
      
      setCart([]);
      setTimeout(() => window.print(), 500);
    } catch (err) {
      // Fallback to queue if fetch failed due to network
      const queuedInvoice: QueuedInvoice = {
        id: crypto.randomUUID(),
        ...payloadBody,
        total: invoiceTotal,
        timestamp: Date.now(),
      };
      const newQueue = [...syncQueue, queuedInvoice];
      setSyncQueue(newQueue);
      localStorage.setItem("rwq_pos_queue", JSON.stringify(newQueue));
      setStatusMessage("تم الحفظ في الطابور (حدث خطأ في الشبكة)");
      
      setLastReceipt(newReceipt);
      setCart([]);
      setTimeout(() => window.print(), 500);
    } finally {
      setCheckoutBusy(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("rwq_dept_key");
    localStorage.removeItem("rwq_dept_role");
    localStorage.removeItem("rwq_dept_org_id");
    localStorage.removeItem("rwq_dept_branch_id");
    localStorage.removeItem("rwq_dept_allowed");
    localStorage.removeItem("rwq_dept_device");
    
    document.cookie = "rwq_dept_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    
    router.push("/d/gate");
  };

  const filteredItems = menuItems.filter((item) => item.name.includes(searchQuery) || item.code.includes(searchQuery));

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = cart.reduce((sum, item) => sum + item.price * item.qty * (item.taxRate / 100), 0);
  const total = subtotal + tax;

  if (!authorized) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      
      {/* Immersive POS Header */}
      <header className="h-16 shrink-0 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-xl flex items-center justify-center">
            <Receipt className="h-5.5 w-5.5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm tracking-wide">شاشة البيع السريع والكاشير (POS)</h1>
              {!isOnline && <Badge variant="destructive" className="text-[10px] h-5">غير متصل</Badge>}
              {syncQueue.length > 0 && <Badge variant="secondary" className="text-[10px] h-5 bg-amber-500/20 text-amber-500 hover:bg-amber-500/20 border-0">{syncQueue.length} معلقة</Badge>}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">{activeShift} | جهاز: {device.name} | {statusMessage}</p>
          </div>
        </div>

        {/* Action items */}
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="border-slate-800 bg-slate-900/50 hover:bg-rose-950/30 hover:border-rose-900/50 text-rose-400 h-10 w-10 p-0" 
            onClick={handleLogout}
            title="تسجيل الخروج وإلغاء تسجيل الجهاز"
          >
            <LogOut className="h-4.5 w-4.5" />
          </Button>
        </div>
      </header>

      {/* POS Content split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[400px_1fr] overflow-hidden">
        
        {/* Left Side: Shopping Cart & Checkout invoice */}
        <div className="border-e border-slate-900 bg-slate-900/10 p-5 flex flex-col overflow-hidden text-right">
          <div className="flex items-center justify-between border-b border-slate-850 pb-3 mb-4 shrink-0">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <ShoppingCart className="h-4.5 w-4.5 text-teal-400" />
              سلة المشتريات الحالية
            </h2>
            {cart.length > 0 && (
              <button onClick={handleClearCart} className="text-slate-500 hover:text-rose-400 p-1 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Cart list scroll area */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-650 py-16 text-center">
                <ShoppingCart className="h-10 w-10 text-slate-800 stroke-[1.5] mb-2" />
                <p className="text-xs font-semibold">السلة فارغة حالياً</p>
                <p className="text-[10px] text-slate-700 mt-1">اضغط على الأصناف في اليمين لإضافتها</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="bg-slate-900/80 border border-slate-850 p-3 rounded-xl flex items-center justify-between gap-3 text-right">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-100 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{(item.price * item.qty).toFixed(2)} ر.س</p>
                  </div>
                  
                  {/* Quantity adjustments */}
                  <div className="flex items-center gap-2.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-850 shrink-0">
                    <button onClick={() => updateQty(item.id, -1)} className="text-slate-400 hover:text-rose-400"><Minus className="h-3.5 w-3.5" /></button>
                    <span className="text-xs font-bold text-teal-400 w-4 text-center font-mono">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="text-slate-400 hover:text-teal-400"><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals & Quick checkout trigger */}
          <div className="mt-4 pt-4 border-t border-slate-850 space-y-3.5 shrink-0 bg-slate-950/20 p-3.5 rounded-2xl border border-slate-850/60">
            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>المجموع الفرعي:</span>
                <span className="font-mono text-slate-200">{subtotal.toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between">
                <span>ضريبة القيمة المضافة (15%):</span>
                <span className="font-mono text-slate-200">{tax.toFixed(2)} ر.س</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center text-sm font-bold text-slate-100 border-t border-slate-800/80 pt-2.5">
              <span>المجموع الكلي:</span>
              <span className="text-lg text-teal-400 font-mono font-black">{total.toFixed(2)} ر.س</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <Button 
                onClick={() => handleCheckout("cash")}
                disabled={cart.length === 0 || checkoutBusy}
                className="bg-amber-600 hover:bg-amber-700 text-white h-11 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Banknote className="h-4.5 w-4.5" />
                دفع نقدي
              </Button>
              
              <Button 
                onClick={() => handleCheckout("card")}
                disabled={cart.length === 0 || checkoutBusy}
                className="bg-teal-600 hover:bg-teal-700 text-white h-11 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <CreditCard className="h-4.5 w-4.5" />
                دفع شبكة
              </Button>
            </div>
          </div>
        </div>

        {/* Right Side: Catalog menus item grid */}
        <div className="p-6 overflow-y-auto space-y-6 text-right flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-900 pb-3 shrink-0">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <BadgeCent className="h-5 w-5 text-teal-400" />
              قائمة أصناف Supabase
            </h2>
            <div className="relative w-full max-w-xs">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                type="text"
                placeholder="البحث بالاسم..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-900 border-slate-800 text-slate-100 text-xs h-9 ps-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 flex-1">
            {filteredItems.map((item) => (
              <Card 
                key={item.id} 
                onClick={() => handleAddToCart(item)}
                className="bg-slate-900 border-slate-850 hover:border-teal-500/30 hover:bg-slate-900/80 transition-all text-slate-100 shadow-md cursor-pointer select-none active:scale-97 group flex flex-col justify-between"
              >
                <CardHeader className="p-3.5 pb-2">
                  <Badge className="w-fit self-end bg-slate-950 text-slate-400 text-[9px] font-semibold border-slate-850">
                    {item.category}
                  </Badge>
                </CardHeader>
                <CardContent className="p-3.5 pt-0 text-right flex-1 flex flex-col justify-end space-y-2">
                  <h3 className="font-bold text-xs group-hover:text-teal-400 transition-colors">{item.name}</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-teal-400 text-xs font-bold font-mono">{item.price.toFixed(2)} ر.س</span>
                    <span className="h-6 w-6 rounded-full bg-slate-950 text-slate-450 border border-slate-800 flex items-center justify-center group-hover:bg-teal-500 group-hover:text-slate-950 transition-all">
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Hidden Print Receipt Template */}
      <div className="hidden print:block absolute inset-0 bg-white text-black p-4 text-right" style={{ width: '58mm', fontSize: '12px', fontFamily: 'monospace' }}>
        {lastReceipt && (
          <div className="flex flex-col items-center">
            <h2 className="font-bold text-lg mb-1">رواق الطلبات</h2>
            <p className="text-xs mb-2">فاتورة ضريبية مبسطة</p>
            <div className="w-full border-b border-dashed border-black mb-2"></div>
            
            <div className="w-full text-xs mb-2 space-y-1">
              <div className="flex justify-between"><span>رقم الفاتورة:</span> <span>{lastReceipt.invoiceNumber}</span></div>
              <div className="flex justify-between"><span>التاريخ:</span> <span>{lastReceipt.date}</span></div>
              <div className="flex justify-between"><span>الكاشير:</span> <span>{lastReceipt.cashier}</span></div>
            </div>
            
            <div className="w-full border-b border-dashed border-black mb-2"></div>
            <table className="w-full text-xs mb-2">
              <thead>
                <tr className="border-b border-black">
                  <th className="text-right">الصنف</th>
                  <th className="text-center">الكمية</th>
                  <th className="text-left">السعر</th>
                </tr>
              </thead>
              <tbody>
                {lastReceipt.items.map((item: any, i: number) => (
                  <tr key={i}>
                    <td className="text-right py-1">{item.name}</td>
                    <td className="text-center py-1">{item.qty}</td>
                    <td className="text-left py-1">{(item.price * item.qty).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="w-full border-b border-dashed border-black mb-2"></div>
            <div className="w-full text-xs space-y-1 font-bold">
              <div className="flex justify-between"><span>المجموع الفرعي:</span> <span>{lastReceipt.subtotal.toFixed(2)} ر.س</span></div>
              <div className="flex justify-between"><span>الضريبة:</span> <span>{lastReceipt.tax.toFixed(2)} ر.س</span></div>
              <div className="flex justify-between text-sm mt-1"><span>الإجمالي:</span> <span>{lastReceipt.total.toFixed(2)} ر.س</span></div>
              <div className="flex justify-between mt-1"><span>طريقة الدفع:</span> <span>{lastReceipt.method}</span></div>
            </div>
            <div className="w-full border-b border-dashed border-black my-2"></div>
            <p className="text-xs text-center">شكراً لزيارتكم!</p>
          </div>
        )}
      </div>

    </div>
  );
}
