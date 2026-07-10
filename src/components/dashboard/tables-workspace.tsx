"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Armchair, CircleDollarSign, Clock3, Plus, Table2, Users,
  X, CheckCircle, AlertTriangle, ArrowLeftRight, Ban
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";
import {
  openTableSession,
  updateTableStatus,
  addOrderToTable,
  mergeTables
} from "@/server/actions/tables";
import type { RestaurantTable, RestaurantTableStatus } from "@/types/domain";

type TablesWorkspaceProps = {
  initialTables: RestaurantTable[];
  branches: Array<{ id: string; name: string }>;
};

const statusLabels: Record<RestaurantTableStatus, string> = {
  available: "فارغة",
  occupied: "مشغولة",
  reserved: "محجوزة",
  needs_cleaning: "تحتاج تنظيف",
};

const statusTones: Record<RestaurantTableStatus, "success" | "danger" | "warning" | "muted"> = {
  available: "success",
  occupied: "danger",
  reserved: "warning",
  needs_cleaning: "muted",
};

const tableColors = (status: RestaurantTableStatus, isSelected: boolean) => {
  const base = {
    available: "border-green-200 bg-green-50/50 hover:bg-green-50 text-green-900",
    occupied: "border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-900",
    reserved: "border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-900",
    needs_cleaning: "border-slate-200 bg-slate-100 hover:bg-slate-200/60 text-slate-700",
  }[status];
  return `${base} ${isSelected ? "ring-2 ring-primary border-primary" : ""}`;
};

// Mock catalog for table orders
const CATALOG_ITEMS = [
  { id: "1", name: "برجر كلاسيك", price: 30 },
  { id: "2", name: "بطاطا مقلية عائلية", price: 15 },
  { id: "3", name: "كوكا كولا", price: 6 },
  { id: "4", name: "وجبة شاورما دبل", price: 40 },
  { id: "5", name: "أرز بخاري باللحم", price: 55 },
];

