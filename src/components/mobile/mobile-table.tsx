"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface MobileTableProps {
  columns: Array<{
    key: string;
    label: string;
    width?: string;
    align?: "start" | "center" | "end";
  }>;
  data: Array<Record<string, ReactNode>>;
  renderCell?: (key: string, value: ReactNode, row: Record<string, ReactNode>) => ReactNode;
  onRowClick?: (row: Record<string, ReactNode>) => void;
  emptyState?: ReactNode;
  loading?: boolean;
  className?: string;
}

/**
 * Mobile card-based table view
 * Shows one row per card instead of traditional table
 * Each card shows key information with expandable details
 */
export function MobileCardTable({
  columns,
  data,
  renderCell,
  onRowClick,
  emptyState,
  loading,
  className,
}: MobileTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-white p-4 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return emptyState || <div className="py-8 text-center text-muted-foreground">لا توجد بيانات</div>;
  }

  const primaryColumn = columns[0];
  const secondaryColumns = columns.slice(1, 3);
  const detailColumns = columns.slice(3);

  return (
    <div className={cn("space-y-3", className)}>
      {data.map((row, idx) => (
        <button
          key={idx}
          onClick={() => onRowClick?.(row)}
          className={cn(
            "w-full rounded-lg border border-border bg-white p-4 md:p-5 transition-all hover:shadow-md active:bg-slate-50 text-start",
            onRowClick && "cursor-pointer"
          )}
        >
          {/* Primary and Secondary columns */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm md:text-base font-bold text-slate-900 truncate">
                {renderCell?.(primaryColumn.key, row[primaryColumn.key], row) || row[primaryColumn.key]}
              </p>
              {secondaryColumns.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {secondaryColumns.map((col) => (
                    <div key={col.key} className="flex items-center gap-1 text-xs md:text-sm">
                      <span className="text-muted-foreground">{col.label}:</span>
                      <span className="font-semibold text-slate-700">
                        {renderCell?.(col.key, row[col.key], row) || row[col.key]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {onRowClick && (
              <div className="flex-shrink-0 text-muted-foreground">
                <ChevronRight className="h-5 w-5" />
              </div>
            )}
          </div>

          {/* Detail columns */}
          {detailColumns.length > 0 && (
            <div className="border-t border-slate-100 pt-3 flex flex-wrap gap-3">
              {detailColumns.map((col) => (
                <div key={col.key} className="flex-1 min-w-24">
                  <p className="text-xs text-muted-foreground truncate">{col.label}</p>
                  <p className="text-sm md:text-base font-semibold truncate">
                    {renderCell?.(col.key, row[col.key], row) || row[col.key]}
                  </p>
                </div>
              ))}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

interface MobileTableRowProps {
  primary: {
    label: string;
    value: ReactNode;
  };
  secondary?: Array<{
    label: string;
    value: ReactNode;
  }>;
  details?: Array<{
    label: string;
    value: ReactNode;
  }>;
  onClick?: () => void;
  badge?: {
    label: string;
    variant?: "default" | "success" | "warning" | "danger";
  };
}

const badgeVariants = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-orange-100 text-orange-700",
  danger: "bg-red-100 text-red-700",
};

/**
 * Individual mobile table row component
 * Can be used within a list or independently
 */
export function MobileTableRow({
  primary,
  secondary,
  details,
  onClick,
  badge,
}: MobileTableRowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border border-border bg-white p-4 md:p-5 transition-all hover:shadow-md active:bg-slate-50 text-start",
        onClick && "cursor-pointer"
      )}
    >
      {/* Header with primary value and badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs md:text-sm text-muted-foreground">{primary.label}</p>
          <p className="text-sm md:text-base font-bold text-slate-900 truncate">
            {primary.value}
          </p>
        </div>

        {badge && (
          <div
            className={cn(
              "flex-shrink-0 rounded-full px-2 md:px-3 py-1 text-xs md:text-sm font-semibold whitespace-nowrap",
              badgeVariants[badge.variant || "default"]
            )}
          >
            {badge.label}
          </div>
        )}
      </div>

      {/* Secondary information */}
      {secondary && secondary.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {secondary.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1 text-xs md:text-sm">
              <span className="text-muted-foreground">{item.label}:</span>
              <span className="font-semibold text-slate-700">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Details grid */}
      {details && details.length > 0 && (
        <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          {details.map((item, idx) => (
            <div key={idx}>
              <p className="text-xs text-muted-foreground truncate">{item.label}</p>
              <p className="text-sm md:text-base font-semibold truncate">{item.value}</p>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

/**
 * Mobile list view for tables
 * Renders list of MobileTableRow components
 */
export function MobileTableList({
  rows,
  emptyState,
  loading,
  className,
}: {
  rows: MobileTableRowProps[];
  emptyState?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-white p-4 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return emptyState || <div className="py-8 text-center text-muted-foreground">لا توجد بيانات</div>;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {rows.map((row, idx) => (
        <MobileTableRow key={idx} {...row} />
      ))}
    </div>
  );
}
