"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChefHat,
  CircleMinus,
  CirclePlus,
  Clock3,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Send,
  ShoppingBasket,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CatalogItem = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  taxRate: number;
  imageUrl: string | null;
};

type RestaurantTable = {
  id: string;
  number: number;
  name: string;
  zone: string;
  seats: number;
  status: string;
};

type KitchenStation = { id: string; code: string; name: string; displayOrder: number };
type CartLine = {
  clientLineId: string;
  item: CatalogItem;
  quantity: number;
  stationId: string;
  notes: string;
};
type ActiveOrder = {
  id: string;
  order_number: string;
  status: string;
  priority: "normal" | "rush";
  total: number;
  submitted_at: string;
  items: Array<{ id: string; item_name: string; quantity: number; status: string }>;
};

const orderStatusLabels: Record<string, string> = {
  submitted: "أُرسل للمطبخ",
  accepted: "قبله المطبخ",
  preparing: "قيد التحضير",
  ready: "جاهز في Expo",
  served: "تم التقديم",
};

function departmentHeaders(json = false): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("rwq_dept_key") : null;
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { "x-department-key": token } : {}),
  };
}

export default function WaiterPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("الكل");
  const [tableId, setTableId] = useState("");
  const [guestCount, setGuestCount] = useState("1");
  const [priority, setPriority] = useState<"normal" | "rush">("normal");
  const [orderNotes, setOrderNotes] = useState("");
  const [allergens, setAllergens] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [catalogResponse, ordersResponse] = await Promise.all([
        fetch("/api/department/restaurant-orders/catalog", { headers: departmentHeaders() }),
        fetch("/api/department/restaurant-orders", { headers: departmentHeaders() }),
      ]);
      const [catalogResult, ordersResult] = await Promise.all([
        catalogResponse.json(),
        ordersResponse.json(),
      ]);
      if (!catalogResponse.ok || !catalogResult.success) {
        throw new Error(catalogResult.error || "تعذر تحميل منيو النادل.");
      }
      if (!ordersResponse.ok || !ordersResult.success) {
        throw new Error(ordersResult.error || "تعذر تحميل الطلبات النشطة.");
      }
      setItems(catalogResult.items ?? []);
      setTables(catalogResult.tables ?? []);
      setStations(catalogResult.stations ?? []);
      setOrders(ordersResult.orders ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر الاتصال بالخادم.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const categories = useMemo(
    () => ["الكل", ...Array.from(new Set(items.map((item) => item.category)))],
    [items],
  );
  const visibleItems = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("ar");
    return items.filter(
      (item) =>
        (category === "الكل" || item.category === category) &&
        (!needle || item.name.toLocaleLowerCase("ar").includes(needle) || item.code.toLowerCase().includes(needle)),
    );
  }, [category, items, search]);
  const estimatedTotal = useMemo(
    () => cart.reduce((total, line) => total + line.item.price * line.quantity, 0),
    [cart],
  );

  const addItem = (item: CatalogItem) => {
    if (!stations[0]) {
      setError("لا توجد محطة تحضير نشطة. أنشئ جهاز المطبخ أو المحطة أولاً.");
      return;
    }
    setCart((current) => {
      const existing = current.find((line) => line.item.id === item.id && !line.notes);
      if (existing) {
        return current.map((line) =>
          line.clientLineId === existing.clientLineId
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }
      return [
        ...current,
        {
          clientLineId: crypto.randomUUID(),
          item,
          quantity: 1,
          stationId: stations[0].id,
          notes: "",
        },
      ];
    });
  };

  const updateQuantity = (clientLineId: string, delta: number) => {
    setCart((current) =>
      current
        .map((line) =>
          line.clientLineId === clientLineId
            ? { ...line, quantity: Math.max(0, line.quantity + delta) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  };

  const submitOrder = async () => {
    if (cart.length === 0) return;
    if (cart.some((line) => !line.stationId)) {
      setError("حدد محطة التحضير لكل عنصر.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/department/restaurant-orders", {
        method: "POST",
        headers: departmentHeaders(true),
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          tableId: tableId || null,
          channel: tableId ? "dine_in" : "pickup",
          guestCount: tableId ? Number(guestCount) : null,
          priority,
          notes: orderNotes || null,
          allergens: allergens.split(",").map((value) => value.trim()).filter(Boolean),
          currency: "JOD",
          items: cart.map((line) => ({
            clientLineId: line.clientLineId,
            stationId: line.stationId,
            catalogItemId: line.item.id,
            quantity: line.quantity,
            notes: line.notes || null,
            allergens: [],
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "فشل إرسال الطلب.");
      setSuccess(`تم إرسال الطلب ${result.order.order_number} إلى المطبخ بنجاح.`);
      setCart([]);
      setOrderNotes("");
      setAllergens("");
      setPriority("normal");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "تعذر إرسال الطلب.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-500 text-slate-950">
              <UtensilsCrossed className="h-6 w-6" />
            </span>
            <div>
              <h1 className="font-black">شاشة النادل</h1>
              <p className="text-xs text-slate-400">طلب واحد من الطاولة إلى KDS ثم Expo</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading} className="border-white/15 bg-transparent">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { localStorage.removeItem("rwq_dept_key"); window.location.href = "/d/gate"; }} aria-label="تسجيل الخروج">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_390px]">
        <section className="space-y-4">
          {error && <div className="flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200"><AlertTriangle className="h-5 w-5 shrink-0" />{error}</div>}
          {success && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{success}</div>}

          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((value) => (
              <Button key={value} size="sm" variant={category === value ? "default" : "outline"} onClick={() => setCategory(value)} className={category === value ? "bg-teal-500 text-slate-950 hover:bg-teal-400" : "border-white/15 bg-transparent"}>
                {value}
              </Button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث عن صنف أو كود..." className="border-white/10 bg-slate-900 pr-10" />
          </div>

          {loading ? (
            <div className="grid min-h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-teal-400" /></div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {visibleItems.map((item) => (
                <button key={item.id} onClick={() => addItem(item)} className="rounded-2xl border border-white/10 bg-slate-900 p-3 text-right transition hover:-translate-y-0.5 hover:border-teal-400/50 hover:bg-slate-800">
                  <div className="mb-3 grid aspect-[4/3] place-items-center overflow-hidden rounded-xl bg-slate-800">
                    {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : <ChefHat className="h-8 w-8 text-slate-600" />}
                  </div>
                  <p className="line-clamp-2 min-h-10 text-sm font-bold">{item.name}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">{item.category}</span>
                    <strong className="text-teal-300">{item.price.toFixed(2)} د.أ</strong>
                  </div>
                </button>
              ))}
            </div>
          )}

          <Card className="border-white/10 bg-slate-900 text-slate-100">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-5 w-5 text-teal-400" />الطلبات النشطة</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {orders.length === 0 && <p className="text-sm text-slate-500">لا توجد طلبات نشطة حالياً.</p>}
              {orders.map((order) => (
                <div key={order.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                  <div className="flex items-center justify-between">
                    <strong>{order.order_number}</strong>
                    <Badge variant="outline" className={order.priority === "rush" ? "border-rose-400 text-rose-300" : "border-white/15 text-slate-300"}>{orderStatusLabels[order.status] ?? order.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{order.items.map((item) => `${item.item_name} × ${Number(item.quantity)}`).join(" • ")}</p>
                  <p className="mt-2 text-sm font-bold text-teal-300">{Number(order.total).toFixed(2)} د.أ</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="border-white/10 bg-slate-900 text-slate-100">
            <CardHeader><CardTitle className="flex items-center justify-between text-base"><span className="flex items-center gap-2"><ShoppingBasket className="h-5 w-5 text-teal-400" />الطلب الحالي</span><Badge>{cart.length}</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>الطاولة</Label><select value={tableId} onChange={(event) => setTableId(event.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-slate-950 px-3 text-sm"><option value="">سفري / استلام</option>{tables.map((table) => <option key={table.id} value={table.id} disabled={table.status !== "available" && table.status !== "reserved"}>{table.name} — {table.status}</option>)}</select></div>
                <div className="space-y-1.5"><Label>عدد الضيوف</Label><Input type="number" min={1} max={500} value={guestCount} onChange={(event) => setGuestCount(event.target.value)} disabled={!tableId} className="border-white/10 bg-slate-950" /></div>
              </div>
              <Button type="button" variant="outline" onClick={() => setPriority((value) => value === "normal" ? "rush" : "normal")} className={`w-full border-white/10 ${priority === "rush" ? "border-rose-400/50 bg-rose-500/10 text-rose-200" : "bg-slate-950"}`}>
                <Zap className="h-4 w-4" />{priority === "rush" ? "طلب مستعجل" : "أولوية عادية"}
              </Button>

              <div className="max-h-[42vh] space-y-3 overflow-y-auto pl-1">
                {cart.length === 0 && <p className="py-8 text-center text-sm text-slate-500">اضغط على الأصناف لإضافتها.</p>}
                {cart.map((line) => (
                  <div key={line.clientLineId} className="space-y-2 rounded-xl border border-white/10 bg-slate-950/70 p-3">
                    <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-bold">{line.item.name}</p><p className="text-xs text-teal-300">{(line.item.price * line.quantity).toFixed(2)} د.أ</p></div><div className="flex items-center gap-2"><button onClick={() => updateQuantity(line.clientLineId, -1)} aria-label="إنقاص"><CircleMinus className="h-5 w-5" /></button><b>{line.quantity}</b><button onClick={() => updateQuantity(line.clientLineId, 1)} aria-label="زيادة"><CirclePlus className="h-5 w-5" /></button></div></div>
                    <select value={line.stationId} onChange={(event) => setCart((current) => current.map((value) => value.clientLineId === line.clientLineId ? { ...value, stationId: event.target.value } : value))} className="h-9 w-full rounded-md border border-white/10 bg-slate-900 px-2 text-xs">{stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select>
                    <Input value={line.notes} onChange={(event) => setCart((current) => current.map((value) => value.clientLineId === line.clientLineId ? { ...value, notes: event.target.value } : value))} placeholder="ملاحظة للصنف..." className="h-9 border-white/10 bg-slate-900 text-xs" />
                  </div>
                ))}
              </div>

              <Input value={allergens} onChange={(event) => setAllergens(event.target.value)} placeholder="حساسيات عامة، مفصولة بفاصلة" className="border-amber-400/20 bg-slate-950" />
              <Input value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} placeholder="ملاحظات الطلب..." className="border-white/10 bg-slate-950" />
              <div className="flex items-center justify-between border-t border-white/10 pt-3"><span className="text-sm text-slate-400">الإجمالي التقديري</span><strong className="text-xl text-teal-300">{estimatedTotal.toFixed(2)} د.أ</strong></div>
              <Button onClick={() => void submitOrder()} disabled={submitting || cart.length === 0} className="h-12 w-full bg-teal-500 font-black text-slate-950 hover:bg-teal-400">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                إرسال للمطبخ
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
