"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  BadgeCheck, Building2, ChefHat, CircleOff, ClipboardCopy, KeyRound,
  Landmark, MonitorSmartphone, PackageOpen, Plus, RefreshCw, ShieldCheck,
  ShoppingCart, UserRound, Users, Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createEmployeeAccessAction,
  revokeEmployeeAccessAction,
  rotateEmployeeCodeAction,
  type EmployeeAccessActionState,
} from "@/server/actions/team-access";
import type { TeamAccessEmployee, TeamAccessOption } from "@/server/queries/team-access";
import type { Role } from "@/types/domain";

type Props = {
  employees: TeamAccessEmployee[];
  branches: TeamAccessOption[];
  departments: TeamAccessOption[];
};

type EmployeeRole = Exclude<Role, "super_admin" | "organization_owner" | "marketing_manager">;
type RoleOption = { value: EmployeeRole; label: string; workspace: string; icon: typeof UserRound };

const roleOptions: RoleOption[] = [
  { value: "branch_manager", label: "مدير الفرع", workspace: "لوحة التشغيل والتقارير ضمن الفرع", icon: Building2 },
  { value: "cashier", label: "الكاشير", workspace: "شاشة نقاط البيع والوردية", icon: MonitorSmartphone },
  { value: "staff", label: "النادل / خدمة الصالة", workspace: "الطاولات والطلبات ومتابعة الجاهزية", icon: UserRound },
  { value: "chef", label: "المطبخ / KDS", workspace: "طلبات محطة المطبخ والتجميع", icon: ChefHat },
  { value: "inventory_manager", label: "أمين المستودع", workspace: "المخزون والجرد والتحويلات والتالف", icon: Warehouse },
  { value: "purchasing_manager", label: "مسؤول المشتريات", workspace: "الموردون والطلبيات وفواتير التوريد", icon: ShoppingCart },
  { value: "accountant", label: "المحاسب", workspace: "المحاسبة والفواتير والتقارير المالية", icon: Landmark },
];

const roleMap = new Map(roleOptions.map((role) => [role.value, role]));
const initialState: EmployeeAccessActionState = { ok: false, message: "" };

