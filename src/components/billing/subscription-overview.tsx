import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Layers3,
  MonitorSmartphone,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRewaqPlan } from "@/lib/billing/plans";
import type { OrganizationEntitlements } from "@/server/billing/entitlements";

type StatusTone = "default" | "success" | "warning" | "danger" | "muted";

const SUBSCRIPTION_STATUS: Record<
  string,
  { label: string; tone: StatusTone; description: string }
> = {
  active: {
    label: "نشط",
    tone: "success",
    description: "الاشتراك نشط ويمكن تنفيذ العمليات المتاحة في الباقة.",
  },
  trial: {
    label: "فترة تجريبية",
    tone: "default",
    description: "الحساب يعمل ضمن الفترة التجريبية الحالية.",
  },
  past_due: {
    label: "دفعة مستحقة",
    tone: "warning",
    description: "توجد دفعة تحتاج إلى متابعة للحفاظ على استمرارية العمليات.",
  },
  paused: {
    label: "متوقف مؤقتًا",
    tone: "danger",
    description: "يمكن مراجعة البيانات، بينما تتطلب العمليات الجديدة إعادة تفعيل الاشتراك.",
  },
};

export function SubscriptionOverview({
  subscription,
}: {
  subscription: OrganizationEntitlements | null;
}) {
  if (!subscription) {
    return (
      <Card variant="muted" className="rounded-lg" role="status" aria-live="polite">
        <CardContent className="flex items-start gap-3 p-5 sm:p-6">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-card text-muted-foreground">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-extrabold text-foreground">حالة الاشتراك غير متاحة</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              تعذر تحميل سجل الاشتراك من بيئة التشغيل الحالية. لم تُفترض باقة بديلة، ويمكنك
              مراجعة كتالوج الباقات أدناه.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const plan = getRewaqPlan(subscription.planCode);
  const status = SUBSCRIPTION_STATUS[subscription.status] ?? {
    label: "قيد المراجعة",
    tone: "muted" as const,
    description: "حالة الاشتراك قيد المراجعة لدى فريق رواق.",
  };
  const limits = [
    { label: "الفروع", value: formatLimit(plan.limits.maxBranches), icon: Building2 },
    { label: "المستخدمون", value: formatLimit(plan.limits.maxUsers), icon: UsersRound },
    { label: "الأجهزة", value: formatLimit(plan.limits.maxDevices), icon: MonitorSmartphone },
    { label: "الوحدات", value: String(plan.modules.length), icon: Layers3 },
  ];

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <Card className="rounded-lg">
        <CardHeader className="flex flex-row items-start justify-between gap-4 p-5 pb-4 sm:p-6 sm:pb-4">
          <div>
            <p className="text-xs font-bold text-muted-foreground">الاشتراك الحالي</p>
            <CardTitle className="mt-1 flex items-center gap-2 text-2xl">
              <WalletCards className="h-5 w-5 text-primary" aria-hidden="true" />
              {plan.name}
            </CardTitle>
          </div>
          <Badge tone={status.tone}>{status.label}</Badge>
        </CardHeader>
        <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
          <div className="flex flex-col gap-2 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
            <p className="text-sm leading-6 text-muted-foreground">{plan.description}</p>
            <p className="shrink-0 font-bold text-foreground" dir="ltr">
              <span className="text-3xl font-black tabular-nums">{plan.monthlyPriceUsd}</span>{" "}
              <span className="text-sm text-muted-foreground">USD / month</span>
            </p>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
            {limits.map((limit) => {
              const Icon = limit.icon;
              return (
                <div key={limit.label} className="bg-card p-3">
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {limit.label}
                  </dt>
                  <dd className="mt-1 text-sm font-extrabold text-foreground">{limit.value}</dd>
                </div>
              );
            })}
          </dl>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader className="p-5 pb-4 sm:p-6 sm:pb-4">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            حالة الخدمة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-5 pt-0 sm:p-6 sm:pt-0">
          <p className="text-sm leading-7 text-muted-foreground">{status.description}</p>
          <div className="border-t border-border pt-4">
            <p className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              نهاية دورة الاشتراك
            </p>
            <p className="mt-2 font-extrabold text-foreground">
              {formatPeriodEnd(subscription.periodEnd)}
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function formatLimit(value: number | null) {
  return value === null ? "غير محدودة" : String(value);
}

function formatPeriodEnd(value: string | null) {
  if (!value) return "غير محددة في سجل الاشتراك";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير محددة في سجل الاشتراك";

  return new Intl.DateTimeFormat("ar", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
