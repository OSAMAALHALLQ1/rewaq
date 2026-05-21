"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface MobileDashboardLayoutProps {
  children: ReactNode;
}

/**
 * Mobile Dashboard Layout
 * Provides responsive layout optimized for different screen sizes
 * - Mobile (sm): Single column, bottom nav, card-based sections
 * - Tablet (md-lg): Two-column grid, some desktop elements
 * - Desktop (lg+): Full desktop layout with sidebar
 */
export function MobileDashboardLayout({ children }: MobileDashboardLayoutProps) {
  return (
    <div className="space-y-4 md:space-y-6 lg:space-y-8">
      {children}
    </div>
  );
}

interface MobileDashboardSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  action?: {
    label: string;
    href: string;
  };
}

/**
 * Dashboard section component
 * Consistent spacing and layout across sections
 */
export function MobileDashboardSection({
  title,
  description,
  children,
  action,
}: MobileDashboardSectionProps) {
  return (
    <div className="space-y-3">
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {title && (
              <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-slate-900">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm md:text-base text-muted-foreground mt-1">{description}</p>
            )}
          </div>

          {action && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex-shrink-0"
            >
              <Link href={action.href}>{action.label}</Link>
            </Button>
          )}
        </div>
      )}

      {children}
    </div>
  );
}

interface MobileDashboardGridProps {
  columns?: "auto" | "2" | "3" | "4";
  gap?: "sm" | "md" | "lg";
  children: ReactNode;
}

/**
 * Responsive grid for dashboard cards
 * Adapts column count based on screen size
 */
export function MobileDashboardGrid({
  columns = "auto",
  gap = "md",
  children,
}: MobileDashboardGridProps) {
  const columnClasses = {
    auto: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    "2": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2",
    "3": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    "4": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  const gapClasses = {
    sm: "gap-2 md:gap-3",
    md: "gap-3 md:gap-4",
    lg: "gap-4 md:gap-6",
  };

  return (
    <div className={`grid ${columnClasses[columns]} ${gapClasses[gap]}`}>
      {children}
    </div>
  );
}

