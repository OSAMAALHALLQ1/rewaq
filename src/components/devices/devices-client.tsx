"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check, CheckCircle2, ClipboardCopy, KeyRound, MonitorSmartphone, Plus,
  RefreshCw, ShieldCheck, Tablet, Trash2, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DeviceKey = {
  id: string;
  device_name: string;
  role: string;
  branch_id?: string | null;
  branch_name?: string | null;
  allowed_modules: string[];
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
};

type DevicesClientProps = {
  orgId: string;
  branches: Array<{ id: string; name: string }>;
  initialStations: Array<{ id: string; branchId: string; name: string; isActive: boolean }>;
  currentRole: string;
  currentName: string;
  initialTab?: "list" | "create" | "permissions";
};

const moduleMeta: Record<string, { label: string; description: string }> = {
  pos: { label: "شاشة الكاشير POS", description: "البيع، الدفع والوردية" },
  waiter: { label: "شاشة النادل", description: "الطاولات وإرسال الطلبات" },
  kitchen: { label: "شاشة المطبخ KDS", description: "استلام الطلبات والتحضير" },
  expo: { label: "شاشة Expo", description: "التجميع وإثبات التسليم" },
  inventory: { label: "المخزون", description: "الأرصدة والجرد والحركات" },
  purchasing: { label: "المشتريات", description: "طلبات الشراء والموردون" },
  waste: { label: "التالف والهدر", description: "تسجيل الهدر ضمن الفرع" },
  reports: { label: "تقارير المخزون", description: "مؤشرات المستودع" },
  accounting: { label: "واجهة المحاسب", description: "كل الشاشات والعمليات والتقارير المحاسبية المسموحة للمحاسب" },
};

const deviceProfiles = [
  { value: "cashier", label: "جهاز كاشير", apiRole: "cashier", modules: ["pos"] },
  { value: "waiter", label: "جهاز نادل", apiRole: "staff", modules: ["waiter"] },
  { value: "kitchen", label: "شاشة مطبخ KDS", apiRole: "chef", modules: ["kitchen"] },
  { value: "expo", label: "شاشة Expo", apiRole: "staff", modules: ["expo"] },
  { value: "inventory", label: "جهاز أمين مستودع", apiRole: "inventory_manager", modules: ["inventory", "purchasing", "waste", "reports"] },
  { value: "accountant", label: "جهاز المحاسب", apiRole: "accountant", modules: ["accounting"] },
] as const;

type DeviceProfile = (typeof deviceProfiles)[number]["value"];
type ActiveTab = "list" | "create" | "permissions";
type RoutingItem = { id: string; branch_id: string | null; code: string; name: string; category_name: string | null };
type ItemRoute = { id: string; branch_id: string; catalog_item_id: string; station_id: string; is_active: boolean };

function moduleDestination(modules: readonly string[]) {
  if (modules.includes("pos")) return "/d/pos";
  if (modules.includes("waiter")) return "/d/waiter";
  if (modules.includes("kitchen")) return "/d/kitchen";
  if (modules.includes("expo")) return "/d/expo";
  if (modules.includes("accounting")) return "/d/accounting";
  return "/d/inventory";
}

