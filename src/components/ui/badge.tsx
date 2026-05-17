import * as React from "react";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/types/domain";

const tones: Record<StatusTone, string> = {
  default: "border-teal-200 bg-teal-50 text-teal-700",
  success: "border-green-200 bg-green-50 text-green-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  muted: "border-slate-200 bg-slate-100 text-slate-600",
};

export function Badge({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
