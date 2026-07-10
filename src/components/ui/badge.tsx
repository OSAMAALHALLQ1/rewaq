import * as React from "react";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/types/domain";

const tones: Record<StatusTone, string> = {
  default: "border-primary-light bg-primary-light text-[var(--brand-700)]",
  success: "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-text)]",
  warning: "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)]",
  danger: "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]",
  muted: "border-[var(--border-subtle)] bg-muted text-muted-foreground",
};

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
