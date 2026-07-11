"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DrawerSize = "sm" | "md" | "lg" | "xl";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** شريط أزرار ثابت أسفل اللوحة (حفظ / إلغاء ...) */
  footer?: React.ReactNode;
  /** start = الحافة اليمنى (بجوار القائمة الجانبية)، end = الحافة اليسرى */
  side?: "start" | "end";
  size?: DrawerSize;
  className?: string;
};

const SIZE_CLASSES: Record<DrawerSize, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

/**
 * لوحة جانبية منزلقة (Slide-Over) — أساس سير العمل بدون تنقّل بين الصفحات.
 * التطبيق مثبّت على dir="rtl" لذا تُترجم start/end إلى يمين/يسار مباشرة.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = "end",
  size = "md",
  className,
}: DrawerProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // setTimeout وليس requestAnimationFrame: الأخير لا يعمل في التبويبات المخفية
      const timer = setTimeout(() => setVisible(true), 20);
      return () => clearTimeout(timer);
    }
    setVisible(false);
    const timer = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!mounted) return null;

  // dir="rtl": حافة start (يمين) تختبئ نحو اليمين، وحافة end (يسار) نحو اليسار
  const hiddenTransform = side === "start" ? "translate-x-full" : "-translate-x-full";

  return (
    <div className="fixed inset-0 z-50 print:hidden">
      <div
        className={cn(
          "absolute inset-0 bg-[var(--overlay-bg)] transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "absolute inset-y-0 flex w-full flex-col bg-[var(--drawer-bg)] shadow-lift outline-none transition-transform duration-200 ease-out",
          side === "start" ? "start-0 border-e" : "end-0 border-s",
          "border-[var(--drawer-border)]",
          SIZE_CLASSES[size],
          visible ? "translate-x-0" : hiddenTransform,
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="إغلاق">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/40 p-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
