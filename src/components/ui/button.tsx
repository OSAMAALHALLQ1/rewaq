import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "light" | "arrow";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  default: "border border-primary bg-primary text-primary-foreground shadow-glow hover:bg-[var(--brand-700)] hover:shadow-glow-hover active:bg-[var(--brand-800)]",
  secondary: "border border-secondary bg-secondary text-secondary-foreground hover:bg-[var(--sidebar-hover)]",
  outline: "border border-input bg-card text-foreground hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]",
  ghost: "text-[var(--text-secondary)] hover:bg-muted hover:text-foreground",
  destructive: "border border-destructive bg-destructive text-destructive-foreground hover:bg-danger-700",
  light: "border border-primary-light bg-primary-light text-primary-light-foreground hover:bg-[var(--brand-100)]",
  arrow: "border border-dashed border-input bg-card text-foreground hover:border-primary hover:bg-primary-light",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-11 w-11 p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", type = "button", asChild = false, children, ...props }, ref) => {
    const classes = cn(
        "focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-bold transition disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      );

    if (asChild && React.isValidElement<{ className?: string }>(children)) {
      return React.cloneElement(children, {
        className: cn(classes, children.props.className),
      });
    }

    return (
      <button ref={ref} type={type} suppressHydrationWarning className={classes} {...props}>
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
