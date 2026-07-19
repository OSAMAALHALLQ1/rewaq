"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCheck,
  ChefHat,
  Clock3,
  Loader2,
  LogOut,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  TimerReset,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type BoardMode = "kitchen" | "expo";
type BoardItem = {
  id: string;
  orderId: string;
  stationId: string;
  itemName: string;
  quantity: number;
  notes: string | null;
  allergens: string[];
  modifiers: Array<{ name?: string; option_name?: string }>;
  status: string;
  createdAt: string;
};
type BoardOrder = {
  id: string;
  order_number: string;
  status: string;
  restaurant_table_id: string | null;
  waiter_name: string | null;
  customer_name: string | null;
  guest_count: number | null;
  priority: "normal" | "rush";
  notes: string | null;
  allergens: string[];
  submitted_at: string;
  items: BoardItem[];
};
type Station = { id: string; code: string; name: string; display_order: number };

function departmentHeaders(json = false): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("rwq_dept_key") : null;
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { "x-department-key": token } : {}),
  };
}

function minutesSince(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
}

function ageStyle(minutes: number) {
  if (minutes >= 25) return "border-rose-500/60 bg-rose-950/30";
  if (minutes >= 15) return "border-amber-500/50 bg-amber-950/20";
  return "border-white/10 bg-slate-900";
}