function statusLabel(employee: TeamAccessEmployee) {
  if (employee.revokedAt) return { label: "متوقف", className: "bg-red-50 text-red-700 border-red-200" };
  if (employee.accepted) return { label: "نشط", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  return { label: "بانتظار أول دخول", className: "bg-amber-50 text-amber-700 border-amber-200" };
}

function formatDate(value: string | null) {
  if (!value) return "لم يستخدم بعد";
  return new Intl.DateTimeFormat("ar-PS", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function PermissionsWorkspaceClient({ employees, branches, departments }: Props) {
  const [state, formAction, formPending] = useActionState(createEmployeeAccessAction, initialState);
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [dismissedCode, setDismissedCode] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyEmployeeId, setBusyEmployeeId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleIssuedCode = issuedCode ?? (state.code !== dismissedCode ? state.code : null);

  const visibleDepartments = useMemo(
    () => departments.filter((department) => !branchId || department.branchId === branchId),
    [branchId, departments],
  );

  const branchName = (id: string | null) => branches.find((branch) => branch.id === id)?.name ?? "كل الفروع";
  const departmentName = (id: string | null) => departments.find((department) => department.id === id)?.name ?? null;

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setFeedback("تم نسخ الكود.");
  };

  const rotateCode = (employeeId: string) => {
    setBusyEmployeeId(employeeId);
    setFeedback(null);
    startTransition(async () => {
      const result = await rotateEmployeeCodeAction(employeeId);
      setBusyEmployeeId(null);
      setFeedback(result.message);
      if (result.code) setIssuedCode(result.code);
    });
  };

  const revokeAccess = (employeeId: string) => {
    if (!window.confirm("هل تريد إيقاف دخول هذا الموظف؟ لن تُحذف سجلاته أو عملياته.")) return;
    setBusyEmployeeId(employeeId);
    setFeedback(null);
    startTransition(async () => {
      const result = await revokeEmployeeAccessAction(employeeId);
      setBusyEmployeeId(null);
      setFeedback(result.message);
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#1363DF]">
            <ShieldCheck className="h-4 w-4" /> دخول الموظفين والصلاحيات
          </div>
          <h1 className="text-2xl font-black text-slate-950">الفريق والأدوار</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            لكل موظف كود شخصي ودور واحد واضح. بعد الدخول يفتح رواق واجهته المناسبة فقط، بينما كود الجهاز يبقى مستقلًا للأجهزة المشتركة.
          </p>
        </div>
        <a href="/login" target="_blank" rel="noreferrer">
          <Button variant="outline" className="gap-2"><KeyRound className="h-4 w-4" /> فتح صفحة دخول الموظفين</Button>
        </a>
      </div>

      {visibleIssuedCode ? (
        <Card className="border-2 border-emerald-300 bg-emerald-50/70">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <div className="flex items-center gap-2 font-black text-emerald-900">
                <BadgeCheck className="h-5 w-5" /> كود الموظف جاهز ومحفوظ بشكل مشفّر للمالك
              </div>
              <code className="mt-3 block select-all text-xl font-black tracking-wider text-slate-950" dir="ltr">{visibleIssuedCode}</code>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={() => copyCode(visibleIssuedCode)} className="gap-2"><ClipboardCopy className="h-4 w-4" /> نسخ الكود</Button>
              <Button type="button" variant="outline" onClick={() => { setIssuedCode(null); setDismissedCode(visibleIssuedCode); }}>تم الحفظ</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {(state.message || feedback) ? (
        <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${(state.ok || feedback) ? "border-blue-200 bg-blue-50 text-blue-900" : "border-red-200 bg-red-50 text-red-800"}`}>
          {feedback ?? state.message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="h-fit">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Plus className="h-5 w-5 text-[#1363DF]" /> إضافة موظف وكود</CardTitle></CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="fullName">اسم الموظف</Label><Input id="fullName" name="fullName" placeholder="مثال: أحمد محمد" required minLength={2} /></div>
              <div className="space-y-2"><Label htmlFor="email">البريد الإلكتروني (اختياري)</Label><Input id="email" name="email" type="email" placeholder="يمكن الدخول بالكود من دون بريد" dir="ltr" /></div>
              <div className="space-y-2">
                <Label htmlFor="role">الدور والواجهة</Label>
                <select id="role" name="role" defaultValue="staff" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" required>
                  {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label} — {role.workspace}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="branchId">الفرع</Label>
                <select id="branchId" name="branchId" value={branchId} onChange={(event) => setBranchId(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                  <option value="">كل الفروع (للأدوار المركزية)</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="departmentId">القسم التشغيلي (اختياري)</Label>
                <select id="departmentId" name="departmentId" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                  <option value="">من دون قسم محدد</option>
                  {visibleDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </div>
              <Button type="submit" disabled={formPending} className="w-full gap-2">
                {formPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} إنشاء الموظف وإصدار الكود
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-950"><Users className="h-5 w-5 text-[#1363DF]" /> الموظفون ({employees.length})</h2>
            <p className="text-xs text-slate-500">الأكواد الجديدة تظهر كاملة للمالك فقط، وتبقى مشفّرة داخل قاعدة البيانات.</p>
          </div>
          {employees.length === 0 ? (
            <Card><CardContent className="grid min-h-48 place-items-center p-6 text-center text-sm text-slate-500">لا يوجد موظفون بعد. أضف أول موظف من النموذج.</CardContent></Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {employees.map((employee) => {
                const role = roleMap.get(employee.role as EmployeeRole);
                const RoleIcon = role?.icon ?? UserRound;
                const status = statusLabel(employee);
                const busy = isPending && busyEmployeeId === employee.id;
                const department = departmentName(employee.departmentId);
                return (
                  <Card key={employee.id} className="overflow-hidden">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[#1363DF]"><RoleIcon className="h-5 w-5" /></span>
                          <div className="min-w-0"><h3 className="truncate font-black text-slate-950">{employee.fullName}</h3><p className="truncate text-xs text-slate-500">{employee.email ?? "دخول بالكود فقط"}</p></div>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${status.className}`}>{status.label}</span>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3 text-sm"><div className="font-black text-slate-900">{role?.label ?? employee.role}</div><div className="mt-1 text-xs text-slate-500">{role?.workspace}</div></div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div><span className="block text-slate-500">النطاق</span><strong>{branchName(employee.branchId)}{department ? ` / ${department}` : ""}</strong></div>
                        <div>
                          <span className="block text-slate-500">كود الموظف</span>
                          {employee.code ? (
                            <button type="button" onClick={() => void copyCode(employee.code!)} className="mt-1 inline-flex items-center gap-1.5 font-mono font-black text-[#1363DF]" dir="ltr" title="نسخ الكود">
                              <ClipboardCopy className="h-3.5 w-3.5" /> {employee.code}
                            </button>
                          ) : (
                            <strong className="text-amber-700" dir="ltr">قديم: {employee.codeHint ?? "غير متوفر"}</strong>
                          )}
                        </div>
                        <div className="col-span-2"><span className="block text-slate-500">آخر دخول</span><strong>{formatDate(employee.lastUsedAt)}</strong></div>
                      </div>
                      <div className="flex flex-wrap gap-2 border-t pt-4">
                        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => rotateCode(employee.id)} className="gap-2">
                          {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} {employee.revokedAt ? "إعادة التفعيل بكود جديد" : employee.code ? "تغيير الكود" : "إصدار كود قابل للعرض"}
                        </Button>
                        {!employee.revokedAt ? <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => revokeAccess(employee.id)} className="gap-2 text-red-700 hover:text-red-800"><CircleOff className="h-4 w-4" /> إيقاف الدخول</Button> : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Card className="border-dashed bg-slate-50/70">
        <CardContent className="grid gap-3 p-5 sm:grid-cols-3">
          <div className="flex gap-3"><PackageOpen className="h-5 w-5 shrink-0 text-[#1363DF]" /><div><strong className="text-sm">كود شخصي</strong><p className="text-xs text-slate-500">يحدد الموظف والدور ويسجل عملياته باسمه.</p></div></div>
          <div className="flex gap-3"><MonitorSmartphone className="h-5 w-5 shrink-0 text-[#1363DF]" /><div><strong className="text-sm">كود جهاز مستقل</strong><p className="text-xs text-slate-500">يهيئ كاشير أو KDS أو شاشة مخزن مشتركة للفرع.</p></div></div>
          <div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-[#1363DF]" /><div><strong className="text-sm">صلاحيات من الخادم</strong><p className="text-xs text-slate-500">إخفاء الواجهة وحده لا يكفي؛ كل عملية محمية بالدور والنطاق.</p></div></div>
        </CardContent>
      </Card>
    </div>
  );
}
