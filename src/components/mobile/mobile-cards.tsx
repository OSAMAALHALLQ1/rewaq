"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MobileMetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

/**
 * Mobile-optimized metric card
 * Displays KPIs with proper touch targets and responsive sizing
 */
export function MobileMetricCard({
  title,
  value,
  description,
  icon,
  trend,
  trendValue,
  variant = "default",
  className,
}: MobileMetricCardProps) {
  const variantStyles = {
    default: "bg-blue-50 border-blue-200",
    success: "bg-green-50 border-green-200",
    warning: "bg-orange-50 border-orange-200",
    danger: "bg-red-50 border-red-200",
    info: "bg-sky-50 border-sky-200",
  };

  const trendStyles = {
    up: "text-green-600",
    down: "text-red-600",
    neutral: "text-slate-600",
  };

  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-4 md:p-5 lg:p-6 transition-all hover:shadow-md",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs md:text-sm font-semibold text-muted-foreground truncate">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl md:text-3xl lg:text-4xl font-bold break-words">{value}</p>
            {trend && trendValue && (
              <span className={cn("text-xs md:text-sm font-semibold", trendStyles[trend])}>
                {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-2 text-xs md:text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        {icon && (
          <div className="ms-3 flex-shrink-0 text-slate-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

interface MobileQuickActionProps {
  title: string;
  description?: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  badge?: string;
  className?: string;
}

const actionVariants = {
  default: "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100",
  primary: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100",
  success: "bg-green-50 border-green-200 text-green-700 hover:bg-green-100",
  warning: "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100",
  danger: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100",
};

/**
 * Mobile quick action button
 * Large touch target with icon, title, and description
 */
export function MobileQuickAction({
  title,
  description,
  icon,
  href,
  onClick,
  variant = "default",
  badge,
  className,
}: MobileQuickActionProps) {
  const Component = href ? "a" : "button";

  const content = (
    <>
      <div className="mb-2 text-3xl md:text-4xl">{icon}</div>
      <p className="text-sm md:text-base font-semibold text-center">{title}</p>
      {description && (
        <p className="text-xs md:text-sm text-center opacity-75 mt-1">{description}</p>
      )}
      {badge && (
        <span className="absolute top-2 end-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
          {badge}
        </span>
      )}
    </>
  );

  return (
    <Component
      href={href}
      onClick={onClick}
      className={cn(
        "relative rounded-lg border-2 p-4 md:p-6 transition-all active:scale-95 hover:shadow-md flex flex-col items-center justify-center min-h-24 md:min-h-28",
        actionVariants[variant],
        className
      )}
    >
      {content}
    </Component>
  );
}

interface MobileCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Mobile-optimized card component
 * Proper padding and spacing for mobile readability
 */
export function MobileCard({
  title,
  description,
  children,
  footer,
  className,
}: MobileCardProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-white shadow-sm overflow-hidden", className)}>
      {(title || description) && (
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-border">
          {title && <h3 className="text-sm md:text-base font-semibold">{title}</h3>}
          {description && (
            <p className="text-xs md:text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      )}

      <div className="px-4 py-3 md:px-6 md:py-4">
        {children}
      </div>

      {footer && (
        <div className="px-4 py-3 md:px-6 md:py-4 border-t border-border bg-slate-50">
          {footer}
        </div>
      )}
    </div>
  );
}

interface MobileListItemProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon?: ReactNode;
  badge?: string | number;
  badgeVariant?: "default" | "primary" | "success" | "warning" | "danger";
  href?: string;
  onClick?: () => void;
  divider?: boolean;
  className?: string;
}

/**
 * Mobile-optimized list item
 * Touch-friendly spacing with proper hit targets
 */
export function MobileListItem({
  title,
  subtitle,
  description,
  icon,
  badge,
  badgeVariant = "default",
  href,
  onClick,
  divider = true,
  className,
}: MobileListItemProps) {
  const Component = href ? "a" : "button";

  const badgeVariantStyles = {
    default: "bg-slate-100 text-slate-700",
    primary: "bg-blue-100 text-blue-700",
    success: "bg-green-100 text-green-700",
    warning: "bg-orange-100 text-orange-700",
    danger: "bg-red-100 text-red-700",
  };

  return (
    <>
      <Component
        href={href}
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 md:gap-4 px-4 py-3 md:px-6 md:py-4 transition-colors active:bg-slate-50 hover:bg-slate-50 w-full text-start",
          className
        )}
      >
        {icon && <div className="flex-shrink-0 text-lg md:text-xl">{icon}</div>}

        <div className="flex-1 min-w-0">
          <p className="text-sm md:text-base font-semibold truncate">{title}</p>
          {subtitle && (
            <p className="text-xs md:text-sm text-muted-foreground truncate">{subtitle}</p>
          )}
          {description && (
            <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
          )}
        </div>

        {badge !== undefined && (
          <div className={cn("flex-shrink-0 rounded-full px-2 md:px-3 py-1 text-xs md:text-sm font-semibold whitespace-nowrap", badgeVariantStyles[badgeVariant])}>
            {badge}
          </div>
        )}
      </Component>

      {divider && <div className="border-b border-border" />}
    </>
  );
}
