import { Check, Minus } from "lucide-react";
import {
  MODULE_LABELS,
  REWAQ_MODULES,
  REWAQ_PLAN_LIST,
} from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export function PlanComparison({
  className,
  title = "مقارنة الوحدات",
  description = "تعرف على الوحدات المشمولة في كل باقة قبل اتخاذ القرار.",
}: {
  className?: string;
  title?: string;
  description?: string;
}) {
  return (
    <section className={cn("space-y-5", className)} aria-labelledby="plan-comparison-title">
      <div>
        <h2 id="plan-comparison-title" className="text-2xl font-extrabold text-foreground">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
        <table className="w-full min-w-[760px] border-collapse text-right text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/55">
              <th scope="col" className="w-[34%] px-5 py-4 font-extrabold text-foreground">
                الوحدة
              </th>
              {REWAQ_PLAN_LIST.map((plan) => (
                <th
                  key={plan.code}
                  scope="col"
                  className={cn(
                    "w-[22%] px-4 py-4 text-center",
                    plan.code === "scale" ? "bg-secondary/5" : "",
                  )}
                >
                  <span className="block font-extrabold text-foreground">{plan.shortName}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-muted-foreground" dir="ltr">
                    {plan.monthlyPriceUsd} USD
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REWAQ_MODULES.map((module, index) => (
              <tr
                key={module}
                className={cn(
                  "border-b border-border/70 last:border-b-0",
                  index % 2 === 1 ? "bg-muted/20" : "bg-card",
                )}
              >
                <th scope="row" className="px-5 py-3.5 font-bold text-foreground">
                  {MODULE_LABELS[module]}
                </th>
                {REWAQ_PLAN_LIST.map((plan) => {
                  const included = plan.modules.includes(module);
                  return (
                    <td
                      key={plan.code}
                      className={cn(
                        "px-4 py-3.5 text-center",
                        plan.code === "scale" ? "bg-secondary/[0.035]" : "",
                      )}
                    >
                      {included ? (
                        <>
                          <Check className="mx-auto h-5 w-5 text-emerald-600" aria-hidden="true" />
                          <span className="sr-only">مشمولة</span>
                        </>
                      ) : (
                        <>
                          <Minus
                            className="mx-auto h-4 w-4 text-muted-foreground/55"
                            aria-hidden="true"
                          />
                          <span className="sr-only">غير مشمولة</span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
