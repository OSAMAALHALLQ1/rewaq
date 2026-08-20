import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { DemoLoginButton } from "@/components/auth/demo-login-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EMPLOYEE_CODE_EXAMPLE } from "@/lib/auth/employee-code";
import { employeeCodeLoginAction } from "@/server/actions/access";
import { loginAction } from "@/server/actions/auth";

const PRODUCT_POINTS = [
  "تشغيل المطعم والمخزون والحسابات من مكان واحد",
  "عزل كامل لبيانات كل مؤسسة وقسم",
  "صلاحيات دقيقة ومسار دخول مستقل لكل موظف",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ approval?: string; trial?: string }>;
}) {
  const { approval, trial } = await searchParams;

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#f4f7ff] px-4 py-6 sm:px-6 lg:grid lg:place-items-center lg:px-10"
      dir="rtl"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#1e5eff]/10 blur-3xl" />
        <div className="absolute -bottom-36 -left-24 h-96 w-96 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(30,94,255,0.08)_1px,transparent_0)] bg-[size:28px_28px]" />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_32px_90px_rgba(17,35,90,0.16)] lg:min-h-[720px] lg:grid-cols-[0.9fr_1.1fr]">
        <section className="order-2 flex items-center px-5 py-8 sm:px-10 lg:order-1 lg:px-14 lg:py-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-wide text-[#1e5eff]">مرحبًا بعودتك</p>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  سجّل دخولك إلى رواق
                </h1>
              </div>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#eef3ff] text-[#1e5eff] sm:hidden">
                <Building2 className="h-6 w-6" aria-hidden="true" />
              </span>
            </div>

            {approval === "pending" ? (
              <div
                role="alert"
                className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"
              >
                حسابك مسجل، لكنه بانتظار موافقة الإدارة قبل فتح لوحة التحكم.
              </div>
            ) : null}

            {trial === "expired" ? (
              <div
                role="alert"
                className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"
              >
                انتهت الجلسة التجريبية المجانية (8 ساعات). ابدأ تجربة جديدة أو ادخل بحساب مؤسستك.
              </div>
            ) : null}

            <Tabs defaultValue="owner">
              <TabsList className="grid h-12 w-full grid-cols-2 rounded-2xl bg-slate-100 p-1">
                <TabsTrigger value="owner" className="gap-2 rounded-xl">
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  إدارة المطعم
                </TabsTrigger>
                <TabsTrigger value="employee" className="gap-2 rounded-xl">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                  دخول الموظف
                </TabsTrigger>
              </TabsList>

              <TabsContent value="owner" className="mt-6">
                <ActionForm action={loginAction} submitLabel="دخول لوحة الإدارة" className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="owner-email">البريد الإلكتروني</Label>
                    <Input
                      id="owner-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="name@restaurant.com"
                      dir="ltr"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="owner-password">كلمة المرور</Label>
                      <Link
                        href="/forgot-password"
                        className="text-xs font-bold text-[#1e5eff] hover:underline"
                      >
                        نسيت كلمة المرور؟
                      </Link>
                    </div>
                    <Input
                      id="owner-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      dir="ltr"
                      required
                    />
                  </div>
                  <p className="flex items-start gap-2 rounded-2xl bg-[#f6f8fc] p-3 text-xs leading-6 text-slate-600">
                    <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    يُحدَّد حساب مؤسستك وصلاحيتك من جلسة المصادقة وعضوية المؤسسة؛ لا توجد بيانات مالك مشتركة.
                  </p>
                </ActionForm>
              </TabsContent>

              <TabsContent value="employee" className="mt-6">
                <ActionForm
                  action={employeeCodeLoginAction}
                  submitLabel="فتح قسم الموظف"
                  className="space-y-4"
                >
                  <div className="grid gap-2">
                    <Label htmlFor="employee-code">كود الموظف الدائم</Label>
                    <Input
                      id="employee-code"
                      name="inviteCode"
                      type="text"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      placeholder={EMPLOYEE_CODE_EXAMPLE}
                      dir="ltr"
                      className="text-center font-mono tracking-wider"
                      required
                    />
                  </div>
                  <p className="flex items-start gap-2 rounded-2xl bg-[#f6f8fc] p-3 text-xs leading-6 text-slate-600">
                    <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    يبقى الكود صالحًا بعد أول دخول، ويقودك إلى قسمك فقط. يستطيع مالك المؤسسة إيقافه صراحةً عند الحاجة.
                  </p>
                </ActionForm>
              </TabsContent>
            </Tabs>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 font-bold text-slate-400">أو استكشف رواق أولًا</span>
              </div>
            </div>

            <DemoLoginButton />

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500">
              <span>
                ليس لديك حساب؟{" "}
                <Link href="/register" className="font-bold text-[#1e5eff] hover:underline">
                  أنشئ مؤسستك
                </Link>
              </span>
              <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" aria-hidden="true" />
              <Link href="/admin-login" className="font-bold text-slate-600 hover:text-[#1e5eff]">
                بوابة إدارة منصة رواق
              </Link>
            </div>
          </div>
        </section>

        <aside className="order-1 relative isolate overflow-hidden bg-[#102a72] px-6 py-8 text-white sm:px-10 lg:order-2 lg:px-14 lg:py-12">
          <div className="absolute inset-0 -z-20 bg-[linear-gradient(145deg,#0a1e54_0%,#1445d1_56%,#00a9d6_120%)]" />
          <div className="absolute -left-20 top-16 -z-10 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 -z-10 h-72 w-72 rounded-full bg-blue-300/20 blur-3xl" />

          <div className="flex h-full flex-col">
            <Link href="/" className="flex w-fit items-center gap-3" aria-label="العودة إلى رواق">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-2xl font-black text-[#1445d1] shadow-lg shadow-blue-950/20">
                ر
              </span>
              <span>
                <span className="block text-2xl font-black leading-none">رواق</span>
                <span className="mt-1 block text-[10px] tracking-[0.22em] text-blue-100">RESTAURANT OS</span>
              </span>
            </Link>

            <div className="my-auto py-10 lg:py-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-blue-50 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                إدارة أهدأ، قرارات أوضح
              </span>
              <h2 className="mt-6 max-w-lg text-3xl font-black leading-[1.45] sm:text-4xl lg:text-5xl">
                كل تفاصيل مطعمك، في رواق واحد.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-blue-100 sm:text-base">
                منصة عربية تربط المبيعات والمطبخ والمخزون والمشتريات والمحاسبة، مع صلاحيات تحافظ على بساطة العمل وأمان البيانات.
              </p>

              <ul className="mt-8 space-y-4">
                {PRODUCT_POINTS.map((point) => (
                  <li key={point} className="flex items-center gap-3 text-sm font-bold text-white/95">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <Link
              href="/pricing"
              className="inline-flex w-fit items-center gap-2 text-sm font-bold text-blue-50 transition hover:text-white"
            >
              تعرف على باقات رواق
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
