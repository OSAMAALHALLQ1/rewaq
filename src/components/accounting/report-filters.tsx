"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Calendar, Filter, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** From/To period filter with quick presets (this month, last month, this year). */
export function PeriodFilter({ basePath, from, to, extraParams }: { basePath: string; from?: string; to?: string; extraParams?: Record<string, string> }) {
  const router = useRouter();
  const [fromValue, setFromValue] = React.useState(from || "");
  const [toValue, setToValue] = React.useState(to || "");

  const navigate = (nextFrom: string, nextTo: string) => {
    const params = new URLSearchParams(extraParams ?? {});
    if (nextFrom) params.set("from", nextFrom);
    if (nextTo) params.set("to", nextTo);
    router.push(`${basePath}?${params.toString()}`);
  };

  const applyPreset = (preset: "thisMonth" | "lastMonth" | "thisYear" | "last90") => {
    const today = localToday();
    let nextFrom = "";
    let nextTo = today;
    if (preset === "thisMonth") nextFrom = monthStart(today);
    if (preset === "lastMonth") {
      const prevEnd = shiftDate(monthStart(today), -1);
      nextFrom = monthStart(prevEnd);
      nextTo = prevEnd;
    }
    if (preset === "thisYear") nextFrom = `${today.slice(0, 4)}-01-01`;
    if (preset === "last90") nextFrom = shiftDate(today, -89);
    setFromValue(nextFrom);
    setToValue(nextTo);
    navigate(nextFrom, nextTo);
  };

  return (
    <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl p-5" dir="rtl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate(fromValue, toValue);
        }}
        className="grid gap-4 lg:grid-cols-[1fr_1fr_auto_auto] items-end"
      >
        <div className="space-y-2">
          <Label htmlFor="periodFrom" className="text-xs font-bold text-slate-500">من تاريخ</Label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="periodFrom"
              type="date"
              value={fromValue}
              onChange={(e) => setFromValue(e.target.value)}
              className="pe-3 ps-9 bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right font-mono"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="periodTo" className="text-xs font-bold text-slate-500">إلى تاريخ</Label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="periodTo"
              type="date"
              value={toValue}
              onChange={(e) => setToValue(e.target.value)}
              className="pe-3 ps-9 bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right font-mono"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-md shadow-teal-500/10 gap-1">
            <Filter className="h-4 w-4" />
            تصفية
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFromValue("");
              setToValue("");
              router.push(basePath);
            }}
            className="border-slate-200 hover:bg-slate-50 rounded-lg"
            title="إعادة تعيين"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("thisMonth")} className="rounded-lg border-slate-200 text-xs">هذا الشهر</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("lastMonth")} className="rounded-lg border-slate-200 text-xs">الشهر الماضي</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("thisYear")} className="rounded-lg border-slate-200 text-xs">هذه السنة</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => applyPreset("last90")} className="rounded-lg border-slate-200 text-xs">آخر 90 يوم</Button>
        </div>
      </form>
    </Card>
  );
}

/** Single "as of" date filter for balance-sheet style reports. */
export function AsOfFilter({ basePath, asOf }: { basePath: string; asOf?: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(asOf || localToday());

  return (
    <Card className="backdrop-blur-md bg-white/80 border border-slate-200/50 shadow-md rounded-2xl p-5" dir="rtl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push(value ? `${basePath}?asOf=${value}` : basePath);
        }}
        className="grid gap-4 sm:grid-cols-[1fr_auto_auto] items-end"
      >
        <div className="space-y-2">
          <Label htmlFor="asOfDate" className="text-xs font-bold text-slate-500">المركز المالي كما في تاريخ</Label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="asOfDate"
              type="date"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="pe-3 ps-9 bg-white border-slate-200 focus:border-teal-500 rounded-lg text-right font-mono"
            />
          </div>
        </div>
        <Button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-md shadow-teal-500/10 gap-1">
          <Filter className="h-4 w-4" />
          عرض
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setValue(localToday());
            router.push(basePath);
          }}
          className="border-slate-200 hover:bg-slate-50 rounded-lg"
          title="اليوم"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}
