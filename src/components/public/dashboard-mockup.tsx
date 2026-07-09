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
    <div className="rounded-[2rem] border border-white/15 bg-white/10 p-3 shadow-lift backdrop-blur">
      <div className="rounded-[1.5rem] border border-border bg-background p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-muted-foreground">لوحة اليوم</p>
            <h3 className="text-xl font-extrabold">مطعم إيوان</h3>
          </div>
          <Badge tone="warning">3 تنبيهات</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
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
              <Icon className="mb-3 h-5 w-5" />
              <p className="text-sm opacity-75">{label}</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-3xl border border-border bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-warning">
            <AlertTriangle className="h-4 w-4" />
            سعر الدجاج ارتفع 18% عن آخر شراء.
          </div>
          <div className="flex h-28 items-end gap-2">
            {[45, 66, 48, 82, 62, 91, 74].map((height, index) => (
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
        </div>
      </div>
    </div>
  );
}