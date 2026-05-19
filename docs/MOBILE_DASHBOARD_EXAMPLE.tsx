/**
 * Mobile-Optimized Dashboard Page Example
 * Shows how to implement the mobile design system on the main dashboard
 * 
 * Features:
 * - Responsive layout (1 col on mobile → 4 cols on desktop)
 * - Touch-friendly quick actions
 * - Mobile-optimized metrics cards
 * - Card-based list views instead of tables
 * - Accessible and performant
 */

"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  ChefHat,
  ClipboardCheck,
  Clock3,
  Coffee,
  FileText,
  Megaphone,
  Package,
  Receipt,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingUp,
  Truck,
  Utensils,
  WalletCards,
} from "lucide-react";

import { MobileDashboardLayout, MobileDashboardSection, MobileDashboardGrid } from "@/components/mobile/mobile-dashboard";
import { MobileQuickAction, MobileCard, MobileListItem, MobileMetricCard } from "@/components/mobile/mobile-cards";
import { MobileButton, MobileSegmentedControl } from "@/components/mobile/mobile-buttons";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getDashboardData } from "@/server/queries/app";
import type { StatusTone } from "@/types/domain";

/**
 * Main Dashboard Page - Mobile Responsive
 */
export default async function DashboardPage() {
  const data = await getDashboardData();
  const [status, setStatus] = useState("overview");

  return (
    <MobileDashboardLayout>
      {/* ============================================================================
          SECTION 1: QUICK ACTIONS
          Prominent call-to-action items for most common tasks
          ========================================================================= */}
      <MobileDashboardSection 
        title="Quick Actions"
        description="Start your workflow"
      >
        <MobileDashboardGrid columns="2">
          <MobileQuickAction
            title="New Invoice"
            description="Quick sale"
            icon={<Receipt className="h-6 w-6" />}
            href="/dashboard/customer-invoices/new"
            variant="primary"
          />
          <MobileQuickAction
            title="Purchase Order"
            description="New order"
            icon={<ShoppingCart className="h-6 w-6" />}
            href="/dashboard/purchase-orders"
            variant="warning"
          />
          <MobileQuickAction
            title="Quick Count"
            description="Check stock"
            icon={<ClipboardCheck className="h-6 w-6" />}
            href="/dashboard/stock-counts"
            variant="success"
          />
          <MobileQuickAction
            title="New Post"
            description="Marketing"
            icon={<Megaphone className="h-6 w-6" />}
            href="/dashboard/marketing/create"
            variant="danger"
          />
        </MobileDashboardGrid>
      </MobileDashboardSection>

      {/* ============================================================================
          SECTION 2: KEY METRICS
          High-level KPIs with trend indicators
          ========================================================================= */}
      <MobileDashboardSection 
        title="Performance Overview"
        action={{ label: "Detailed Reports", href: "/dashboard/reports" }}
      >
        <MobileDashboardGrid columns="auto">
          <MobileMetricCard
            title="Total Sales"
            value={formatCurrency(data.totalSales)}
            trend="up"
            trendValue={`+${data.salesTrend}%`}
            description="This month"
            variant="success"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <MobileMetricCard
            title="Inventory Value"
            value={formatCurrency(data.inventoryValue)}
            trend="down"
            trendValue={`${data.inventoryTrend}%`}
            description="Current stock"
            variant="info"
            icon={<Boxes className="h-5 w-5" />}
          />
          <MobileMetricCard
            title="Average Cost %"
            value={formatPercent(data.foodCostPercent)}
            trend={data.foodCostTrend > 0 ? "up" : "down"}
            trendValue={`${Math.abs(data.foodCostTrend)}%`}
            description="Food cost ratio"
            variant={data.foodCostPercent > 35 ? "warning" : "default"}
            icon={<ChefHat className="h-5 w-5" />}
          />
          <MobileMetricCard
            title="Pending Orders"
            value={data.pendingOrders}
            description="Awaiting approval"
            variant="warning"
            icon={<Clock3 className="h-5 w-5" />}
          />
        </MobileDashboardGrid>
      </MobileDashboardSection>

      {/* ============================================================================
          SECTION 3: WORK AREAS
          Main functional areas of the system
          ========================================================================= */}
      <MobileDashboardSection title="Work Areas">
        <div className="space-y-2">
          {[
            {
              title: "Operations",
              description: "Inventory, counts, waste & transfers",
              href: "/dashboard/inventory",
              icon: <Boxes className="h-5 w-5" />,
            },
            {
              title: "Purchasing",
              description: "Suppliers, orders & invoices",
              href: "/dashboard/purchase-orders",
              icon: <Truck className="h-5 w-5" />,
            },
            {
              title: "Sales",
              description: "Quick sales, orders & customers",
              href: "/dashboard/customer-invoices/new",
              icon: <Receipt className="h-5 w-5" />,
            },
            {
              title: "Menu",
              description: "Recipes, food cost & items",
              href: "/dashboard/recipes",
              icon: <Utensils className="h-5 w-5" />,
            },
            {
              title: "Marketing",
              description: "Posts & promotional calendar",
              href: "/dashboard/marketing",
              icon: <Megaphone className="h-5 w-5" />,
            },
            {
              title: "Reports",
              description: "Analytics & insights",
              href: "/dashboard/reports",
              icon: <BarChart3 className="h-5 w-5" />,
            },
          ].map((area) => (
            <MobileListItem
              key={area.href}
              title={area.title}
              description={area.description}
              icon={area.icon}
              href={area.href}
            />
          ))}
        </div>
      </MobileDashboardSection>

      {/* ============================================================================
          SECTION 4: RECENT ACTIVITY
          Recent transactions and changes
          ========================================================================= */}
      <MobileDashboardSection 
        title="Recent Activity"
        action={{ label: "All Activity", href: "/dashboard/system-logs" }}
      >
        <MobileCard title="Latest Transactions">
          <div className="space-y-2">
            {data.recentTransactions?.map((tx, idx) => (
              <MobileListItem
                key={idx}
                title={tx.description}
                subtitle={tx.user}
                badge={formatCurrency(tx.amount)}
                badgeVariant={tx.type === "sale" ? "success" : "warning"}
                divider={idx < data.recentTransactions.length - 1}
              />
            ))}
          </div>
        </MobileCard>
      </MobileDashboardSection>

      {/* ============================================================================
          SECTION 5: ALERTS & NOTIFICATIONS
          Important notices and actions needed
          ========================================================================= */}
      {(data.alerts?.length ?? 0) > 0 && (
        <MobileDashboardSection title="Alerts & Notices">
          <div className="space-y-2">
            {data.alerts?.map((alert, idx) => (
              <div
                key={idx}
                className={`rounded-lg border-l-4 p-4 ${
                  alert.severity === "error"
                    ? "border-red-500 bg-red-50"
                    : alert.severity === "warning"
                    ? "border-orange-500 bg-orange-50"
                    : "border-blue-500 bg-blue-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className={`h-5 w-5 flex-shrink-0 ${
                      alert.severity === "error"
                        ? "text-red-600"
                        : alert.severity === "warning"
                        ? "text-orange-600"
                        : "text-blue-600"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-900">{alert.title}</h4>
                    <p className="text-sm text-slate-700 mt-1">{alert.message}</p>
                    {alert.action && (
                      <MobileButton
                        asChild
                        variant="outline"
                        size="sm"
                        className="mt-3"
                      >
                        <Link href={alert.action.href}>
                          {alert.action.label}
                        </Link>
                      </MobileButton>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </MobileDashboardSection>
      )}

      {/* ============================================================================
          SECTION 6: INSIGHTS & RECOMMENDATIONS
          Data-driven suggestions
          ========================================================================= */}
      <MobileDashboardSection title="Insights">
        <div className="space-y-3">
          {[
            {
              icon: "📈",
              title: "High Sales This Week",
              description: "Sales are up 23% compared to last week",
              action: "View Details",
              href: "/dashboard/reports",
            },
            {
              icon: "⚠️",
              title: "Low Stock Alert",
              description: "5 items are below minimum quantity",
              action: "Reorder Now",
              href: "/dashboard/inventory",
            },
            {
              icon: "💡",
              title: "Optimize Menu",
              description: "Some items have low profit margins",
              action: "Review Menu",
              href: "/dashboard/recipes",
            },
          ].map((insight, idx) => (
            <MobileCard key={idx}>
              <div className="flex items-start gap-3">
                <div className="text-2xl">{insight.icon}</div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-900">{insight.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {insight.description}
                  </p>
                  <MobileButton
                    asChild
                    variant="outline"
                    size="sm"
                    className="mt-3"
                  >
                    <Link href={insight.href}>{insight.action}</Link>
                  </MobileButton>
                </div>
              </div>
            </MobileCard>
          ))}
        </div>
      </MobileDashboardSection>
    </MobileDashboardLayout>
  );
}

import { useState } from "react";
