"use client";

import { useEffect, useState } from "react";
import { 
  Tablet, KeyRound, CheckSquare, Square, Copy, ShieldCheck, 
  Trash2, Plus, MessageSquare, AlertCircle, RefreshCw, Send, Users, 
  Eye, CheckCheck, Landmark, Calendar, Radio, Check 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type DeviceKey = {
  id: string;
  device_name: string;
  role: string;
  branch_id?: string | null;
  branch_name?: string;
  allowed_modules: string[];
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
};

type AuditMessage = {
  id: string;
  sender_name: string;
  sender_role: string;
  recipient_role: string | null;
  content: string;
  created_at: string;
};

type DevicesClientProps = {
  orgId: string;
  branches: Array<{ id: string; name: string }>;
  currentRole: string;
  currentName: string;
};

const moduleLabels: Record<string, { title: string; desc: string; icon: string }> = {
  inventory: { title: "المخزون والجرد", desc: "مراقبة مستويات المواد وكميات المخازن", icon: "📉" },
  recipes: { title: "الوصفات والتكاليف", desc: "مكونات وجبات الطعام وتكاليف المكونات", icon: "🍳" },
  purchasing: { title: "طلبات الشراء والموردين", desc: "إصدار فواتير شراء ومتابعة الشحنات الموردة", icon: "📦" },
  waste: { title: "الهدر والتالف", desc: "تسجيل كميات الهدر والمحاريق فورياً", icon: "🗑️" },
  pos: { title: "شاشة الكاشير والبيع السريع", desc: "واجهة البيع السريع ونقاط البيع للأقسام", icon: "💻" },
  reports: { title: "التقارير المالية", desc: "رؤية المؤشرات وتذبذبات أسعار المواد", icon: "📊" },
};

const roleColors: Record<string, { text: string; bg: string; border: string; label: string }> = {
  chef: { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-100", label: "مطبخ / شيف (KDS)" },
  cashier: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100", label: "شاشة كاشير (POS)" },
  inventory_manager: { text: "text-purple-700", bg: "bg-purple-50", border: "border-purple-100", label: "أمين مخزن ومستودع" },
  staff: { text: "text-slate-700", bg: "bg-slate-50", border: "border-slate-100", label: "موظف عام" },
};

const roleDefaultModules: Record<string, string[]> = {
  chef: ["recipes", "inventory", "waste"],
  cashier: ["pos"],
  inventory_manager: ["inventory", "purchasing", "waste", "reports"],
  staff: ["inventory"],
};

export function DevicesClient({ orgId, branches, currentRole, currentName }: DevicesClientProps) {
  const [activeTab, setActiveTab] = useState<"list" | "create" | "chat">("list");
  const [devices, setDevices] = useState<DeviceKey[]>([]);
  const [auditChats, setAuditChats] = useState<AuditMessage[]>([]);
  
  // Form State
  const [deviceName, setDeviceName] = useState("");
  const [selectedRole, setSelectedRole] = useState("chef");
  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id || "");
  const [selectedModules, setSelectedModules] = useState<string[]>(["recipes"]);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [devicesError, setDevicesError] = useState("");
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    loadDevices();
    loadAuditChats();
  }, [orgId]);

  useEffect(() => {
    setSelectedModules(roleDefaultModules[selectedRole] ?? ["inventory"]);
  }, [selectedRole]);

  const loadDevices = async () => {
    setRefreshing(true);
    setDevicesError("");
    try {
      const res = await fetch(`/api/department-keys/list?orgId=${encodeURIComponent(orgId)}`);
      const result = await res.json();
      if (result.success && result.keys) {
        setDevices(result.keys.map((d: any) => ({
          id: d.id,
          device_name: d.device_name,
          role: d.role,
          branch_id: d.branch_id,
          branch_name: d.branch_name || "فرع غير محدد",
          allowed_modules: d.allowed_modules,
          is_active: d.is_active,
          created_at: d.created_at,
          last_used_at: d.last_used_at,
        })));
      } else {
        setDevicesError(result.error || "تعذر تحميل أجهزة الأقسام.");
      }
    } catch (err) {
      console.error("Error loading devices:", err);
      setDevicesError("تعذر تحميل أجهزة الأقسام بسبب مشكلة في الاتصال.");
    }
    setRefreshing(false);
  };

  const loadAuditChats = async () => {
    setChatError("");
    try {
      const res = await fetch(`/api/internal-messages/list?orgId=${encodeURIComponent(orgId)}&limit=15`);
      const result = await res.json();
      if (result.success && result.messages) {
        setAuditChats(result.messages);
      } else {
        setChatError(result.error || "تعذر تحميل سجل المراسلات.");
      }
    } catch (err) {
      console.error("Error loading messages:", err);
      setChatError("تعذر تحميل سجل المراسلات بسبب مشكلة في الاتصال.");
    }
  };

  const handleToggleModule = (moduleKey: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleKey)
        ? prev.filter((m) => m !== moduleKey)
        : [...prev, moduleKey]
    );
  };

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) {
      alert("يرجى إدخال اسم الجهاز اللوحي أولاً.");
      return;
    }
    if (selectedModules.length === 0) {
      alert("اختر صلاحية واحدة على الأقل للجهاز.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/department-keys/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceName: deviceName.trim(),
          branchId: selectedBranch || null,
          role: selectedRole,
          allowedModules: selectedModules,
        }),
      });
      const result = await res.json();

      if (result.success) {
        setGeneratedKey(result.key);
        const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
        setGeneratedLink(`${origin}/d/gate?key=${result.key}`);
        setDeviceName("");
        await loadDevices();
      } else {
        console.error("Error creating device key:", result.error);
        alert(`خطأ في إنشاء الجهاز اللوحي: ${result.error || "عطل في قاعدة البيانات"}`);
      }
    } catch (err) {
      console.error("Error creating device key:", err);
      alert("خطأ في إنشاء الجهاز اللوحي بسبب مشكلة في الاتصال.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeDevice = async (id: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في إلغاء تنشيط وصول هذا الجهاز اللوحي فوراً؟")) return;

    try {
      const res = await fetch("/api/department-keys/revoke", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId: id }),
      });
      const result = await res.json();
      if (result.success) {
        loadDevices();
      } else {
        alert(result.error || "فشل إلغاء تنشيط الجهاز.");
      }
    } catch (err) {
      alert("فشل إلغاء تنشيط الجهاز بسبب مشكلة في الاتصال.");
    }
  };

  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Sleek Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-5 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-500 text-white shadow-md">
              <Tablet className="h-6 w-6" />
            </span>
            تخصيص الأجهزة اللوحية وأكواد الأقسام
          </h1>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            توليد روابط وصول فوري وآمنة لكل قسم (مطبخ، كاشير، مستودع) ومطابقتها بصلاحيات مخصصة للتحكم بالواجهات دون الحاجة لكلمة مرور.
          </p>
        </div>

        {/* Tab Buttons in HSL color space with micro-interactions */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 self-start shrink-0">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "list" 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Radio className={`h-4 w-4 ${activeTab === "list" ? "text-teal-500 animate-pulse" : ""}`} />
            الأجهزة النشطة ({devices.filter(d => d.is_active).length})
          </button>
          
          <button
            onClick={() => setActiveTab("create")}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "create" 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Plus className="h-4 w-4 text-teal-600" />
            ربط جهاز جديد
          </button>

          <button
            onClick={() => setActiveTab("chat")}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "chat" 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <MessageSquare className="h-4 w-4 text-blue-600" />
            سجل الرقابة ({auditChats.length})
          </button>
        </div>
      </div>

      {/* Tabs Contents */}
      
      {/* 1. List of Active Terminals */}
      {activeTab === "list" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Landmark className="h-4 w-4 text-slate-400" />
              قائمة شاشات الأقسام الحالية
            </h2>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadDevices} 
              disabled={refreshing}
              className="h-8 border-slate-200 text-xs gap-1.5 hover:bg-slate-50 text-slate-600 font-bold"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
              تحديث القائمة
            </Button>
          </div>

          {devicesError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{devicesError}</span>
            </div>
          )}

          {devices.length === 0 ? (
            <Card className="border-dashed border-slate-200 bg-slate-50/50 py-12">
              <CardContent className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-450 border border-slate-200/60 shadow-sm">
                  <Tablet className="h-6 w-6 stroke-[1.5]" />
                </div>
                <p className="text-sm font-black text-slate-800">لا توجد أجهزة لوحية مسجلة</p>
                <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                  لم تقم بربط أي شاشات بالقسم بعد. اضغط على علامة التبويب &quot;ربط جهاز جديد&quot; بالأعلى لتهيئة أول جهاز.
                </p>
                <Button 
                  onClick={() => setActiveTab("create")} 
                  className="mt-2 bg-teal-600 hover:bg-teal-700 text-white font-bold h-9 text-xs"
                >
                  <Plus className="h-4 w-4 me-1.5" />
                  إنشاء جهاز لوحي الآن
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {devices.map((device) => {
                const colorConfig = roleColors[device.role] || roleColors.staff;
                return (
                  <Card 
                    key={device.id} 
                    className={`border border-slate-150 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all duration-200 ${
                      !device.is_active ? "opacity-60 bg-slate-50/40" : "bg-white"
                    }`}
                  >
                    {/* Status vertical line bar indicator */}
                    <div className={`absolute top-0 bottom-0 start-0 w-1.5 ${
                      device.is_active ? "bg-emerald-500 animate-pulse" : "bg-slate-350"
                    }`} />
                    
                    <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between gap-2 border-b border-slate-50">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-800">{device.device_name}</span>
                          <span className="relative flex h-2 w-2">
                            {device.is_active ? (
                              <>
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </>
                            ) : (
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
                            )}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Landmark className="h-3 w-3 text-slate-400" />
                          {device.branch_name || "كل الفروع"}
                        </span>
                      </div>
                      
                      {device.is_active ? (
                        <Button
                          variant="ghost"
                          onClick={() => handleRevokeDevice(device.id)}
                          className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 rounded-lg hover:text-rose-600 transition shrink-0"
                          title="إلغاء تنشيط الجهاز"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Badge tone="muted" className="text-[9px] font-bold">ملغى</Badge>
                      )}
                    </CardHeader>

                    <CardContent className="p-4 space-y-3.5">
                      {/* Role Badge */}
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">نوع الوصول الافتراضي:</span>
                        <Badge className={`${colorConfig.text} ${colorConfig.bg} ${colorConfig.border} border text-[9px] font-black px-2 py-0.5`}>
                          {colorConfig.label}
                        </Badge>
                      </div>

                      {/* Open Dashboard Modules */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 block mb-1">الوحدات والصلاحيات المسموحة:</span>
                        <div className="flex flex-wrap gap-1">
                          {device.allowed_modules.length === 0 ? (
                            <span className="text-[10px] text-slate-500">لا توجد صلاحيات مسموحة</span>
                          ) : (
                            device.allowed_modules.map((m) => (
                              <span 
                                key={m} 
                                className="text-[9.5px] font-bold bg-teal-50/50 text-teal-700 border border-teal-100 rounded-md px-1.5 py-0.5"
                              >
                                {moduleLabels[m]?.title || m}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Dates and connections info footer */}
                      <div className="pt-2.5 border-t border-slate-50 flex justify-between text-[9.5px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          الإنشاء: {new Date(device.created_at).toLocaleDateString("ar-SA")}
                        </span>
                        
                        <span className="flex items-center gap-1 font-bold">
                          <Radio className={`h-3 w-3 ${device.is_active ? "text-emerald-500 animate-pulse" : "text-slate-450"}`} />
                          {device.last_used_at 
                            ? `متصل: ${new Date(device.last_used_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}` 
                            : "غير متصل"}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. Key Generation & Custom permissions form */}
      {activeTab === "create" && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
            
            {/* Form card */}
            <Card className="border-slate-150 shadow-sm">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4">
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <KeyRound className="h-4.5 w-4.5 text-teal-600" />
                  صياغة وصلاحيات الجهاز اللوحي الجديد
                </CardTitle>
                <CardDescription className="text-[11px] text-right">
                  املأ الحقول التالية لتوليد كود مشفر للقسم وحساب صلاحيات الوصول الفريدة.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={handleCreateDevice} className="space-y-5">
                  <div className="grid gap-2">
                    <Label htmlFor="deviceName" className="text-xs font-black text-slate-800">اسم الجهاز / التابلت مخصص:</Label>
                    <Input 
                      id="deviceName" 
                      placeholder="مثال: تابلت المطبخ رقم 1، أو كاشير الكافي شوب الرئيسي" 
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      required
                      className="h-10 text-xs border-slate-200 focus:border-teal-500/50 focus:ring-teal-500/50 text-right"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="branch" className="text-xs font-black text-slate-800">الفرع التابع له:</Label>
                      <select 
                        id="branch" 
                        value={selectedBranch} 
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50"
                      >
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="role" className="text-xs font-black text-slate-800">الدور والواجهة الافتراضية للجهاز:</Label>
                      <select 
                        id="role" 
                        value={selectedRole} 
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50"
                      >
                        <option value="chef">المطبخ / الشيف (KDS)</option>
                        <option value="cashier">كاشير بيع سريع (POS)</option>
                        <option value="inventory_manager">المخازن والمستودع</option>
                      </select>
                    </div>
                  </div>

                  {/* Granular Module permissions dynamic checkboxes - custom visual cards */}
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-slate-800 block">تحديد أقسام الداشبورد والصلاحيات المفتوحة للتابلت:</Label>
                    <span className="text-[10px] text-slate-400 block pb-1">اختر الوحدات البرمجية التي سيتم فتحها لهذا الجهاز عند فتح الرابط المخصص:</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {Object.entries(moduleLabels).map(([key, value]) => {
                        const isChecked = selectedModules.includes(key);
                        return (
                          <div 
                            key={key} 
                            onClick={() => handleToggleModule(key)}
                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all duration-150 ${
                              isChecked 
                                ? "bg-teal-50/20 border-teal-500 text-slate-900 ring-1 ring-teal-500/20 shadow-sm" 
                                : "border-slate-200 hover:bg-slate-50 text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            <span className="text-xl shrink-0 mt-0.5">{value.icon}</span>
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <span className="text-xs font-bold block">{value.title}</span>
                              <span className="text-[10px] text-muted-foreground block truncate">{value.desc}</span>
                            </div>
                            <div className="shrink-0 mt-0.5">
                              {isChecked ? (
                                <div className="h-4.5 w-4.5 rounded bg-teal-500 flex items-center justify-center text-white">
                                  <Check className="h-3 w-3 stroke-[3]" />
                                </div>
                              ) : (
                                <div className="h-4.5 w-4.5 rounded border border-slate-350 bg-white" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full h-11 text-xs font-black bg-teal-600 hover:bg-teal-700 text-white shadow-md transition-all active:scale-[0.98] mt-2"
                  >
                    {loading ? "يتم الآن التوليد الآمن..." : "توليد كود الـ API ورابط الفحص المخصص"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Key Generation Prompt Area */}
            <div className="space-y-6">
              {generatedKey ? (
                <Card className="border-teal-200 bg-teal-50/10 shadow-lg relative overflow-hidden animate-in zoom-in duration-300">
                  <div className="absolute top-0 start-0 w-full h-1.5 bg-teal-500" />
                  <CardHeader className="py-4 border-b border-teal-100/50 bg-teal-50/20">
                    <CardTitle className="text-xs font-black text-teal-850 flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-teal-600 shrink-0" />
                      تم التوليد بنجاح! انسخه الآن
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-500 block font-bold">رمز القسم المشفر (10 رموز):</span>
                      <div className="bg-white border border-teal-200 rounded-xl p-3.5 text-center font-mono tracking-widest text-lg font-black text-teal-800 shadow-inner select-all relative group cursor-pointer" onClick={handleCopyLink}>
                        {generatedKey}
                        <Badge tone="success" className="absolute top-1/2 end-2.5 -translate-y-1/2 text-[9px] font-bold">نشط</Badge>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] text-slate-500 block font-bold">رابط الوصول الفوري للجهاز:</span>
                      <div className="flex gap-2">
                        <Input 
                          readOnly 
                          value={generatedLink || ""} 
                          className="bg-white border-slate-200 text-[10.5px] font-mono select-all flex-1 h-10 truncate text-slate-700 text-left" 
                        />
                        <Button 
                          onClick={handleCopyLink} 
                          className="h-10 bg-teal-600 hover:bg-teal-700 text-white shrink-0 font-bold text-xs gap-1.5"
                        >
                          {copied ? (
                            <>
                              <CheckCheck className="h-4 w-4" />
                              تم!
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              نسخ
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="text-[10px] leading-relaxed text-teal-700 bg-teal-50/50 p-3 rounded-xl border border-teal-100/60 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>تنبيه أمني هام جداً:</strong> يتم حفظ كود الـ API مشفراً بالكامل في قاعدة البيانات، ولن يتمكن التطبيق من إظهاره لك مجدداً! يرجى نسخه فوراً وإرساله للجهاز المعني لبدء العمل.
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-slate-150 bg-slate-50/40 py-10 shadow-sm border-dashed">
                  <CardContent className="flex flex-col items-center justify-center text-center p-6 space-y-3 text-slate-400">
                    <KeyRound className="h-10 w-10 text-slate-350 stroke-[1.5]" />
                    <p className="text-xs font-black text-slate-700">بانتظار عملية التوليد</p>
                    <p className="text-[10.5px] text-slate-500 max-w-[220px] leading-relaxed mx-auto">
                      املأ نموذج تخصيص وصلاحيات الشاشة على اليمين، ثم اضغط على زر التوليد لتظهر الأكواد الفورية وروابط التحقق هنا.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Live Chat Monitoring Logs */}
      {activeTab === "chat" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Card className="border-slate-150 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4 flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-teal-600" />
                  لوحة الرقابة والإشراف الفوري للمراسلات
                </CardTitle>
                <CardDescription className="text-[10.5px] text-right mt-1">
                  مراقبة فورية للرسائل المتبادلة بين المطبخ، الكاشير والمستودعات للتحقق من سلامة التشغيل.
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={loadAuditChats} 
                className="text-slate-400 hover:text-slate-700 h-8 w-8 border-slate-200"
                title="تحديث المحادثة"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="rounded-xl bg-teal-50 border border-teal-100/60 p-3 text-[10.5px] text-teal-800 flex items-start gap-2.5">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-teal-600" />
                <span>
                  <strong>نمط الرقابة الإدارية:</strong> بصفتك مديراً، تمنحك هذه اللوحة شفافية مطلقة لرؤية المحادثات المغلقة للأقسام والمجموعات العامة. Supabase Realtime يقوم ببث الرسائل الجديدة فور إرسالها من الأجهزة.
                </span>
              </div>

              <div className="space-y-3.5 max-h-[450px] overflow-y-auto p-1">
                {chatError && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{chatError}</span>
                  </div>
                )}
                {auditChats.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 space-y-2">
                    <MessageSquare className="h-8 w-8 mx-auto stroke-[1.5]" />
                    <p className="text-xs">لا توجد رسائل مسجلة في الفرع حالياً.</p>
                  </div>
                ) : (
                  auditChats.map((msg) => {
                    const colorConfig = roleColors[msg.sender_role] || roleColors.staff;
                    return (
                      <div 
                        key={msg.id} 
                        className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-2 hover:border-slate-200 hover:bg-slate-100/40 transition-all duration-150"
                      >
                        <div className="flex justify-between items-center text-[10px]">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-800">{msg.sender_name}</span>
                            <Badge className={`${colorConfig.text} ${colorConfig.bg} ${colorConfig.border} border text-[8.5px] font-black px-1.5 py-0`}>
                              {colorConfig.label}
                            </Badge>
                          </div>
                          
                          <span className="text-slate-400">
                            {new Date(msg.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        
                        <p className="text-xs text-slate-650 leading-relaxed font-medium">{msg.content}</p>
                        
                        <div className="flex justify-end pt-1">
                          <span className="text-[9px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                            {msg.recipient_role 
                              ? `موجهة إلى: ${roleColors[msg.recipient_role]?.label || msg.recipient_role}` 
                              : "جروب المطعم العام"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
