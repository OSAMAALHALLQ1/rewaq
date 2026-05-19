"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MobileButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "full";
  icon?: ReactNode;
  iconPosition?: "start" | "end";
  loading?: boolean;
  children: ReactNode;
}

/**
 * Mobile-optimized button
 * Larger touch targets (min 44x44px), better spacing
 */
export function MobileButton({
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "start",
  loading,
  children,
  className,
  disabled,
  ...props
}: MobileButtonProps) {
  const baseStyles = "font-semibold transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap";

  const variantStyles = {
    primary: "bg-primary text-white hover:bg-blue-700 focus:ring-primary",
    secondary: "bg-secondary text-secondary-foreground hover:bg-slate-200 focus:ring-secondary",
    outline: "border-2 border-input text-slate-900 hover:bg-slate-50 focus:ring-primary",
    ghost: "text-slate-900 hover:bg-slate-100 focus:ring-primary",
    danger: "bg-destructive text-white hover:bg-red-700 focus:ring-destructive",
  };

  const sizeStyles = {
    sm: "h-9 md:h-10 px-3 md:px-4 text-xs md:text-sm",
    md: "h-10 md:h-11 px-4 md:px-6 text-sm md:text-base",
    lg: "h-12 md:h-14 px-6 md:px-8 text-base md:text-lg",
    full: "w-full h-11 md:h-12 px-4 md:px-6 text-sm md:text-base",
  };

  return (
    <button
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) && "opacity-50 cursor-not-allowed",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <div className="h-4 w-4 md:h-5 md:w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          جاري...
        </>
      ) : (
        <>
          {icon && iconPosition === "start" && icon}
          {children}
          {icon && iconPosition === "end" && icon}
        </>
      )}
    </button>
  );
}

/**
 * Mobile button group
 * Stack buttons vertically on mobile, horizontally on desktop
 */
export function MobileButtonGroup({
  children,
  orientation = "vertical",
  className,
}: {
  children: ReactNode;
  orientation?: "vertical" | "horizontal";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 md:gap-3",
        orientation === "vertical" ? "flex-col md:flex-row" : "flex-row",
        className
      )}
    >
      {children}
    </div>
  );
}

interface MobileSegmentedControlProps {
  options: Array<{
    value: string;
    label: string;
    icon?: ReactNode;
  }>;
  value: string;
  onChange: (value: string) => void;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Mobile segmented control (tab-like)
 * Better for mobile than traditional tabs
 */
export function MobileSegmentedControl({
  options,
  value,
  onChange,
  fullWidth = true,
  size = "md",
}: MobileSegmentedControlProps) {
  const sizeClasses = {
    sm: "text-xs md:text-sm px-2 md:px-3 py-1 md:py-2",
    md: "text-sm md:text-base px-3 md:px-4 py-2 md:py-3",
    lg: "text-base md:text-lg px-4 md:px-6 py-3 md:py-4",
  };

  return (
    <div
      className={cn(
        "inline-flex gap-1 md:gap-2 p-1 md:p-2 bg-slate-100 rounded-lg",
        fullWidth && "w-full"
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded-md transition-all font-semibold",
            sizeClasses[size],
            value === option.value
              ? "bg-white text-primary shadow-sm"
              : "text-muted-foreground hover:text-slate-900"
          )}
        >
          {option.icon && <span className="text-lg">{option.icon}</span>}
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface MobileActionButtonProps extends MobileButtonProps {
  label?: string;
  badge?: number;
}

/**
 * Mobile action button for quick actions
 * Circular or pill-shaped with optional badge
 */
export function MobileActionButton({
  icon,
  label,
  badge,
  className,
  ...props
}: MobileActionButtonProps) {
  return (
    <div className="relative inline-flex">
      <MobileButton
        variant="primary"
        size="lg"
        icon={icon}
        className={cn("rounded-full p-0 h-12 w-12 md:h-14 md:w-14", label && "rounded-full", className)}
        {...props}
      >
        {label && <span className="text-xs md:text-sm font-semibold">{label}</span>}
      </MobileButton>

      {badge !== undefined && badge > 0 && (
        <div className="absolute -top-1 -end-1 bg-red-500 text-white rounded-full h-5 w-5 md:h-6 md:w-6 flex items-center justify-center text-xs md:text-sm font-bold">
          {badge > 99 ? "99+" : badge}
        </div>
      )}
    </div>
  );
}

/**
 * Mobile floating action button (FAB)
 * Primary action button at bottom of mobile screen
 */
export function MobileFloatingActionButton({
  icon,
  onClick,
  label,
  badge,
}: {
  icon: ReactNode;
  onClick?: () => void;
  label?: string;
  badge?: number;
}) {
  return (
    <div className="fixed bottom-20 md:bottom-6 end-4 md:end-6 z-30">
      <div className="relative inline-flex">
        <button
          onClick={onClick}
          className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-primary text-white shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center text-2xl md:text-3xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
        >
          {icon}
        </button>

        {badge !== undefined && badge > 0 && (
          <div className="absolute -top-2 -end-2 bg-red-500 text-white rounded-full h-6 w-6 md:h-7 md:w-7 flex items-center justify-center text-xs md:text-sm font-bold">
            {badge > 99 ? "99+" : badge}
          </div>
        )}
      </div>

      {label && (
        <p className="text-xs md:text-sm font-semibold text-center mt-2 text-slate-700">
          {label}
        </p>
      )}
    </div>
  );
}
