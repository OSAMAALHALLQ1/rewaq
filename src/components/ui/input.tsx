import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      suppressHydrationWarning
      className={cn(
        "focus-ring flex h-11 w-full rounded-2xl border border-input bg-card px-4 py-2 text-sm text-foreground placeholder:text-[var(--input-placeholder)] hover:border-[var(--input-border-hover)] focus:border-primary disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-100",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
