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
  default: "bg-primary text-primary-foreground shadow-sm shadow-primary/15 hover:bg-blue-800",
  secondary: "bg-secondary text-secondary-foreground hover:bg-slate-900",
  outline: "border border-secondary/20 bg-white text-foreground hover:border-primary hover:bg-primary-light",
  ghost: "text-foreground hover:bg-muted",
  destructive: "bg-destructive text-destructive-foreground hover:bg-red-700",
  light: "bg-primary-light text-primary-light-foreground hover:bg-blue-100",
  arrow: "border border-dashed border-secondary/40 bg-white text-foreground hover:border-primary hover:bg-primary-light",
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
