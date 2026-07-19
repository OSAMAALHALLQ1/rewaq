import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Check,
  Layers3,
  MonitorSmartphone,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { RewaqPlanDefinition } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

type PlanCardAction =
  | {
      href: string;
      label: string;
    }
  | {
      formAction: (formData: FormData) => void | Promise<void>;
      planCode: string;
      label: string;
    };

export function PlanCard({
  plan,
  action,
  current = false,
  className,
}: {
  plan: RewaqPlanDefinition;
  action?: PlanCardAction;
  current?: boolean;
  className?: string;
}) {
  const isComplete = plan.code === "scale";
  const mutedText = isComplete ? "text-secondary-foreground/70" : "text-muted-foreground";
  const limits = [
    { label: "الفروع", value: formatLimit(plan.limits.maxBranches), icon: Building2 },
    { label: "المستخدمون", value: formatLimit(plan.limits.maxUsers), icon: UsersRound },
    { label: "الأجهزة", value: formatLimit(plan.limits.maxDevices), icon: MonitorSmartphone },
  ];

  return (
    <Card
      variant={isComplete ? "dark" : "default"}
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-lg",
        plan.recommended && !current ? "border-primary shadow-lift" : "",
        current ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
        className,
      )}
    >
      <CardHeader className="space-y-5 p-5 sm:p-6">
        <div className="flex min-h-7 flex-wrap items-center gap-2">
          {current ? <Badge tone="success">الباقة الحالية</Badge> : null}
          {plan.recommended ? (
            <Badge
              className={isComplete ? "border-white/20 bg-white/10 text-white" : undefined}
            >
              الأكثر ملاءمة للنمو
            </Badge>
          ) : null}
          {isComplete ? (
            <Badge className="border-white/20 bg-white/10 text-white">جميع المزايا</Badge>
          ) : null}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={cn("text-xs font-bold", mutedText)}>باقة رواق</p>
            <h2 className="mt-1 text-2xl font-extrabold">{plan.shortName}</h2>
          </div>
          <span
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-md",
              isComplete ? "bg-white/10 text-white" : "bg-primary-light text-primary",
            )}
            aria-hidden="true"
          >
            <Layers3 className="h-5 w-5" />
          </span>
        </div>

        <p className={cn("min-h-14 text-sm leading-7", mutedText)}>{plan.description}</p>

        <div>
          <div className="flex items-end gap-2" dir="ltr">
            <span className="text-4xl font-black tabular-nums sm:text-5xl">
              {plan.monthlyPriceUsd}
            </span>
            <span className={cn("pb-1 text-sm font-bold", mutedText)}>USD</span>
          </div>
          <p className={cn("mt-1 text-xs", mutedText)}>اشتراك شهري</p>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col p-5 pt-0 sm:p-6 sm:pt-0">
        <dl
          className={cn(
            "grid grid-cols-3 divide-x divide-x-reverse overflow-hidden rounded-md border",
            isComplete
              ? "divide-white/10 border-white/10 bg-white/5"
              : "divide-border border-border bg-muted/45",
          )}
        >
          {limits.map((limit) => {
            const Icon = limit.icon;
            return (
              <div key={limit.label} className="min-w-0 px-2 py-3 text-center">
                <Icon className={cn("mx-auto h-4 w-4", mutedText)} aria-hidden="true" />
                <dt className={cn("mt-1 text-[11px]", mutedText)}>{limit.label}</dt>
                <dd className="mt-0.5 truncate text-xs font-extrabold sm:text-sm">{limit.value}</dd>
              </div>
            );
          })}
        </dl>

        <ul className="mt-5 space-y-3">
          {plan.highlights.map((highlight) => (
            <li key={highlight} className="flex items-start gap-2 text-sm font-semibold leading-6">
              <Check
                className={cn(
                  "mt-1 h-4 w-4 shrink-0",
                  isComplete ? "text-emerald-300" : "text-primary",
                )}
                aria-hidden="true"
              />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-6">
          {action ? (
            "href" in action ? (
              <Button
                className="w-full"
                variant={isComplete ? "light" : "default"}
                asChild
              >
                <Link href={action.href}>
                  {action.label}
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <form action={action.formAction}>
                <Button
                  className="w-full"
                  variant={isComplete ? "light" : "default"}
                  type="submit"
                  name="planCode"
                  value={action.planCode}
                >
                  {action.label}
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
              </form>
            )
          ) : current ? (
            <div
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-bold",
                isComplete
                  ? "border-white/15 bg-white/5"
                  : "border-primary/20 bg-primary-light text-primary",
              )}
              role="status"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              مفعّلة على حسابك
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function formatLimit(value: number | null) {
  return value === null ? "غير محدودة" : String(value);
}
