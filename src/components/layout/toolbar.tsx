"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * شريط الأدوات (Toolbar) — متطابق مع مفهوم Single Canvas.
 * يحوي البحث، الشرائح المجزّأة (Segmented)، والرُقاق (Chips).
 */
export function Toolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-2.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ToolbarSearch({
  placeholder = "بحث...",
  value,
  onChange,
  icon,
  className,
}: {
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-secondary)] px-3",
        className,
      )}
    >
      {icon ?? <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
      />
    </div>
  );
}

export function Chip({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-semibold transition-colors",
        active
          ? "border-[var(--brand-600)] bg-[var(--brand-50)] text-[var(--brand-700)]"
          : "border-[var(--border-default)] bg-[var(--surface-primary)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ToolbarSpacer() {
  return <div className="flex-1" />;
}

export function Segmented({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: string; label: React.ReactNode }>;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex rounded-xl bg-[var(--surface-tertiary)] p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-[11px] transition-colors",
            value === o.value
              ? "bg-[var(--surface-primary)] font-bold text-[var(--text-primary)] shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
