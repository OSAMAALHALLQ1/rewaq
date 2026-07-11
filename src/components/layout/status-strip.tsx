"use client";

import { useState } from "react";
import { CheckCircle2, Printer, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusStripItem = {
  kind?: "ok" | "warn" | "info";
  label: React.ReactNode;
};

/**
 * شريط الحالة العلوي (Status Strip) — متطابق مع مفهوم Single Canvas.
 * يعرض مؤشرات لحظية (حالة النظام، الأجهزة، آخر مزامنة) مع زر إغلاق.
 */
export function StatusStrip({
  items,
  onClose,
  className,
}: {
  items: StatusStripItem[];
  onClose?: () => void;
  className?: string;
}) {
  const [closed, setClosed] = useState(false);
  if (closed) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-primary)] px-6 py-2 text-[11px] text-[var(--text-secondary)]",
        className,
      )}
    >
      {items.map((it, i) => (
        <div key={i} className={cn("flex items-center gap-1.5", it.kind === "ok" && "text-[var(--success)]")}>
          {it.kind === "ok" && <CheckCircle2 className="h-3.5 w-3.5" />}
          {it.kind === "warn" && <Printer className="h-3.5 w-3.5 text-[var(--warning)]" />}
          {it.kind === "info" && <RefreshCw className="h-3.5 w-3.5 text-[var(--info)]" />}
          <span>{it.label}</span>
        </div>
      ))}
      {onClose && (
        <button
          type="button"
          onClick={() => {
            setClosed(true);
            onClose();
          }}
          className="ms-auto grid h-6 w-6 place-items-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          aria-label="إغلاق شريط الحالة"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
