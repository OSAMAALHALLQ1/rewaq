"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <h2 className="text-xl font-bold">تعذر تحميل الصفحة</h2>
        <p className="max-w-xl text-sm leading-7 text-muted-foreground">{error.message}</p>
        <Button onClick={reset}>حاول مرة أخرى</Button>
      </CardContent>
    </Card>
  );
}
