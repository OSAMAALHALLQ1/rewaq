"use client";

// صفحة معاينة مؤقتة للتحقق من مكوّنات البنية التحتية (تُحذف بعد الاعتماد)
import { useState } from "react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { CommandPalette } from "@/components/layout/command-palette";
import { GlobalHotkeys } from "@/components/layout/global-hotkeys";

export default function DevUiPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerStart, setDrawerStart] = useState(false);

  return (
    <div className="min-h-screen bg-background p-10">
      <GlobalHotkeys />
      <CommandPalette />
      <h1 className="mb-6 text-2xl font-extrabold">معاينة البنية التحتية للتجربة الموحدة</h1>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setDrawerOpen(true)}>فتح Drawer (يسار / end)</Button>
        <Button variant="outline" onClick={() => setDrawerStart(true)}>
          فتح Drawer (يمين / start)
        </Button>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        جرّب أيضاً: Ctrl+K للوحة الأوامر، Alt+N لإنشاء ذكي، Alt+P / Alt+I / Alt+S / Alt+D للتنقل.
      </p>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="فاتورة توريد جديدة"
        description="نموذج تجريبي للتحقق من الانزلاق والإغلاق"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={() => setDrawerOpen(false)}>حفظ</Button>
          </>
        }
      >
        <p className="text-sm leading-7">
          محتوى تجريبي داخل اللوحة الجانبية. يجب أن تنزلق من اليسار (حافة end في RTL)
          وتُغلق بـ Esc أو بالنقر على الخلفية.
        </p>
      </Drawer>

      <Drawer
        open={drawerStart}
        onClose={() => setDrawerStart(false)}
        title="تفاصيل مورد"
        side="start"
        size="md"
      >
        <p className="text-sm leading-7">لوحة من جهة اليمين (start).</p>
      </Drawer>
    </div>
  );
}
