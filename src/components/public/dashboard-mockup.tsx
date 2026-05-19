import { AlertTriangle, BarChart3, Boxes, Megaphone, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function DashboardMockup() {
  const cards = [
    { label: "قيمة المخزون", value: "₪42,800", icon: Boxes },
    { label: "طلبات مفتوحة", value: "4", icon: ShoppingCart },
    { label: "تكلفة الطعام", value: "29.8%", icon: BarChart3 },
    { label: "منشورات اليوم", value: "2", icon: Megaphone },
  ];

  return (
    <div className="rounded-lg border border-teal-900/10 bg-white p-3 shadow-2xl shadow-teal-900/10">
      <div className="rounded-lg border border-border bg-slate-50 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">لوحة اليوم</p>
            <h3 className="text-xl font-bold">مطعم إيوان</h3>
          </div>
          <Badge tone="warning">3 تنبيهات</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-lg border bg-white p-4">
              <Icon className="mb-3 h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            سعر الدجاج ارتفع 18% عن آخر شراء.
          </div>
          <div className="flex h-28 items-end gap-2">
            {[45, 66, 48, 82, 62, 91, 74].map((height, index) => (
              <div key={index} className="flex-1 rounded-t bg-primary/80" style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