export function RestaurantOrderBoard({ mode }: { mode: BoardMode }) {
  const [orders, setOrders] = useState<BoardOrder[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [stationFilter, setStationFilter] = useState("all");
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [workingOrderId, setWorkingOrderId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadBoard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/department/restaurant-orders/kitchen?mode=${mode}`, {
        headers: departmentHeaders(),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "تعذر تحميل لوحة الطلبات.");
      setOrders(result.orders ?? []);
      setStations(result.stations ?? []);
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر الاتصال بالخادم.");
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void loadBoard();
    const timer = window.setInterval(() => void loadBoard(true), 10_000);
    return () => window.clearInterval(timer);
  }, [loadBoard]);

  const visibleOrders = useMemo(() => {
    if (stationFilter === "all") return orders;
    return orders
      .map((order) => ({ ...order, items: order.items.filter((item) => item.stationId === stationFilter) }))
      .filter((order) => order.items.length > 0);
  }, [orders, stationFilter]);

  const transition = async (order: BoardOrder, targetStatus: "preparing" | "ready" | "served") => {
    const itemIds = order.items.map((item) => item.id);
    if (itemIds.length === 0) return;
    setWorkingOrderId(order.id);
    setError("");
    try {
      const response = await fetch(`/api/department/restaurant-orders/${order.id}/status`, {
        method: "PATCH",
        headers: departmentHeaders(true),
        body: JSON.stringify({
          targetStatus,
          itemIds,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "تعذر تحديث الطلب.");
      setCheckedItems((current) => {
        const next = new Set(current);
        itemIds.forEach((id) => next.delete(id));
        return next;
      });
      await loadBoard(true);
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : "تعذر تحديث الطلب.");
    } finally {
      setWorkingOrderId(null);
    }
  };

  const title = mode === "kitchen" ? "شاشة المطبخ KDS" : "شاشة التجميع والتسليم Expo";
  const subtitle = mode === "kitchen"
    ? "استلام الطلبات وبدء التحضير ثم إعلان الجاهزية"
    : "مطابقة جميع عناصر الطلب ثم إثبات التقديم";

  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`grid h-11 w-11 place-items-center rounded-2xl ${mode === "kitchen" ? "bg-amber-400 text-slate-950" : "bg-teal-400 text-slate-950"}`}>
              {mode === "kitchen" ? <ChefHat className="h-6 w-6" /> : <PackageCheck className="h-6 w-6" />}
            </span>
            <div><h1 className="font-black">{title}</h1><p className="text-xs text-slate-400">{subtitle}</p></div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {lastUpdated && <span>آخر تحديث {lastUpdated.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
            <Button variant="outline" size="sm" onClick={() => void loadBoard()} disabled={loading} className="border-white/15 bg-transparent"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />تحديث</Button>
            <Button variant="ghost" size="icon" onClick={() => { localStorage.removeItem("rwq_dept_key"); window.location.href = "/d/gate"; }} aria-label="تسجيل الخروج"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] space-y-4 p-4">
        {error && <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200"><AlertTriangle className="h-5 w-5" />{error}</div>}
        <div className="flex gap-2 overflow-x-auto">
          <Button size="sm" variant={stationFilter === "all" ? "default" : "outline"} onClick={() => setStationFilter("all")} className={stationFilter === "all" ? "bg-teal-500 text-slate-950" : "border-white/15 bg-transparent"}>كل المحطات</Button>
          {stations.map((station) => <Button key={station.id} size="sm" variant={stationFilter === station.id ? "default" : "outline"} onClick={() => setStationFilter(station.id)} className={stationFilter === station.id ? "bg-teal-500 text-slate-950" : "border-white/15 bg-transparent"}>{station.name}</Button>)}
        </div>

        {loading ? (
          <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-10 w-10 animate-spin text-teal-400" /></div>
        ) : visibleOrders.length === 0 ? (
          <div className="grid min-h-[55vh] place-items-center rounded-3xl border border-dashed border-white/10 bg-slate-900/30 text-center"><div><CheckCheck className="mx-auto mb-3 h-12 w-12 text-emerald-400" /><h2 className="font-black">لا توجد طلبات في الانتظار</h2><p className="mt-1 text-sm text-slate-500">ستظهر الطلبات الجديدة هنا تلقائياً.</p></div></div>
        ) : (
          <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visibleOrders.map((order) => {
              const age = minutesSince(order.submitted_at);
              const allChecked = order.items.every((item) => checkedItems.has(item.id));
              const hasPreparing = order.items.some((item) => item.status === "preparing");
              return (
                <Card key={order.id} className={`${ageStyle(age)} overflow-hidden text-slate-100 shadow-2xl`}>
                  <CardHeader className="space-y-3 border-b border-white/10 pb-3">
                    <div className="flex items-center justify-between gap-2"><CardTitle className="text-lg">{order.order_number}</CardTitle><div className="flex gap-1">{order.priority === "rush" && <Badge className="bg-rose-500 text-white"><Zap className="ml-1 h-3 w-3" />مستعجل</Badge>}<Badge variant="outline" className="border-white/15 text-slate-300"><Clock3 className="ml-1 h-3 w-3" />{age} د</Badge></div></div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-400"><span>{order.waiter_name || "نادل غير مسمى"}</span>{order.guest_count && <span>• {order.guest_count} ضيوف</span>}{order.customer_name && <span>• {order.customer_name}</span>}</div>
                    {(order.allergens?.length > 0 || order.items.some((item) => item.allergens?.length > 0)) && <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-2 text-xs font-bold text-amber-200"><AlertTriangle className="h-4 w-4 shrink-0" />حساسية: {[...(order.allergens ?? []), ...order.items.flatMap((item) => item.allergens ?? [])].join("، ")}</div>}
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    {order.items.map((item) => {
                      const checked = checkedItems.has(item.id);
                      return <button key={item.id} type="button" disabled={mode === "kitchen"} onClick={() => mode === "expo" && setCheckedItems((current) => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })} className={`w-full rounded-xl border p-3 text-right transition ${checked ? "border-emerald-400/50 bg-emerald-500/10" : "border-white/10 bg-slate-950/70"}`}><div className="flex items-start justify-between gap-2"><div><p className={`font-bold ${checked ? "line-through text-slate-400" : ""}`}>{item.quantity} × {item.itemName}</p>{item.notes && <p className="mt-1 text-xs font-semibold text-amber-300">ملاحظة: {item.notes}</p>}{item.modifiers?.length > 0 && <p className="mt-1 text-xs text-slate-500">{item.modifiers.map((modifier) => modifier.option_name || modifier.name).filter(Boolean).join("، ")}</p>}</div>{mode === "expo" && <span className={`grid h-6 w-6 place-items-center rounded-full border ${checked ? "border-emerald-400 bg-emerald-400 text-slate-950" : "border-white/20"}`}>{checked && <Check className="h-4 w-4" />}</span>}</div><div className="mt-2"><Badge variant="outline" className="border-white/10 text-[10px] text-slate-400">{item.status}</Badge></div></button>;
                    })}
                    {order.notes && <p className="rounded-lg bg-slate-950/70 p-2 text-xs text-slate-300">ملاحظة الطلب: {order.notes}</p>}
                    {mode === "kitchen" ? (
                      <div className="grid grid-cols-2 gap-2">
                        <Button onClick={() => void transition(order, "preparing")} disabled={workingOrderId === order.id || hasPreparing} variant="outline" className="border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20"><TimerReset className="h-4 w-4" />بدء التحضير</Button>
                        <Button onClick={() => void transition(order, "ready")} disabled={workingOrderId === order.id} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">{workingOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}جاهز</Button>
                      </div>
                    ) : (
                      <Button onClick={() => void transition(order, "served")} disabled={workingOrderId === order.id || !allChecked} className="h-11 w-full bg-teal-400 font-black text-slate-950 hover:bg-teal-300">{workingOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : allChecked ? <PackageCheck className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />} {allChecked ? "تأكيد التقديم" : "طابق جميع العناصر أولاً"}</Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
