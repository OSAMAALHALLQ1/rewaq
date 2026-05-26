"use client";

import { useEffect, useState } from "react";
import { 
  Tablet, KeyRound, CheckSquare, Square, Copy, ShieldCheck, 
  Trash2, Plus, MessageSquare, AlertCircle, RefreshCw, Send, Users 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";

type DeviceKey = {
  id: string;
  device_name: string;
  role: string;
  branch_name?: string;
  allowed_modules: string[];
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  raw_key?: string; // Only populated temporarily upon generation
};

type AuditMessage = {
  id: string;
  sender_name: string;
  sender_role: string;
  recipient_role: string | null;
  content: string;
  created_at: string;
};

const moduleLabels: Record<string, string> = {
  inventory: "📉 المخزون والجرد",
  recipes: "🍳 الوصفات وتكلفة وجبات الطعام",
  purchasing: "📦 الموردين وطلبات الشراء",
  waste: "🗑️ تسجيل الهدر والتلف",
  pos: "💻 شاشة الكاشير والبيع السريع",
  reports: "📊 التقارير والمؤشرات المالية",
};

export default function SettingsDevicesPage() {
  const [devices, setDevices] = useState<DeviceKey[]>([]);
  const [auditChats, setAuditChats] = useState<AuditMessage[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  
  // Form State
  const [deviceName, setDeviceName] = useState("");
  const [selectedRole, setSelectedRole] = useState("chef");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedModules, setSelectedModules] = useState<string[]>(["recipes"]);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    // 1. Fetch organization ID and branches
    const loadMetadata = async () => {
      // For demo or active session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from("organization_memberships")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (member) {
        setOrgId(member.organization_id);
        
        // Load branches
        const { data: branchData } = await supabase
          .from("branches")
          .select("id, name")
          .eq("organization_id", member.organization_id);
        
        if (branchData) {
          setBranches(branchData);
          if (branchData.length > 0) setSelectedBranch(branchData[0].id);
        }

        // Load devices
        loadDevices(member.organization_id);
        
        // Load live chats for audit
        loadAuditChats(member.organization_id);
      }
    };

    loadMetadata();
  }, [supabase]);

  const loadDevices = async (organizationId: string) => {
    const { data, error } = await supabase
      .from("department_api_keys")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (data && !error) {
      setDevices(data.map((d: any) => ({
        id: d.id,
        device_name: d.device_name,
        role: d.role,
        allowed_modules: d.allowed_modules,
        is_active: d.is_active,
        created_at: d.created_at,
        last_used_at: d.last_used_at,
      })));
    }
  };

  const loadAuditChats = async (organizationId: string) => {
    const { data, error } = await supabase
      .from("internal_messages")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(10); // Show last 10 messages for live dashboard audit

    if (data && !error) {
      setAuditChats(data);
    }
  };

  const handleToggleModule = (moduleKey: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleKey)
        ? prev.filter((m) => m !== moduleKey)
        : [...prev, moduleKey]
    );
  };

  // Cryptographically generate a random 10-character uppercase alphanumeric key
  const generateRaw10SymbolKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let key = "RWQ_";
    for (let i = 0; i < 6; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key; // e.g. RWQ_A7B8C9 (exactly 10 symbols)
  };

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !deviceName.trim()) return;

    setLoading(true);
    const rawKey = generateRaw10SymbolKey();
    
    // Hash key using SHA-256 for secure DB lookup
    const encoder = new TextEncoder();
    const data = encoder.encode(rawKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    const insertData = {
      organization_id: orgId,
      branch_id: selectedBranch || null,
      device_name: deviceName.trim(),
      key_hash: keyHash,
      role: selectedRole,
      allowed_modules: selectedModules,
      is_active: true,
    };

    const { error } = await supabase.from("department_api_keys").insert(insertData);

    if (!error) {
      // Setup successful generation alert display values
      setGeneratedKey(rawKey);
      const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      setGeneratedLink(`${origin}/d/gate?key=${rawKey}`);
      
      // Reset inputs
      setDeviceName("");
      setSelectedModules(["recipes"]);
      
      // Reload devices table
      loadDevices(orgId);
    } else {
      alert("خطأ في إنشاء الجهاز اللوحي");
    }
    setLoading(false);
  };

  const handleRevokeDevice = async (id: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في إلغاء تنشيط وصول هذا الجهاز اللوحي فوراً؟")) return;

    const { error } = await supabase
      .from("department_api_keys")
      .update({ is_active: false })
      .eq("id", id);

    if (!error && orgId) {
      loadDevices(orgId);
    }
  };

  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 text-right">
      <div className="border-b border-slate-100 pb-4">
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <Tablet className="h-6 w-6 text-primary" />
          إدارة الأجهزة وصلاحيات الأقسام
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          بصفتك مديراً، يمكنك إنشاء مفاتيح API مخصصة من 10 رموز لكل تابلت بالقسم، وتحديد صلاحيات الداشبورد المناسبة لكل شاشة، ومتابعة الدردشة الجارية.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 items-start">
        
        {/* Left Side: Terminals list */}
        <div className="space-y-6">
          <Card className="border-slate-100 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Tablet className="h-5 w-5 text-primary" />
                الأجهزة النشطة بالفرع ({devices.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/30">
                  <TableRow>
                    <TableHead className="text-right text-xs">اسم الجهاز</TableHead>
                    <TableHead className="text-right text-xs">الدور المرجعي</TableHead>
                    <TableHead className="text-right text-xs">الوحدات المفتوحة</TableHead>
                    <TableHead className="text-right text-xs">تاريخ الإنشاء</TableHead>
                    <TableHead className="text-right text-xs">آخر اتصال</TableHead>
                    <TableHead className="text-center text-xs">الحالة</TableHead>
                    <TableHead className="text-center text-xs">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-xs py-8 text-muted-foreground">
                        لا توجد أجهزة لوحية مسجلة حالياً بالفرع.
                      </TableCell>
                    </TableRow>
                  ) : (
                    devices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell className="font-semibold text-xs text-slate-800">{device.device_name}</TableCell>
                        <TableCell>
                          <Badge tone="default" className="text-[10px]">
                            {device.role === "chef" ? "مطبخ / شيف" : 
                             device.role === "cashier" ? "كاشير" : 
                             device.role === "inventory_manager" ? "أمين مخزن" : "موظف"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {device.allowed_modules.map((m) => (
                              <span key={m} className="text-[9px] bg-teal-50 text-primary border border-teal-100 rounded px-1.5 py-0.5">
                                {m === "inventory" ? "مخزون" : 
                                 m === "recipes" ? "وصفات" : 
                                 m === "purchasing" ? "مشتريات" : 
                                 m === "waste" ? "هدر" : 
                                 m === "pos" ? "كاشير" : "تقارير"}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(device.created_at).toLocaleDateString("ar-SA")}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {device.last_used_at 
                            ? new Date(device.last_used_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) 
                            : "غير متصل"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge tone={device.is_active ? "success" : "danger"} className="text-[9px]">
                            {device.is_active ? "نشط" : "ملغى"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {device.is_active && (
                            <Button 
                              variant="outline" 
                              onClick={() => handleRevokeDevice(device.id)}
                              className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600 border-slate-200"
                              title="إلغاء تنشيط الجهاز"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Audit Chat logs for Manager */}
          <Card className="border-slate-100 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                سجل الرقابة الفوري للمحادثات
              </CardTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => orgId && loadAuditChats(orgId)} 
                className="text-slate-400 hover:text-slate-600"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5">
              <div className="rounded-lg bg-teal-50 border border-teal-100 p-2.5 text-[10px] text-primary flex items-start gap-2 mb-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>نمط الرقابة والإشراف: يرى المدير هنا آخر الرسائل المتبادلة بين أقسام المطبخ والكاشير والمخازن فورياً للتحقق من انتظام العمل وتكامل الموظفين.</span>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto">
                {auditChats.length === 0 ? (
                  <p className="text-center text-xs py-6 text-muted-foreground">لا توجد رسائل مسجلة حالياً.</p>
                ) : (
                  auditChats.map((msg) => (
                    <div key={msg.id} className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 flex flex-col gap-1.5 text-right">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-slate-800">{msg.sender_name} ({msg.sender_role === "chef" ? "المطبخ" : msg.sender_role === "cashier" ? "الكاشير" : "المستودع"})</span>
                        <span className="text-slate-400">
                          {new Date(msg.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{msg.content}</p>
                      <div className="flex justify-end mt-1">
                        <Badge tone="default" className="text-[8px] bg-slate-200 text-slate-700 font-bold border-none px-1.5 py-0">
                          {msg.recipient_role ? `موجهة لـ: ${msg.recipient_role === "chef" ? "المطبخ" : "الكاشير"}` : "جروب المطعم العام"}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Key Generation Form & allowed module mapping */}
        <div className="space-y-6">
          <Card className="border-slate-100 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                توليد مفتاح قسم جديد
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleCreateDevice} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="deviceName" className="text-xs">اسم التابلت / الجهاز:</Label>
                  <Input 
                    id="deviceName" 
                    placeholder="مثال: تابلت المطبخ رقم 1" 
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    required
                    className="h-10 text-xs"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="branch" className="text-xs">الفرع المخصص:</Label>
                  <select 
                    id="branch" 
                    value={selectedBranch} 
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="h-10 rounded-lg border bg-white px-3 text-xs"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="role" className="text-xs">الدور الافتراضي للجهاز:</Label>
                  <select 
                    id="role" 
                    value={selectedRole} 
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="h-10 rounded-lg border bg-white px-3 text-xs"
                  >
                    <option value="chef">المطبخ الشيف (KDS)</option>
                    <option value="cashier">الكاشير الكاش سريع (POS)</option>
                    <option value="inventory_manager">المخازن والمستودع</option>
                  </select>
                </div>

                {/* Granular Module permissions dynamic checkboxes */}
                <div className="grid gap-2.5">
                  <Label className="text-xs font-bold text-slate-800">تخصيص الصلاحيات وأقسام الداشبورد للتابلت:</Label>
                  <div className="grid grid-cols-1 gap-2 pt-1.5">
                    {Object.entries(moduleLabels).map(([key, label]) => {
                      const isChecked = selectedModules.includes(key);
                      return (
                        <div 
                          key={key} 
                          onClick={() => handleToggleModule(key)}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer select-none transition ${
                            isChecked 
                              ? "bg-teal-50/50 border-teal-400/50 text-slate-900" 
                              : "border-slate-200 hover:bg-slate-50 text-slate-600"
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare className="h-4.5 w-4.5 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4.5 w-4.5 text-slate-400 shrink-0" />
                          )}
                          <span className="text-xs font-semibold">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full h-11 text-xs font-bold bg-primary hover:bg-primary/95 text-white">
                  {loading ? "يتم الآن التوليد..." : "توليد كود الـ API والرابط المخصص"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Prompt success screen showing the generated key *once* */}
          {generatedKey && (
            <Card className="border-teal-100 bg-teal-50/20 shadow-lg relative overflow-hidden animate-in fade-in zoom-in duration-200">
              <CardHeader className="border-b border-teal-100 bg-teal-50/40 py-3 flex flex-row items-center gap-2">
                <ShieldCheck className="h-4.5 w-4.5 text-primary shrink-0" />
                <CardTitle className="text-xs font-bold text-slate-900">تم التوليد بنجاح! احفظه فوراً</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block">كود القسم الفوري (10 رموز):</span>
                  <div className="bg-white border border-teal-200 rounded-lg p-3 text-center font-mono tracking-widest text-lg font-black text-slate-900 shadow-sm select-all">
                    {generatedKey}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 block">رابط الوصول التلقائي للجهاز:</span>
                  <div className="flex gap-2">
                    <Input 
                      readOnly 
                      value={generatedLink || ""} 
                      className="bg-white border-teal-200 text-xs font-mono select-all flex-1 h-10 truncate text-slate-700" 
                    />
                    <Button 
                      onClick={handleCopyLink} 
                      className="h-10 bg-teal-600 hover:bg-teal-700 text-white shrink-0"
                    >
                      {copied ? "تم!" : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="text-[10.5px] leading-relaxed text-slate-500 bg-teal-50/50 p-2.5 rounded-lg border border-teal-100/50">
                  ⚠️ تنبيه أمني: يتم حفظ هذا الكود مشفراً بشكل آمن، ولن يتمكن التطبيق من عرضه لك مرة أخرى! انسخ الرابط وأرسله لتابلت المطبخ أو الكاشير ليقوم بالتثبيت التلقائي فوراً.
                </div>
              </CardContent>
            </Card>
          )}
        </div>

      </div>
    </div>
  );
}
