"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ChefHat, CookingPot, LogOut, Clock, CheckCircle2, 
  Search, ClipboardCheck, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type OrderItem = {
  id: string;
  name: string;
  qty: number;
  modifierSummary?: string;
};

type DeviceSession = {
  token: string;
  name: string;
  orgId: string;
  branchId: string;
  role: string;
};

type Order = {
  id: string;
  invoice_number: string;
  customer_name: string;
  table_number?: string;
  items: OrderItem[];
  status: "pending" | "preparing" | "ready";
  minutes: number;
  notes?: string;
};

type KitchenTicketApiItem = {
  id: string;
  name: string;
  quantity: string | number;
  notes: string | null;
  modifier_summary: string | null;
  status: string;
};

type KitchenTicketApiRow = {
  id: string;
  ticket_number: string;
  customer_name: string | null;
  table_number: string | null;
  channel: string | null;
  status: "pending" | "preparing" | "ready";
  notes: string | null;
  opened_at: string;
  kitchen_ticket_items: KitchenTicketApiItem[];
};

function parseAllowedModules() {
  try {
    const parsed = JSON.parse(localStorage.getItem("rwq_dept_allowed") || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function minutesSince(isoDate: string) {
  const timestamp = new Date(isoDate).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
}

function mapTicketToOrder(ticket: KitchenTicketApiRow): Order {
  return {
    id: ticket.id,
    invoice_number: ticket.ticket_number,
    customer_name: ticket.customer_name || "عميل",
    table_number: ticket.table_number || (ticket.channel === "delivery" ? "طلب توصيل" : "طلب سفري"),
    items: (ticket.kitchen_ticket_items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      qty: Number(item.quantity ?? 0),
      modifierSummary: item.modifier_summary ?? undefined,
    })),
    status: ticket.status,
    minutes: minutesSince(ticket.opened_at),
    notes: ticket.notes ?? undefined,
  };
}

export default function ExpoWorkspace() {
  const router = useRouter();
  const [device, setDevice] = useState<DeviceSession>({ token: "", name: "", orgId: "", branchId: "", role: "" });
  const [authorized, setAuthorized] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  
  // Track checked off items per ticket
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("rwq_dept_key");
    const role = localStorage.getItem("rwq_dept_role");
    const allowed = parseAllowedModules();

    // Expo is allowed for both pos and recipes departments
    if (!token || (!allowed.includes("recipes") && !allowed.includes("pos"))) {
      router.push("/d/gate");
      return;
    }

    const deviceToken = token;
    const session = {
      token: deviceToken,
      role: role ?? "runner",
      orgId: localStorage.getItem("rwq_dept_org_id") ?? "",
      branchId: localStorage.getItem("rwq_dept_branch_id") ?? "",
      name: localStorage.getItem("rwq_dept_device") ?? "شاشة التجميع (Expo)",
    };

    setDevice(session);
    setAuthorized(true);
    setLoadingOrders(true);

    async function loadTickets() {
      const response = await fetch("/api/department/kitchen/tickets", {
        headers: { "x-department-key": deviceToken },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "تعذر تحميل طلبات التجميع.");
      }

      if (!cancelled) {
        setOrders((payload.tickets ?? []).map(mapTicketToOrder));
        setOrdersError(null);
      }
    }

    loadTickets()
      .catch((error: Error) => {
        if (!cancelled) {
          setOrders([]);
          setOrdersError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingOrders(false);
      });

    const intervalId = window.setInterval(() => {
      loadTickets().catch((error: Error) => {
        if (!cancelled) setOrdersError(error.message);
      });
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [router]);

  const updateOrderStatus = async (id: string, nextStatus: "preparing" | "ready") => {
    const previousOrders = orders;
    setOrders((prev) => prev.map((ord) => (ord.id === id ? { ...ord, status: nextStatus } : ord)));

    const response = await fetch(`/api/department/kitchen/tickets/${id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-department-key": device.token,
      },
      body: JSON.stringify({ status: nextStatus }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.success) {
      setOrders(previousOrders);
      setOrdersError(payload.error ?? "تعذر تحديث حالة الطلب.");
      return;
    }

    setOrdersError(null);
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

  const toggleItemCheck = (itemId: string) => {
    setCheckedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  if (!authorized) return null;

  const activeOrders = orders.filter(o => o.status !== "ready");

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
      
      {/* Immersive Dark Expo Header */}
      <header className="h-16 shrink-0 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center">
            <ClipboardCheck className="h-5.5 w-5.5" />
          </span>
          <div>
            <h1 className="font-bold text-sm tracking-wide">شاشة التجميع والتسليم (Expo)</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">الجهاز: {device.name} | الفرع الموثق</p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="border-slate-800 bg-slate-900/50 hover:bg-rose-950/30 hover:border-rose-900/50 text-rose-400 h-10 w-10 p-0" 
            onClick={handleLogout}
            title="تسجيل الخروج وإلغاء الجهاز"
          >
            <LogOut className="h-4.5 w-4.5" />
          </Button>
        </div>
      </header>

      {/* Expo Workspace Body */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6 text-right">
        <div className="flex items-center justify-between border-b border-slate-900 pb-3">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <CookingPot className="h-5 w-5 text-blue-400" />
            تجميع الطلبات النشطة ({activeOrders.length})
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> بانتظار التحضير</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-400" /> قيد التجهيز</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-600" /> متأخر (SLA)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loadingOrders && (
            <div className="col-span-full rounded-xl border border-slate-800 bg-slate-900/70 p-5 text-center text-xs text-slate-400">
              جاري تحميل الطلبات...
            </div>
          )}

          {ordersError && (
            <div className="col-span-full rounded-xl border border-rose-900/60 bg-rose-950/30 p-5 text-center text-xs text-rose-200">
              {ordersError}
            </div>
          )}

          {!loadingOrders && !ordersError && activeOrders.length === 0 && (
            <div className="col-span-full rounded-xl border border-slate-800 bg-slate-900/70 p-8 text-center text-xs text-slate-400">
              لا توجد طلبات تجميع نشطة الآن.
            </div>
          )}

          {activeOrders.map((order) => {
            // SLA alert logic
            const isLate = order.minutes >= 10;
            const isCritical = order.minutes >= 15;
            
            let cardBorderClass = "border-t-4 border-t-amber-500";
            if (order.status === "preparing") cardBorderClass = "border-t-4 border-t-teal-500";
            if (isLate) cardBorderClass = "border-t-4 border-t-amber-600 bg-amber-950/10";
            if (isCritical) cardBorderClass = "border-t-4 border-t-rose-600 bg-rose-950/20 animate-pulse";

            // Allergen alert logic
            const isAllergy = order.notes?.includes("حساسية") || 
                              order.notes?.toLowerCase().includes("allergy") || 
                              order.items.some(i => i.modifierSummary?.includes("حساسية") || i.modifierSummary?.includes("مكسرات") || i.modifierSummary?.includes("غلوتين"));

            // Check if all items in this order are checked off
            const allChecked = order.items.every(item => checkedItems[item.id]);

            return (
              <Card 
                key={order.id} 
                className={`bg-slate-900 border-slate-800 text-slate-100 shadow-lg relative overflow-hidden transition-all duration-200 ${cardBorderClass}`}
              >
                <CardHeader className="py-3.5 border-b border-slate-800 bg-slate-950/30 flex flex-row items-center justify-between">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">{order.invoice_number}</span>
                    <span className="font-bold text-xs text-slate-200 mt-1 block">{order.customer_name}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge className={order.status === "preparing" ? "bg-teal-500 text-slate-950" : "bg-amber-500 text-slate-950"}>
                      {order.table_number || "دليفري"}
                    </Badge>
                    {isAllergy && (
                      <Badge className="bg-rose-600 text-white animate-bounce text-[9px] font-bold">
                        ⚠️ تنبيه حساسية!
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Checklist of Items */}
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-400 font-bold border-b border-slate-800 pb-1">قائمة الأصناف للتجميع:</p>
                    <ul className="space-y-2.5">
                      {order.items.map((item) => (
                        <li 
                          key={item.id} 
                          onClick={() => toggleItemCheck(item.id)}
                          className={`relative flex justify-between items-center text-xs font-semibold pb-2 border-b border-slate-800/40 cursor-pointer select-none transition-colors ${
                            checkedItems[item.id] ? "text-slate-500 line-through decoration-slate-650" : "text-slate-100 hover:bg-slate-800/30"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                              checkedItems[item.id] ? "bg-blue-600 border-blue-600 text-white" : "border-slate-700 bg-slate-950"
                            }`}>
                              {checkedItems[item.id] && <span className="text-[9px] font-black">✓</span>}
                            </span>
                            <span>{item.name}</span>
                          </div>
                          <span className={`h-6 w-6 rounded-full flex items-center justify-center border text-[11px] ${
                            checkedItems[item.id] ? "bg-slate-950 text-slate-600 border-slate-850" : "bg-slate-950 text-blue-400 border-slate-800"
                          }`}>
                            x{item.qty}
                          </span>
                          {item.modifierSummary && (
                            <span className="absolute inset-x-0 -bottom-3.5 text-[9px] text-amber-300/80 text-center px-2 truncate">
                              {item.modifierSummary}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {order.notes && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-2.5 rounded-lg text-[10px] leading-relaxed flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span><strong>تنبيه الزبون:</strong> {order.notes}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      منذ {formatNumber(order.minutes)} دقيقة
                    </span>
                  </div>

                  {/* Operational Action triggers */}
                  <div className="pt-2 border-t border-slate-850 flex gap-2">
                    <Button 
                      onClick={() => updateOrderStatus(order.id, "ready")}
                      disabled={!allChecked}
                      className={`flex-1 text-xs h-9 flex items-center gap-1.5 font-bold justify-center transition-colors ${
                        allChecked 
                          ? "bg-green-600 hover:bg-green-700 text-white" 
                          : "bg-slate-800 text-slate-500 border border-slate-750 cursor-not-allowed"
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      تم التجميع والتسليم
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  return String(num);
}
