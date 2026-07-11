"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Download, Flame, PackageSearch, TrendingUp } from "lucide-react";
import { Toolbar, ToolbarSearch, Segmented, Chip, ToolbarSpacer } from "@/components/layout/toolbar";
import { Button } from "@/components/ui/button";

/**
 * شريط أدوات لوحة التشغيل — متطابق مع مفهوم Single Canvas.
 * يحتوي البحث السريع، الشريح الزمني، ورُقاق التصفية.
 */
export function DashboardToolbar() {
  const [range, setRange] = useState("month");
  const [filters, setFilters] = useState<{ low: boolean; due: boolean }>({
    low: false,
    due: false,
  });

  const toggle = (key: "low" | "due") =>
    setFilters((f) => ({ ...f, [key]: !f[key] }));

  return (
    <Toolbar className="mb-4">
      <ToolbarSearch placeholder="بحث سريع: صنف، فاتورة، مورد، عميل..." />
      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: "day", label: "يوم" },
          { value: "week", label: "أسبوع" },
          { value: "month", label: "شهر" },
        ]}
      />
      <Chip active={filters.low} onClick={() => toggle("low")}>
        <PackageSearch className="h-3.5 w-3.5" />
        منخفض
      </Chip>
      <Chip active={filters.due} onClick={() => toggle("due")}>
        <AlertTriangle className="h-3.5 w-3.5" />
        مستحق
      </Chip>
      <ToolbarSpacer />
      <Button variant="outline" size="sm">
        <Download className="h-4 w-4" />
        تصدير
      </Button>
    </Toolbar>
  );
}

/**
 * مركز التنبيهات الذكي — يحرك إجراءً واحدًا (مفهوم Single Canvas).
 */
export function SmartAlerts() {
  return (
    <div className="mb-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--warning)] text-white">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-[var(--warning-text)]">الدجاج قارب على النفاد</p>
          <p className="truncate text-[11px] text-[var(--text-secondary)]">بادر بالشراء من المورد المعتمد</p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href="/dashboard/invoices?new=1">شراء</Link>
        </Button>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-bg)] p-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--danger)] text-white">
          <Flame className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-[var(--danger-text)]">هدر مرتفع في المطبخ</p>
          <p className="truncate text-[11px] text-[var(--text-secondary)]">3% من الطاقة اليومية</p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href="/dashboard/waste">
            تفاصيل
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-[var(--success-border)] bg-[var(--success-bg)] p-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--success)] text-white">
          <TrendingUp className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-[var(--success-text)]">تكلفة الغذاء ضمن الهدف</p>
          <p className="truncate text-[11px] text-[var(--text-secondary)]">28% مقابل مستهدف 30%</p>
        </div>
      </div>
    </div>
  );
}
