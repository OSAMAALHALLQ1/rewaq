import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
};

export function EmptyState({ icon: Icon, title, description, actionLabel }: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="rounded-full bg-teal-50 p-3 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {actionLabel ? <Button size="sm">{actionLabel}</Button> : null}
      </CardContent>
    </Card>
  );
}
