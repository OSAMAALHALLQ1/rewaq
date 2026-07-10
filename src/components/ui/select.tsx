import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      suppressHydrationWarning
      className={cn(
        "focus-ring h-11 w-full rounded-full border border-input bg-card px-4 py-2 text-sm text-foreground hover:border-[var(--input-border-hover)] focus:border-primary disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-100",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);

Select.displayName = "Select";
