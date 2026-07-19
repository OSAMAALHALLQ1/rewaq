"use client";

import { useEffect, useState } from "react";
import { 
  Tablet, KeyRound, CheckSquare, Square, Copy, ShieldCheck, 
  Trash2, Plus, AlertCircle, RefreshCw, Send, Users, UserCheck,
  Eye, CheckCheck, Landmark, Calendar, Radio, Check, X 
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
  initialTab?: "list" | "create" | "permissions" | "staff";
};

// Tekka-style staff member: avatar initial + role color + generated login code.
type StaffMember = {
  id: string;
  full_name: string;
  phone: string;
  role: "waiter" | "cashier" | "kitchen" | "bar" | "shisha" | "manager";
  login_code: string;
  is_active: boolean;
  created_at: string;
  branch_name?: string;
};

const staffRoleMeta: Record<string, { label: string; text: string; bg: string; border: string }> = {
  waiter: { label: "جرسون", text: "text-sky-700", bg: "bg-sky-50", border: "border-sky-100" },
  cashier: { label: "محاسب", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100" },
  kitchen: { label: "مطبخ", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-100" },
  bar: { label: "بار", text: "text-violet-700", bg: "bg-violet-50", border: "border-violet-100" },
  shisha: { label: "شيشة", text: "text-rose-700", bg: "bg-rose-50", border: "border-rose-100" },
  manager: { label: "مدير", text: "text-slate-800", bg: "bg-slate-100", border: "border-slate-200" },
};

const moduleLabels: Record<string, { title: string; desc: string; icon: string }> = {
  inventory: { title: "المخزون والجرد", desc: "مراقبة مستويات المواد وكميات المخازن", icon: "📉" },
  recipes: { title: "الوصفات والتكاليف", desc: "مكونات وجبات الطعام وتكاليف المكونات", icon: "🍳" },
  purchasing: { title: "طلبات الشراء والموردين", desc: "إصدار فواتير شراء ومتابعة الشحنات الموردة", icon: "📦" },
  waste: { title: "الهدر والتالف", desc: "تسجيل كميات الهدر والمحاريق فورياً", icon: "🗑️" },
  pos: { title: "شاشة الكاشير والبيع السريع", desc: "واجهة البيع السريع ونقاط البيع للأقسام", icon: "💻" },
  reports: { title: "التقارير المالية", desc: "رؤية المؤشرات وتذبذبات أسعار المواد", icon: "📊" },
  waiter: { title: "شاشة النادل", desc: "فتح الطاولات وإرسال الطلب إلى المطبخ", icon: "🧑‍🍳" },
  kitchen: { title: "شاشة المطبخ KDS", desc: "استلام العناصر وتحضيرها وإعلان الجاهزية", icon: "🔥" },
  expo: { title: "شاشة Expo", desc: "مطابقة الطلب وتجميعه وإثبات التقديم", icon: "✅" },
};

const roleColors: Record<string, { text: string; bg: string; border: string; label: string }> = {
  chef: { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-100", label: "مطبخ / شيف (KDS)" },
  cashier: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-100", label: "شاشة كاشير (POS)" },
  inventory_manager: { text: "text-purple-700", bg: "bg-purple-50", border: "border-purple-100", label: "أمين مخزن ومستودع" },
  staff: { text: "text-slate-700", bg: "bg-slate-50", border: "border-slate-100", label: "موظف عام" },
  waiter: { text: "text-sky-700", bg: "bg-sky-50", border: "border-sky-100", label: "نادل / جرسون" },
  expo: { text: "text-teal-700", bg: "bg-teal-50", border: "border-teal-100", label: "Expo / تسليم" },
};

const roleDefaultModules: Record<string, string[]> = {
  waiter: ["waiter"],
  chef: ["kitchen"],
  cashier: ["pos"],
  inventory_manager: ["inventory", "purchasing", "waste", "reports"],
  staff: ["inventory"],
  expo: ["expo"],
};

export function DevicesClient({ orgId, branches, currentRole, currentName, initialTab = "list" }: DevicesClientProps) {
  const [activeTab, setActiveTab] = useState<"list" | "create" | "permissions" | "staff">(
    initialTab,
  );
  const [devices, setDevices] = useState<DeviceKey[]>([]);
  const [auditChats, setAuditChats] = useState<AuditMessage[]>([]);

  // Staff state (Tekka-style login codes)
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffFormOpen, setStaffFormOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({ fullName: "", phone: "", role: "waiter", branchId: branches[0]?.id || "" });
  const [createdStaffCode, setCreatedStaffCode] = useState<string | null>(null);
  const [staffCopied, setStaffCopied] = useState(false);

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
    loadStaff();
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

  const loadStaff = async () => {
    setStaffLoading(true);
    try {
      const res = await fetch(`/api/staff/list?orgId=${encodeURIComponent(orgId)}`);
      const result = await res.json();
      if (result.success && result.staff) {
        setStaff(result.staff);
      }
    } catch (err) {
      console.error("Error loading staff:", err);
    }
    setStaffLoading(false);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.fullName.trim()) {
      alert("يرجى إدخال الاسم الكامل.");
      return;
    }
    try {
      const res = await fetch("/api/staff/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: staffForm.fullName.trim(),
          phone: staffForm.phone.trim(),
          role: staffForm.role,
          branchId: staffForm.branchId || null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setCreatedStaffCode(result.loginCode);
        setStaffForm({ fullName: "", phone: "", role: "waiter", branchId: branches[0]?.id || "" });
        await loadStaff();
      } else {
        alert(result.error || "فشل إنشاء الموظف.");
      }
    } catch (err) {
      alert("فشل إنشاء الموظف بسبب مشكلة في الاتصال.");
    }
  };

  const handleToggleStaff = async (id: string) => {
    try {
      const res = await fetch("/api/staff/toggle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: id, action: "toggle" }),
      });
      const result = await res.json();
      if (result.success) loadStaff();
      else alert(result.error || "فشل تحديث حالة الموظف.");
    } catch (err) {
      alert("فشل تحديث الموظف بسبب مشكلة في الاتصال.");
    }
  };

  const handleDeleteStaff = async (id: string) => {
    if (!confirm("حذف هذا الموظف نهائياً؟")) return;
    try {
      const res = await fetch("/api/staff/toggle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: id, action: "delete" }),
      });
      const result = await res.json();
      if (result.success) loadStaff();
      else alert(result.error || "فشل حذف الموظف.");
    } catch (err) {
      alert("فشل حذف الموظف بسبب مشكلة في الاتصال.");
    }
  };

  const copyStaffCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setStaffCopied(true);
    setTimeout(() => setStaffCopied(false), 2000);
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
          role: selectedRole === "waiter" || selectedRole === "expo" ? "staff" : selectedRole,
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
            onClick={() => setActiveTab("permissions")}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "permissions" 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-teal-600" />
            جدول الصلاحيات
          </button>

          <button
            onClick={() => setActiveTab("staff")}
            className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "staff"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="h-4 w-4 text-teal-600" />
            الموظفون وأكواد الدخول ({staff.length})
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
                        <option value="waiter">نادل / جرسون (Waiter)</option>
                        <option value="chef">المطبخ / الشيف (KDS)</option>
                        <option value="expo">التجميع والتسليم (Expo)</option>
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

      {/* 3. Permissions Matrix (Takka-style) */}
      {activeTab === "permissions" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Card className="border-slate-150 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-teal-600" />
                مصفوفة توزيع صلاحيات الأدوار والأجهزة
              </CardTitle>
              <CardDescription className="text-[10.5px] text-right mt-1">
                توزيع الصلاحيات الافتراضية لكل دور تشغيلي في المطعم على مستوى واجهات الأنظمة والأجهزة المخصصة.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto text-right" dir="rtl">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="p-4 font-black text-slate-800 text-right w-1/3">البرنامج / الوحدة التشغيلية</th>
                    {["waiter", "chef", "expo", "cashier", "inventory_manager"].map(r => (
                      <th key={r} className="p-4 font-black text-slate-800 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] border ${roleColors[r]?.bg} ${roleColors[r]?.text} ${roleColors[r]?.border}`}>
                          {roleColors[r]?.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {["waiter", "kitchen", "expo", "pos", "recipes", "inventory", "purchasing", "waste", "reports"].map(modKey => {
                    const mod = moduleLabels[modKey];
                    return (
                      <tr key={modKey} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-2.5">
                            <span className="text-lg">{mod.icon}</span>
                            <div>
                              <p className="font-bold text-slate-900">{mod.title}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{mod.desc}</p>
                            </div>
                          </div>
                        </td>
                        {["waiter", "chef", "expo", "cashier", "inventory_manager"].map(role => {
                          const hasAccess = roleDefaultModules[role]?.includes(modKey);
                          return (
                            <td key={role} className="p-4 text-center">
                              {hasAccess ? (
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm">
                                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-rose-50 text-rose-600 border border-rose-100 shadow-sm">
                                  <X className="h-3.5 w-3.5 stroke-[3]" />
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4. Staff Members (Tekka-style cards with login codes) */}
      {activeTab === "staff" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" />
              إدارة الموظفين وأكواد الدخول السريع
            </h2>
            <Button
              onClick={() => { setStaffFormOpen((v) => !v); setCreatedStaffCode(null); }}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold h-9 text-xs gap-1.5"
            >
              <Plus className="h-4 w-4" />
              موظف جديد
            </Button>
          </div>

          {staffFormOpen && (
            <Card className="border-teal-200 shadow-sm">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-4">
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <UserCheck className="h-4.5 w-4.5 text-teal-600" />
                  إضافة موظف جديد
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={handleCreateStaff} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label className="text-xs font-black text-slate-800">الاسم الكامل *</Label>
                      <Input
                        placeholder="مثال: محمد علي"
                        value={staffForm.fullName}
                        onChange={(e) => setStaffForm((p) => ({ ...p, fullName: e.target.value }))}
                        required
                        className="h-10 text-xs text-right"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs font-black text-slate-800">رقم الهاتف</Label>
                      <Input
                        placeholder="059XXXXXXX"
                        value={staffForm.phone}
                        onChange={(e) => setStaffForm((p) => ({ ...p, phone: e.target.value }))}
                        className="h-10 text-xs text-right"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs font-black text-slate-800">الدور</Label>
                      <select
                        value={staffForm.role}
                        onChange={(e) => setStaffForm((p) => ({ ...p, role: e.target.value }))}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-teal-500/50"
                      >
                        <option value="waiter">جرسون</option>
                        <option value="cashier">محاسب</option>
                        <option value="kitchen">مطبخ</option>
                        <option value="bar">بار</option>
                        <option value="shisha">شيشة</option>
                        <option value="manager">مدير</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs font-black text-slate-800">الفرع</Label>
                      <select
                        value={staffForm.branchId}
                        onChange={(e) => setStaffForm((p) => ({ ...p, branchId: e.target.value }))}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-teal-500/50"
                      >
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11 text-xs font-black bg-teal-600 hover:bg-teal-700 text-white">
                    توليد كود الدخول تلقائياً
                  </Button>

                  {createdStaffCode && (
                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 block font-bold">كود الدخول الجديد:</span>
                        <code className="font-mono text-lg font-black text-teal-800 tracking-widest">{createdStaffCode}</code>
                      </div>
                      <Button
                        type="button"
                        onClick={() => copyStaffCode(createdStaffCode)}
                        className="bg-teal-600 hover:bg-teal-700 text-white h-9 text-xs gap-1.5"
                      >
                        {staffCopied ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {staffCopied ? "تم النسخ" : "نسخ"}
                      </Button>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          )}

          {staffLoading ? (
            <Card className="border-slate-150 py-12">
              <CardContent className="flex items-center justify-center text-xs text-slate-400">
                جاري تحميل الموظفين...
              </CardContent>
            </Card>
          ) : staff.length === 0 ? (
            <Card className="border-dashed border-slate-200 bg-slate-50/50 py-12">
              <CardContent className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-450 border border-slate-200/60">
                  <Users className="h-6 w-6 stroke-[1.5]" />
                </div>
                <p className="text-sm font-black text-slate-800">لا يوجد موظفون مسجلون بعد</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  أضف موظفاً ليحصل على كود دخول سريع خاص بكل قسم.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {staff.map((member) => {
                const meta = staffRoleMeta[member.role] ?? staffRoleMeta.waiter;
                return (
                  <Card
                    key={member.id}
                    className={`border border-slate-150 shadow-sm relative overflow-hidden group hover:border-slate-300 transition-all duration-200 ${
                      !member.is_active ? "opacity-60 bg-slate-50/40" : "bg-white"
                    }`}
                  >
                    <div className={`absolute top-0 bottom-0 start-0 w-1.5 ${member.is_active ? "bg-teal-500" : "bg-slate-350"}`} />
                    <CardContent className="p-4 space-y-3.5">
                      {/* Avatar + name */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-12 w-12 rounded-full flex items-center justify-center font-black text-lg ${meta.bg} ${meta.text}`}
                        >
                          {member.full_name?.charAt(0) ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-slate-900 truncate">{member.full_name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{member.phone || "بدون رقم"}</p>
                        </div>
                      </div>

                      {/* Role badge + login code */}
                      <div className="flex items-center justify-between py-2 border-y border-slate-100">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-muted-foreground">الدور</span>
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] border ${meta.bg} ${meta.text} ${meta.border}`}>
                            {meta.label}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          <span className="text-[10px] text-muted-foreground">كود الدخول</span>
                          <button
                            onClick={() => copyStaffCode(member.login_code)}
                            title="نسخ الكود"
                            className="font-mono text-lg font-black text-teal-700 tracking-widest hover:text-teal-900"
                          >
                            {member.login_code}
                          </button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            member.is_active ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                          }`}
                        >
                          {member.is_active ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                          {member.is_active ? "نشط" : "معطل"}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => handleToggleStaff(member.id)}
                            className="h-8 px-2.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100"
                          >
                            {member.is_active ? "تعطيل" : "تفعيل"}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => handleDeleteStaff(member.id)}
                            className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 rounded-lg"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
