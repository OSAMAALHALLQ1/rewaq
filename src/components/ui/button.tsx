import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground shadow-sm hover:bg-blue-700",
  secondary: "bg-secondary text-secondary-foreground hover:bg-blue-100",
  outline: "border border-border bg-white text-foreground hover:bg-slate-50",
  ghost: "text-foreground hover:bg-slate-100",
  destructive: "bg-destructive text-destructive-foreground hover:bg-red-700",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
  icon: "h-10 w-10 p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", type = "button", asChild = false, children, ...props }, ref) => {
    const classes = cn(
        "focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium transition disabled:pointer-events-none disabled:opacity-50",
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