export default function TablesWorkspaceClient({ initialTables, branches }: TablesWorkspaceProps) {
  const router = useRouter();
  const [tables, setTables] = useState<RestaurantTable[]>(initialTables);
  const [selectedTableId, setSelectedTableId] = useState<string>(
    initialTables.find((t) => t.status === "occupied")?.id || initialTables[0]?.id || ""
  );

  // Modal control states
  const [openModal, setOpenModal] = useState(false);
  const [waiterName, setWaiterName] = useState("");
  const [guestsCount, setGuestsCount] = useState(2);

  const [addOrderModal, setAddOrderModal] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState("1");
  const [orderQty, setOrderQty] = useState(1);

  const [mergeModal, setMergeModal] = useState(false);
  const [targetTableId, setTargetTableId] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTable = tables.find((t) => t.id === selectedTableId) || tables[0];
  const occupiedTables = tables.filter((t) => t.status === "occupied");
  const openTotal = occupiedTables.reduce((sum, t) => sum + t.currentTotal, 0);

  const handleSelectTable = (id: string) => {
    setSelectedTableId(id);
    setError(null);
  };

  const handleOpenTable = async () => {
    if (!waiterName.trim()) {
      setError("الرجاء إدخال اسم الجرسون");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await openTableSession(selectedTable.id, waiterName.trim(), guestsCount);
      if (res && res.success) {
        // Sync client state
        setTables(prev => prev.map(t => t.id === selectedTable.id ? {
          ...t,
          status: "occupied",
          waiterName: waiterName.trim(),
          guests: guestsCount,
          openedAt: new Date().toISOString(),
          currentTotal: 0,
          orderItems: [],
        } : t));
        setOpenModal(false);
        setWaiterName("");
      } else {
        setError(res?.error || "فشل فتح الطاولة");
      }
    } catch {
      setError("فشل فتح الطاولة");
    } finally {
      setBusy(false);
    }
  };

  const handleAddOrder = async () => {
    const item = CATALOG_ITEMS.find(c => c.id === selectedCatalogId);
    if (!item) return;

    setBusy(true);
    setError(null);
    try {
      const res = await addOrderToTable(selectedTable.id, [{ name: item.name, quantity: orderQty, price: item.price }]);
      if (res && res.success) {
        setTables(prev => prev.map(t => {
          if (t.id === selectedTable.id) {
            const existing = [...(t.orderItems || [])];
            const existItem = existing.find(i => i.name === item.name);
            if (existItem) {
              existItem.quantity += orderQty;
              existItem.total += item.price * orderQty;
            } else {
              existing.push({ name: item.name, quantity: orderQty, total: item.price * orderQty });
            }
            return {
              ...t,
              status: "occupied",
              currentTotal: (t.currentTotal || 0) + (item.price * orderQty),
              orderItems: existing,
            };
          }
          return t;
        }));
        setAddOrderModal(false);
        setOrderQty(1);
      } else {
        setError(res?.error || "فشل إضافة الطلب");
      }
    } catch {
      setError("فشل إضافة الطلب");
    } finally {
      setBusy(false);
    }
  };

  const handleMerge = async () => {
    if (!targetTableId) {
      setError("الرجاء اختيار الطاولة المستهدفة للدمج");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await mergeTables(selectedTable.id, targetTableId);
      if (res && res.success) {
        const srcTable = tables.find(t => t.id === selectedTable.id);
        setTables(prev => prev.map(t => {
          if (t.id === targetTableId) {
            return {
              ...t,
              status: "occupied",
              currentTotal: (t.currentTotal || 0) + (srcTable?.currentTotal || 0),
              orderItems: [...(t.orderItems || []), ...(srcTable?.orderItems || [])],
            };
          }
          if (t.id === selectedTable.id) {
            return {
              ...t,
              status: "available",
              currentTotal: 0,
              orderItems: [],
              waiterName: undefined,
              guests: undefined,
              openedAt: undefined,
            };
          }
          return t;
        }));
        setMergeModal(false);
        setTargetTableId("");
      } else {
        setError(res?.error || "فشل دمج الطاولات");
      }
    } catch {
      setError("فشل دمج الطاولات");
    } finally {
      setBusy(false);
    }
  };

  const handleChangeStatus = async (status: RestaurantTableStatus) => {
    setBusy(true);
    setError(null);
    try {
      const res = await updateTableStatus(selectedTable.id, status);
      if (res && res.success) {
        setTables(prev => prev.map(t => t.id === selectedTable.id ? {
          ...t,
          status,
          currentTotal: status === "available" ? 0 : t.currentTotal,
          orderItems: status === "available" ? [] : t.orderItems,
          waiterName: status === "available" ? undefined : t.waiterName,
          guests: status === "available" ? undefined : t.guests,
          openedAt: status === "available" ? undefined : t.openedAt,
        } : t));
      } else {
        setError(res?.error || "فشل تعديل حالة الطاولة");
      }
    } catch {
      setError("فشل تعديل حالة الطاولة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="إدارة الطاولات والصالة"
        description="التحكم الفوري بطاولات الخدمة، توزيع الجرسونات والضيوف، تفاصيل الحساب المفتوح، وتمرير الطلبات لنقاط البيع للدفع."
        actions={
          <Button asChild>
            <Link href="/d/pos">
              <CircleDollarSign className="h-4 w-4" />
              شاشة بيع الكاشير
            </Link>
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Select className="max-w-72" defaultValue={branches[0]?.id}>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </Select>
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold pr-2 border-r border-slate-200">
              <Legend tone="bg-green-500" label="فارغة" />
              <Legend tone="bg-rose-500" label="مشغولة" />
              <Legend tone="bg-amber-500" label="محجوزة" />
              <Legend tone="bg-slate-400" label="تحتاج تنظيف" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="إجمالي الطاولات" value={formatNumber(tables.length)} description="كل مناطق الصالة" icon={Table2} />
        <MetricCard label="طاولات مشغولة" value={formatNumber(occupiedTables.length)} description="جلسات طعام نشطة" icon={Users} tone="danger" />
        <MetricCard label="طاولات فارغة" value={formatNumber(tables.filter((t) => t.status === "available").length)} description="جاهزة للاستقبال" icon={Armchair} tone="success" />
        <MetricCard label="قيمة الحساب المفتوح" value={formatCurrency(openTotal)} description="طلبات قيد التحضير والتسليم" icon={CircleDollarSign} tone="warning" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_420px] items-start">
        {/* Main Floor Layout map */}
        <Card className="border-slate-200/60 shadow-sm rounded-2xl bg-white/50 backdrop-blur">
          <CardHeader className="py-4 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="flex items-center gap-2 text-sm font-black text-slate-800">
              <Table2 className="h-4.5 w-4.5 text-primary" />
              خريطة الصالة ومناطق الطاولات
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid gap-6">
              {Array.from(new Set(tables.map((t) => t.zone))).map((zone) => (
                <section key={zone} className="rounded-xl border border-slate-150 bg-white p-4">
                  <div className="mb-3.5 flex items-center justify-between border-b border-slate-50 pb-2">
                    <h3 className="font-black text-slate-800 text-xs">{zone}</h3>
                    <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                      {formatNumber(tables.filter((t) => t.zone === zone).length)} طاولات
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {tables
                      .filter((t) => t.zone === zone)
                      .map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleSelectTable(t.id)}
                          className={`min-h-36 rounded-xl border p-4 text-start transition flex flex-col justify-between ${tableColors(t.status, t.id === selectedTable.id)}`}
                        >
                          <div className="flex items-start justify-between gap-2 w-full">
                            <div>
                              <p className="text-[10px] opacity-75">طاولة</p>
                              <p className="text-3xl font-black">{formatNumber(t.number)}</p>
                            </div>
                            <Badge tone={statusTones[t.status]} className="text-[9px] font-bold">{statusLabels[t.status]}</Badge>
                          </div>
                          <div className="mt-4 space-y-1.5 text-xs w-full">
                            <p className="opacity-80">{formatNumber(t.seats)} مقاعد</p>
                            {t.waiterName ? (
                              <p className="truncate font-semibold text-slate-700">الجرسون: {t.waiterName}</p>
                            ) : (
                              <p className="text-slate-400">جاهزة للاستقبال</p>
                            )}
                            {t.currentTotal > 0 ? (
                              <p className="font-black text-primary mt-1">{formatCurrency(t.currentTotal)}</p>
                            ) : null}
                          </div>
                        </button>
                      ))}
                  </div>
                </section>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right Sidebar: selected table operations details */}
        <Card className="border-slate-200/60 shadow-md rounded-2xl overflow-hidden bg-white">
          <CardHeader className="py-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-black text-slate-800">
              طاولة {formatNumber(selectedTable.number)}
            </CardTitle>
            <Badge tone={statusTones[selectedTable.status]} className="font-bold text-xs">
              {statusLabels[selectedTable.status]}
            </Badge>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-right">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-slate-50/70 border border-slate-100 p-3">
                <p className="text-muted-foreground mb-1">المنطقة</p>
                <p className="font-bold text-slate-800">{selectedTable.zone}</p>
              </div>
              <div className="rounded-xl bg-slate-50/70 border border-slate-100 p-3">
                <p className="text-muted-foreground mb-1">عدد المقاعد</p>
                <p className="font-bold text-slate-800">{formatNumber(selectedTable.seats)}</p>
              </div>
              <div className="rounded-xl bg-slate-50/70 border border-slate-100 p-3">
                <p className="text-muted-foreground mb-1">الجرسون</p>
                <p className="font-bold text-slate-800">{selectedTable.waiterName ?? "غير معين"}</p>
              </div>
              <div className="rounded-xl bg-slate-50/70 border border-slate-100 p-3">
                <p className="text-muted-foreground mb-1">عدد الضيوف</p>
                <p className="font-bold text-slate-800">{selectedTable.guests ? formatNumber(selectedTable.guests) : "0"}</p>
              </div>
            </div>

            {/* Table order items list */}
            {selectedTable.status === "occupied" && (
              <div className="rounded-xl border border-slate-150 p-4 space-y-3 bg-slate-50/30">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <Table2 className="h-4 w-4 text-rose-500" />
                    طلبات الطاولة
                  </h3>
                  {selectedTable.openedAt && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Clock3 className="h-3 w-3" />
                      {new Date(selectedTable.openedAt).toLocaleTimeString("ar-PS", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>

                {!(selectedTable.orderItems?.length) ? (
                  <p className="py-8 text-center text-xs text-slate-450">لا توجد طلبات مسجلة على الطاولة بعد.</p>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {selectedTable.orderItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2 text-xs">
                        <div>
                          <p className="font-bold text-slate-850">{item.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">الكمية: {formatNumber(item.quantity)}</p>
                        </div>
                        <p className="font-bold text-slate-800">{formatCurrency(item.total)}</p>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="bg-primary text-primary-foreground p-3 rounded-lg flex justify-between items-center text-xs font-black">
                  <span>الحساب الحالي:</span>
                  <span className="font-mono text-sm">{formatCurrency(selectedTable.currentTotal)}</span>
                </div>
              </div>
            )}

            {/* Operational Actions Triggers */}
            <div className="pt-2 flex flex-col gap-2">
              {selectedTable.status === "available" && (
                <>
                  <Button onClick={() => setOpenModal(true)} disabled={busy} className="w-full h-10 font-bold bg-green-600 hover:bg-green-750">
                    <Users className="h-4 w-4 ml-1" />
                    فتح الطاولة واستقبال ضيوف
                  </Button>
                  <Button onClick={() => handleChangeStatus("reserved")} disabled={busy} variant="outline" className="w-full h-10 text-amber-600 border-amber-200 bg-amber-50/20 hover:bg-amber-50">
                    حجز الطاولة
                  </Button>
                </>
              )}

              {selectedTable.status === "occupied" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => setAddOrderModal(true)} disabled={busy} className="h-10 bg-slate-900 hover:bg-black font-bold">
                      <Plus className="h-4 w-4 ml-1" /> إضافة طلب
                    </Button>
                    <Button onClick={() => setMergeModal(true)} disabled={busy} variant="outline" className="h-10 font-bold border-slate-350 hover:bg-slate-50 text-slate-700">
                      <ArrowLeftRight className="h-4 w-4 ml-1" /> دمج طاولات
                    </Button>
                  </div>
                  <Button asChild className="w-full h-10 bg-rose-600 hover:bg-rose-750 text-white font-bold">
                    <Link href={`/d/pos?tableId=${selectedTable.id}`}>
                      إغلاق الفاتورة والدفع
                    </Link>
                  </Button>
                  <Button onClick={() => handleChangeStatus("needs_cleaning")} disabled={busy} variant="ghost" className="w-full h-10 text-slate-550 hover:text-slate-750">
                    إخلاء الطاولة وتعيين كتحتاج تنظيف
                  </Button>
                </>
              )}

              {selectedTable.status === "reserved" && (
                <>
                  <Button onClick={() => setOpenModal(true)} disabled={busy} className="w-full h-10 font-bold bg-amber-600 hover:bg-amber-700 text-white">
                    حضور الزبون وفتح الطاولة
                  </Button>
                  <Button onClick={() => handleChangeStatus("available")} disabled={busy} variant="outline" className="w-full h-10 text-rose-600 border-rose-200 bg-rose-50/20 hover:bg-rose-50">
                    <Ban className="h-4 w-4 ml-1" /> إلغاء الحجز
                  </Button>
                </>
              )}

              {selectedTable.status === "needs_cleaning" && (
                <Button onClick={() => handleChangeStatus("available")} disabled={busy} className="w-full h-10 bg-green-600 hover:bg-green-700 font-bold text-white">
                  <CheckCircle className="h-4 w-4 ml-1" /> تم التنظيف وجاهزة للاستقبال
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════ OPEN TABLE MODAL ═══════════ */}
      {openModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col text-right">
            <div className="bg-green-600 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-base flex items-center gap-2"><Users className="h-5 w-5" /> استقبال ضيوف - طاولة {selectedTable.number}</h2>
              <button onClick={() => setOpenModal(false)} className="hover:bg-white/20 p-1 rounded transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 block">الجرسون المسؤول:</label>
                <Input
                  type="text"
                  placeholder="مثال: أحمد، سامر"
                  value={waiterName}
                  onChange={(e) => setWaiterName(e.target.value)}
                  className="bg-slate-50 border-slate-200"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 block">عدد الضيوف (الأفراد):</label>
                <Input
                  type="number"
                  min={1}
                  max={selectedTable.seats + 4}
                  value={guestsCount}
                  onChange={(e) => setGuestsCount(Number(e.target.value))}
                  className="bg-slate-50 border-slate-200 font-bold text-center"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <Button onClick={handleOpenTable} disabled={busy} className="flex-1 bg-green-600 hover:bg-green-700 text-white h-10 font-bold">
                  تأكيد الفتح
                </Button>
                <Button onClick={() => setOpenModal(false)} variant="outline" className="flex-1 h-10 border-slate-200">
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ ADD ORDER MODAL ═══════════ */}
      {addOrderModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col text-right">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-base flex items-center gap-2"><Plus className="h-5 w-5" /> إضافة طلب للطاولة {selectedTable.number}</h2>
              <button onClick={() => setAddOrderModal(false)} className="hover:bg-white/20 p-1 rounded transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 block">الصنف:</label>
                <Select
                  value={selectedCatalogId}
                  onChange={(e) => setSelectedCatalogId(e.target.value)}
                  className="bg-slate-50 border-slate-200"
                >
                  {CATALOG_ITEMS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({formatCurrency(item.price)})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 block">الكمية:</label>
                <Input
                  type="number"
                  min={1}
                  value={orderQty}
                  onChange={(e) => setOrderQty(Number(e.target.value))}
                  className="bg-slate-50 border-slate-200 font-bold text-center"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <Button onClick={handleAddOrder} disabled={busy} className="flex-1 bg-slate-900 hover:bg-black text-white h-10 font-bold">
                  إضافة
                </Button>
                <Button onClick={() => setAddOrderModal(false)} variant="outline" className="flex-1 h-10 border-slate-200">
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ MERGE TABLES MODAL ═══════════ */}
      {mergeModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col text-right">
            <div className="bg-[#1e40af] text-white px-5 py-4 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-base flex items-center gap-2"><ArrowLeftRight className="h-5 w-5" /> دمج الطاولة {selectedTable.number} مع...</h2>
              <button onClick={() => setMergeModal(false)} className="hover:bg-white/20 p-1 rounded transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 block">اختر طاولة لدمج الفاتورة معها:</label>
                <Select
                  value={targetTableId}
                  onChange={(e) => setTargetTableId(e.target.value)}
                  className="bg-slate-50 border-slate-200"
                >
                  <option value="">-- اختر طاولة --</option>
                  {tables
                    .filter((t) => t.id !== selectedTable.id && t.status === "occupied")
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        طاولة {t.number} ({t.waiterName ? `الجرسون ${t.waiterName}` : "بدون جرسون"} · {formatCurrency(t.currentTotal)})
                      </option>
                    ))}
                </Select>
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs leading-relaxed text-amber-800 flex items-start gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>انتبه: دمج الطاولات سيؤدي لجمع الفواتير في الطاولة المستهدفة وتحويل هذه الطاولة إلى فارغة تلقائياً.</span>
              </div>

              <div className="pt-2 flex gap-2">
                <Button onClick={handleMerge} disabled={busy} className="flex-1 bg-[#1e40af] hover:bg-[#1e3a8a] text-white h-10 font-bold">
                  دمج الطاولات
                </Button>
                <Button onClick={() => setMergeModal(false)} variant="outline" className="flex-1 h-10 border-slate-200">
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
      {label}
    </span>
  );
}
