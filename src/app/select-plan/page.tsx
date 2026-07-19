import { redirect } from "next/navigation";
import { CreditCard, ShieldCheck } from "lucide-react";
import { PlanCard } from "@/components/billing/plan-card";
import { Badge } from "@/components/ui/badge";
import { requireAuthOrRedirect } from "@/lib/auth/require-auth";
import { REWAQ_PLAN_LIST } from "@/lib/billing/plans";
import { selectTrialPlanAction } from "@/server/actions/billing";
import { getOrganizationPlanSelection } from "@/server/billing/plan-selection";

const ERROR_MESSAGES: Record<string, string> = {
  "owner-required": "اختيار باقة المؤسسة متاح للمالك فقط.",
  "invalid-plan": "الباقة المختارة غير صالحة. اختر إحدى الباقات الثلاث.",
  "service-unavailable": "خدمة الاشتراكات غير مهيأة الآن. حاول لاحقًا.",
  "save-failed": "تعذر حفظ اختيار الباقة. لم يتم تغيير الاشتراك؛ حاول مرة أخرى.",
};

export default async function SelectPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireAuthOrRedirect();
  const selection = await getOrganizationPlanSelection(user);
  const { error } = await searchParams;

  if (selection.selected) {
    redirect("/dashboard");
  }

  const canSelect = user.role === "organization_owner" || user.role === "super_admin";

  return (
    <main dir="rtl" className="min-h-screen bg-background px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-7xl">
        <header className="mx-auto max-w-3xl text-center">
          <Badge tone="default">الخطوة الأولى في رواق</Badge>
          <h1 className="mt-5 text-3xl font-black leading-tight text-foreground sm:text-5xl">
            اختر حجم مطعمك لفتح الصلاحيات المناسبة
          </h1>
          <p className="mt-4 text-base leading-8 text-muted-foreground">
            اضغط الباقة المناسبة لتدخل النظام مباشرة. لن يتم تحصيل أي مبلغ الآن؛ ربط الدفع
            وتغيير الباقة لاحقًا سيكونان من صفحة الفوترة.
          </p>
        </header>

        {error && ERROR_MESSAGES[error] ? (
          <div
            role="alert"
            className="mx-auto mt-6 max-w-2xl rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-center text-sm font-bold text-destructive"
          >
            {ERROR_MESSAGES[error]}
          </div>
        ) : null}

        {!canSelect ? (
          <div className="mx-auto mt-6 max-w-2xl rounded-lg border border-warning/30 bg-amber-50 p-4 text-center text-sm leading-7 text-amber-900">
            يجب أن يختار مالك المؤسسة الباقة أولًا. بعد ذلك ستظهر لك الشاشات التي يسمح بها
            دورك الوظيفي وباقة المطعم معًا.
          </div>
        ) : null}

        <section className="mt-9 grid items-stretch gap-5 lg:grid-cols-3" aria-label="باقات رواق">
          {REWAQ_PLAN_LIST.map((plan) => (
            <PlanCard
              key={plan.code}
              plan={plan}
              action={
                canSelect
                  ? {
                      formAction: selectTrialPlanAction,
                      planCode: plan.code,
                      label: `اختيار ${plan.shortName}`,
                    }
                  : undefined
              }
            />
          ))}
        </section>

        <div className="mx-auto mt-8 grid max-w-3xl gap-3 text-sm leading-7 text-muted-foreground sm:grid-cols-2">
          <p className="flex items-start gap-2 rounded-lg border border-border bg-card p-4">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            الباقة تحدد وحدات المؤسسة، بينما يحدد دور كل موظف ما يستطيع قراءته أو تعديله.
          </p>
          <p className="flex items-start gap-2 rounded-lg border border-border bg-card p-4">
            <CreditCard className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            الاختيار الحالي يبدأ كتجربة؛ لن نطلب بيانات بطاقة أو ننفذ تحصيلًا في هذه الخطوة.
          </p>
        </div>
      </div>
    </main>
  );
}
