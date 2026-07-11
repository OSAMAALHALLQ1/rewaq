"use client";

import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { openCommandPalette } from "@/components/layout/global-hotkeys";

export function SettingsShortcutsCard() {
  return (
    <Card id="shortcuts">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Keyboard className="h-5 w-5 text-primary" />
          مركز الاختصارات
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-muted-foreground">افتح مركز الأوامر السريع للانتقال أو بدء إجراء جديد.</p>
        <Button onClick={() => openCommandPalette()} variant="outline" className="gap-2">
          فتح المركز
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold">Ctrl K</kbd>
        </Button>
      </CardContent>
    </Card>
  );
}