function formatDate(value: string | null) {
  if (!value) return "لم يُستخدم بعد";
  return new Intl.DateTimeFormat("ar-PS", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function DevicesClient({ orgId, branches, initialStations, initialTab = "list" }: DevicesClientProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
  const [devices, setDevices] = useState<DeviceKey[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<DeviceProfile>("kitchen");
  const [deviceName, setDeviceName] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [stations, setStations] = useState(initialStations);
  const [stationId, setStationId] = useState("");
  const [stationName, setStationName] = useState("");
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [savingStation, setSavingStation] = useState(false);
  const [routingItems, setRoutingItems] = useState<RoutingItem[]>([]);
  const [itemRoutes, setItemRoutes] = useState<ItemRoute[]>([]);
  const [routingItemId, setRoutingItemId] = useState("");
  const [routingStationId, setRoutingStationId] = useState("");
  const [savingRoute, setSavingRoute] = useState(false);
  const [creating, setCreating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState<"key" | "link" | null>(null);

  const selectedProfile = useMemo(
    () => deviceProfiles.find((candidate) => candidate.value === profile) ?? deviceProfiles[0],
    [profile],
  );
  const needsOperatingScope = profile !== "accountant";
  const branchStations = useMemo(
    () => stations.filter((station) => station.branchId === branchId && station.isActive),
    [branchId, stations],
  );

  useEffect(() => {
    if (profile === "kitchen" && !branchStations.some((station) => station.id === stationId)) {
      setStationId(branchStations[0]?.id ?? "");
    }
  }, [branchStations, profile, stationId]);

  const loadDevices = useCallback(async () => {
    setLoadingDevices(true);
    setError(null);
    try {
      const response = await fetch("/api/department-keys/list?includeInactive=true", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "تعذر تحميل الأجهزة.");
      setDevices(payload.keys ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل الأجهزة.");
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  const loadWorkflowSetup = useCallback(async () => {
    const response = await fetch("/api/restaurant-workflow/setup", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.error || "تعذر تحميل إعدادات دورة المطعم.");
    setStations((payload.stations ?? []).map((station: any) => ({ id: station.id, branchId: station.branch_id, name: station.name, isActive: station.is_active })));
    setRoutingItems(payload.items ?? []);
    setItemRoutes(payload.routes ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDevices(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDevices, orgId]);

  useEffect(() => {
    if (activeTab !== "permissions") return;
    void loadWorkflowSetup().catch((setupError) => setError(setupError instanceof Error ? setupError.message : "تعذر تحميل إعدادات دورة المطعم."));
  }, [activeTab, loadWorkflowSetup]);

  const copyValue = async (kind: "key" | "link", value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1800);
  };

  const createDevice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!deviceName.trim() || (needsOperatingScope && !branchId) || (profile === "kitchen" && !stationId)) {
      setError(profile === "kitchen" ? "أدخل اسم الجهاز واختر نطاق التشغيل وقسم التحضير." : "أدخل اسم الجهاز واختر نطاق التشغيل.");
      return;
    }

    setCreating(true);
    setError(null);
    setGeneratedKey(null);
    setGeneratedLink(null);
    try {
      const response = await fetch("/api/department-keys/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceName: deviceName.trim(),
          branchId: needsOperatingScope ? branchId : null,
          stationId: profile === "kitchen" ? stationId : null,
          role: selectedProfile.apiRole,
          allowedModules: selectedProfile.modules,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "تعذر إنشاء الجهاز.");

      const key = String(payload.key);
      const destination = moduleDestination(selectedProfile.modules);
      const origin = window.location.origin;
      // The raw device credential stays in the URL fragment. Fragments are not
      // sent in HTTP requests, server logs, analytics URLs, or referrer headers.
      const directLink = `${origin}/d/gate?next=${encodeURIComponent(destination)}#key=${encodeURIComponent(key)}`;
      setGeneratedKey(key);
      setGeneratedLink(directLink);
      setDeviceName("");
      await loadDevices();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "تعذر إنشاء الجهاز.");
    } finally {
      setCreating(false);
    }
  };

  const saveStation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!branchId || stationName.trim().length < 2) {
      setError("اختر نطاق التشغيل وأدخل اسم قسم التحضير.");
      return;
    }
    setSavingStation(true);
    setError(null);
    try {
      const response = await fetch("/api/restaurant-workflow/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "station", branchId, stationId: editingStationId, name: stationName.trim(), isActive: true }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "تعذر حفظ قسم التحضير.");
      await loadWorkflowSetup();
      setStationName("");
      setEditingStationId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "تعذر حفظ قسم التحضير.");
    } finally {
      setSavingStation(false);
    }
  };

  const saveItemRoute = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!branchId || !routingItemId || !routingStationId) {
      setError("اختر نطاق التشغيل والوجبة وقسم التحضير.");
      return;
    }
    setSavingRoute(true);
    setError(null);
    try {
      const response = await fetch("/api/restaurant-workflow/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "route", branchId, catalogItemId: routingItemId, stationId: routingStationId, isActive: true }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "تعذر ربط الوجبة بقسم التحضير.");
      await loadWorkflowSetup();
      setRoutingItemId("");
      setRoutingStationId("");
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : "تعذر ربط الوجبة بقسم التحضير.");
    } finally {
      setSavingRoute(false);
    }
  };

  const revokeDevice = async (device: DeviceKey) => {
    if (!window.confirm(`هل تريد تعطيل الجهاز «${device.device_name}»؟ لن يُحذف سجله.`)) return;
    setError(null);
    const response = await fetch("/api/department-keys/revoke", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId: device.id }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      setError(payload.error || "تعذر تعطيل الجهاز.");
      return;
    }
    await loadDevices();
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-black text-slate-950">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#1363DF] text-white"><Tablet className="h-6 w-6" /></span>
            الأجهزة وأكواد التشغيل
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">اختر وظيفة الجهاز ونطاق تشغيله. كود الجهاز مستقل عن كود الموظف الشخصي، وكل موظف يبقى محصورًا بصلاحيات دوره.</p>
        </div>
        <Link href="/dashboard/settings/users"><Button variant="outline" className="gap-2"><Users className="h-4 w-4" /> إدارة الموظفين وأكوادهم</Button></Link>
      </div>

      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border bg-slate-100 p-1">
        {([
          ["list", "الأجهزة", Tablet], ["create", "ربط جهاز", Plus], ["permissions", "توزيع الواجهات", ShieldCheck],
        ] as const).map(([value, label, Icon]) => (
          <button key={value} type="button" onClick={() => setActiveTab(value)} className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-xs font-black ${activeTab === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>
            <Icon className="h-4 w-4 text-[#1363DF]" /> {label}
          </button>
        ))}
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div> : null}

      {activeTab === "list" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="font-black">الأجهزة المسجلة ({devices.length})</h2><Button variant="outline" size="sm" onClick={() => void loadDevices()} className="gap-2"><RefreshCw className={`h-4 w-4 ${loadingDevices ? "animate-spin" : ""}`} /> تحديث</Button></div>
          {loadingDevices ? <Card><CardContent className="grid min-h-40 place-items-center"><RefreshCw className="h-6 w-6 animate-spin text-[#1363DF]" /></CardContent></Card> : devices.length === 0 ? (
            <Card className="border-dashed"><CardContent className="grid min-h-48 place-items-center p-6 text-center text-sm text-slate-500">لا توجد أجهزة. أنشئ أول كود من تبويب «ربط جهاز».</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {devices.map((device) => (
                <Card key={device.id} className={!device.is_active ? "opacity-65" : ""}>
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-[#1363DF]"><MonitorSmartphone className="h-5 w-5" /></span><div className="min-w-0"><h3 className="truncate font-black">{device.device_name}</h3><p className="text-xs text-slate-500">{device.branch_name || "وصول مركزي"}</p></div></div><Badge tone={device.is_active ? "success" : "default"}>{device.is_active ? "نشط" : "معطل"}</Badge></div>
                    <div className="flex flex-wrap gap-1.5">{device.allowed_modules.map((module) => <span key={module} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">{moduleMeta[module]?.label ?? module}</span>)}</div>
                    <div className="text-xs text-slate-500"><span>آخر استخدام: </span><strong className="text-slate-700">{formatDate(device.last_used_at)}</strong></div>
                    {device.is_active ? <Button variant="outline" size="sm" onClick={() => void revokeDevice(device)} className="w-full gap-2 text-red-700"><Trash2 className="h-4 w-4" /> تعطيل الجهاز</Button> : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "create" ? (
        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <Card className="h-fit"><CardHeader><CardTitle className="text-lg">ربط جهاز جديد</CardTitle></CardHeader><CardContent>
            <form onSubmit={createDevice} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="deviceName">اسم الجهاز</Label><Input id="deviceName" value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder="مثال: كاشير الصالة الرئيسي" required /></div>
              <div className="space-y-2"><Label htmlFor="profile">واجهة الجهاز</Label><select id="profile" value={profile} onChange={(event) => setProfile(event.target.value as DeviceProfile)} className="h-11 w-full rounded-xl border bg-white px-3 text-sm">{deviceProfiles.map((candidate) => <option key={candidate.value} value={candidate.value}>{candidate.label}</option>)}</select></div>
              {needsOperatingScope ? <div className="space-y-2"><Label htmlFor="branch">نطاق التشغيل</Label><select id="branch" value={branchId} onChange={(event) => setBranchId(event.target.value)} className="h-11 w-full rounded-xl border bg-white px-3 text-sm" required><option value="">اختر نطاق التشغيل</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div> : <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">جهاز المحاسب مركزي ولا يحتاج اختيار نطاق تشغيل. صلاحيات الموظف المحاسب هي التي تحمي الشاشات والعمليات المالية.</div>}
              {profile === "kitchen" ? <div className="space-y-2"><Label htmlFor="station">قسم التحضير الظاهر على KDS</Label><select id="station" value={stationId} onChange={(event) => setStationId(event.target.value)} className="h-11 w-full rounded-xl border bg-white px-3 text-sm" required><option value="">اختر قسم التحضير</option>{branchStations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select>{branchStations.length === 0 ? <p className="text-xs font-bold text-amber-700">أضف قسم تحضير من تبويب «توزيع الواجهات» أولاً.</p> : null}</div> : null}
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">سيفتح هذا الجهاز: <strong>{selectedProfile.modules.map((module) => moduleMeta[module]?.label ?? module).join("، ")}</strong></div>
              <Button type="submit" disabled={creating} className="w-full gap-2">{creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} إنشاء كود الجهاز والرابط</Button>
            </form>
          </CardContent></Card>

          {generatedKey && generatedLink ? (
            <Card className="border-2 border-emerald-300 bg-emerald-50/60"><CardHeader><CardTitle className="flex items-center gap-2 text-emerald-900"><CheckCircle2 className="h-5 w-5" /> تم إنشاء الجهاز — احفظ البيانات الآن</CardTitle></CardHeader><CardContent className="space-y-5">
              <div><Label>كود الجهاز (يظهر كاملًا مرة واحدة)</Label><div className="mt-2 flex gap-2"><Input readOnly value={generatedKey} dir="ltr" className="font-mono text-lg font-black tracking-widest" /><Button type="button" onClick={() => void copyValue("key", generatedKey)} className="gap-2">{copied === "key" ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />} نسخ</Button></div></div>
              <div><Label>رابط التهيئة المباشر والآمن</Label><div className="mt-2 flex gap-2"><Input readOnly value={generatedLink} dir="ltr" className="text-xs" /><Button type="button" onClick={() => void copyValue("link", generatedLink)} className="gap-2">{copied === "link" ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />} نسخ الرابط</Button></div><p className="mt-2 text-xs text-slate-600">افتح الرابط مرة على الجهاز المطلوب؛ سيزيل المتصفح الكود من العنوان فورًا ثم يحفظ جلسة الجهاز في Cookie آمنة لمدة الوردية.</p></div>
            </CardContent></Card>
          ) : <Card className="border-dashed"><CardContent className="grid min-h-72 place-items-center p-8 text-center text-sm text-slate-500"><div><KeyRound className="mx-auto mb-3 h-9 w-9 text-slate-300" /><p>بعد الإنشاء سيظهر هنا الكود الكامل ورابط التهيئة المباشر.</p></div></CardContent></Card>}
        </div>
      ) : null}

      {activeTab === "permissions" ? (
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>أقسام التحضير: مطبخ، حلويات، مشروبات...</CardTitle></CardHeader><CardContent className="space-y-4">
            <form onSubmit={saveStation} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="h-11 rounded-xl border bg-white px-3 text-sm" required><option value="">اختر نطاق التشغيل</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
              <Input value={stationName} onChange={(event) => setStationName(event.target.value)} placeholder="مثال: الحلويات" required minLength={2} />
              <Button type="submit" disabled={savingStation} className="gap-2">{savingStation ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{editingStationId ? "حفظ الاسم" : "إضافة القسم"}</Button>
            </form>
            <div className="flex flex-wrap gap-2">{stations.filter((station) => station.isActive).map((station) => <Button key={station.id} type="button" variant="outline" size="sm" onClick={() => { setBranchId(station.branchId); setEditingStationId(station.id); setStationName(station.name); }}>{station.name} — {branches.find((branch) => branch.id === station.branchId)?.name ?? ""}</Button>)}</div>
          </CardContent></Card>
          <Card><CardHeader><CardTitle>توجيه الوجبات إلى الأقسام</CardTitle></CardHeader><CardContent className="space-y-4">
            <p className="text-sm text-slate-600">اربط كل وجبة مرة واحدة؛ بعدها يرسلها الجرسون تلقائياً إلى شاشة KDS الصحيحة ولا يستطيع تغيير القسم.</p>
            <form onSubmit={saveItemRoute} className="grid gap-3 xl:grid-cols-[1fr_1.4fr_1fr_auto]">
              <select value={branchId} onChange={(event) => { setBranchId(event.target.value); setRoutingStationId(""); }} className="h-11 rounded-xl border bg-white px-3 text-sm" required><option value="">اختر نطاق التشغيل</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
              <select value={routingItemId} onChange={(event) => setRoutingItemId(event.target.value)} className="h-11 rounded-xl border bg-white px-3 text-sm" required><option value="">اختر الوجبة</option>{routingItems.filter((item) => !item.branch_id || item.branch_id === branchId).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select>
              <select value={routingStationId} onChange={(event) => setRoutingStationId(event.target.value)} className="h-11 rounded-xl border bg-white px-3 text-sm" required><option value="">اختر قسم التحضير</option>{branchStations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select>
              <Button type="submit" disabled={savingRoute}>{savingRoute ? <RefreshCw className="h-4 w-4 animate-spin" /> : "حفظ الربط"}</Button>
            </form>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{itemRoutes.filter((route) => route.is_active).map((route) => { const item = routingItems.find((candidate) => candidate.id === route.catalog_item_id); const station = stations.find((candidate) => candidate.id === route.station_id); return <button key={route.id} type="button" onClick={() => { setBranchId(route.branch_id); setRoutingItemId(route.catalog_item_id); setRoutingStationId(route.station_id); }} className="rounded-xl border p-3 text-right text-sm"><strong>{item?.name ?? "وجبة"}</strong><span className="mt-1 block text-xs text-slate-500">{station?.name ?? "قسم غير معروف"}</span></button>; })}</div>
          </CardContent></Card>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {deviceProfiles.map((candidate) => (
            <Card key={candidate.value}><CardContent className="space-y-3 p-5"><h3 className="font-black">{candidate.label}</h3>{candidate.modules.map((module) => <div key={module} className="rounded-xl bg-slate-50 p-3"><div className="text-sm font-bold">{moduleMeta[module]?.label}</div><p className="mt-1 text-xs text-slate-500">{moduleMeta[module]?.description}</p></div>)}<p className="border-t pt-3 text-xs text-slate-500">هذه صلاحيات الجهاز. الموظف الذي يعمل عليه يدخل أيضًا بكوده الشخصي عندما تتطلب العملية إثبات هويته.</p></CardContent></Card>
          ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
