import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StatusTone } from "@/types/domain";

type MetricCardProps = {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone?: StatusTone;
  variant?: "light" | "dark" | "primary";
};

const metricStyles = {
  light: {
    card: "light" as const,
    label: "text-muted-foreground",
    icon: "bg-white text-primary",
    badge: "",
  },
  dark: {
    card: "dark" as const,
    label: "text-white/70",
    icon: "bg-white/10 text-accent",
    badge: "border-white/15 bg-white/10 text-white",
  },
  primary: {
    card: "primary" as const,
    label: "text-white/75",
    icon: "bg-white/15 text-white",
    badge: "border-white/20 bg-white/15 text-white",
  },
};

export function MetricCard({ label, value, description, icon: Icon, tone = "default", variant = "light" }: MetricCardProps) {
  const styles = metricStyles[variant];

  return (
    <Card variant={styles.card}>
      <CardContent className="flex items-start justify-between gap-4 p-6">
        <div>
          <p className={`text-sm font-bold ${styles.label}`}>{label}</p>
          <p className="mt-2 text-4xl font-extrabold tabular-nums tracking-tight">{value}</p>
          <Badge tone={tone} className={`mt-4 ${styles.badge}`}>
            {description}
          </Badge>
        </div>
        <div className={`rounded-full p-3 ${styles.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
