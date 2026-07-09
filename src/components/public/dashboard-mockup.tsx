import { AlertTriangle, BarChart3, Boxes, Megaphone, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function DashboardMockup() {
  const cards = [
    { label: "قيمة المخزون", value: "₪42,800", icon: Boxes, variant: "light" },
    { label: "طلبات مفتوحة", value: "4", icon: ShoppingCart, variant: "dark" },
    { label: "تكلفة الطعام", value: "29.8%", icon: BarChart3, variant: "primary" },
    { label: "منشورات اليوم", value: "2", icon: Megaphone, variant: "white" },
  ] as const;

  return (
    <div className="w-full rounded-[2rem] border border-white/15 bg-white/10 p-2 shadow-lift backdrop-blur">
      <div className="overflow-hidden rounded-[1.55rem] border border-border bg-background">
        <div className="flex items-center justify-between border-b border-border bg-white px-4 py-3">
          <div>
            <p className="text-xs font-bold text-muted-foreground">لوحة اليوم</p>
            <h3 className="text-lg font-extrabold text-foreground">مطعم إيوان</h3>
          </div>
          <Badge tone="warning">3 تنبيهات</Badge>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-[0.75fr_1.25fr]">
          <div className="space-y-3">
            {cards.map(({ label, value, icon: Icon, variant }) => (
              <div
                key={label}
                className={
                  variant === "dark"
                    ? "rounded-3xl bg-secondary p-4 text-white"
                    : variant === "primary"
                      ? "rounded-3xl bg-primary p-4 text-white"
                      : variant === "light"
                        ? "rounded-3xl bg-primary-light p-4 text-foreground"
                        : "rounded-3xl border border-border bg-white p-4 text-foreground"
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold opacity-70">{label}</p>
                    <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col rounded-3xl border border-border bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-muted-foreground">الأداء الأسبوعي</p>
                <p className="text-xl font-extrabold text-foreground">مبيعات · تكلفة · مخزون</p>
              </div>
              <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-extrabold text-primary">حي</span>
            </div>
            <div className="flex min-h-52 flex-1 items-end gap-2">
              {[45, 66, 48, 82, 62, 91, 74, 58, 86].map((height, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-full"
                  style={{
                    height: `${height}%`,
                    background: ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"][index % 4],
                  }}
                />
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-warning/25 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-sm font-bold text-warning">
                <AlertTriangle className="h-4 w-4" />
                سعر الدجاج ارتفع 18% عن آخر شراء.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}