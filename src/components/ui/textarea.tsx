import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      suppressHydrationWarning
      className={cn(
        "focus-ring min-h-28 w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-[var(--input-placeholder)] hover:border-[var(--input-border-hover)] focus:border-primary disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-100",
        className,
      )}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";
