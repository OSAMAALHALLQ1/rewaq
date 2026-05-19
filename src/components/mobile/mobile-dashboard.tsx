"use client";

import Link from "next/link";
import {
  BarChart3,
  Boxes,
  ChefHat,
  Clock3,
  ClipboardCheck,
  FileText,
  Megaphone,
  Receipt,
  ShoppingCart,
  Truck,
  Utensils,
  TrendingUp,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { MobileCard } from "@/components/mobile/mobile-cards";
import { MobileQuickAction } from "@/components/mobile/mobile-cards";
import { MobileListItem } from "@/components/mobile/mobile-cards";
import { MobileButton, MobileButtonGroup } from "@/components/mobile/mobile-buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
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
            <MobileButton
              asChild
              variant="outline"
              size="sm"
              className="flex-shrink-0"
            >
              <Link href={action.href}>{action.label}</Link>
            </MobileButton>
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

// Mobile Button component wrapper for UI library Button
import { ButtonHTMLAttributes, ReactNode as ReactNodeType } from "react";

interface MobileUIButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "full";
  children: ReactNodeType;
}

export function MobileButton({ 
  asChild, 
  variant, 
  size, 
  children, 
  ...props 
}: MobileUIButtonProps & { asChild?: boolean }) {
  if (asChild) {
    return children;
  }

  // Fallback to standard Button for desktop
  return (
    <button className="px-3 py-2 rounded-lg text-sm font-semibold" {...props}>
      {children}
    </button>
  );
}
