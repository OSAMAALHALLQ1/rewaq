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
};

export function MetricCard({ label, value, description, icon: Icon, tone = "default" }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
          <Badge tone={tone} className="mt-3">
            {description}
          </Badge>
        </div>
        <div className="rounded-lg bg-teal-50 p-3 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
