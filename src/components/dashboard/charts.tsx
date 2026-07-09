"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReportPoint } from "@/types/domain";

const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const axisStyle = { fill: "var(--muted-foreground)", fontSize: 12 };
const gridColor = "rgba(91, 107, 133, 0.18)";
const roundedBarRadius: [number, number, number, number] = [999, 999, 999, 999];

type TooltipFormatter = (value: unknown, name?: string) => [string, string];

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ value?: unknown; name?: string; dataKey?: string }>;
  label?: string;
  formatter: TooltipFormatter;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl bg-secondary px-4 py-3 text-xs text-secondary-foreground shadow-lift">
      {label ? <p className="mb-2 font-extrabold text-accent">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((item) => {
          const [value, name] = formatter(item.value, item.dataKey ?? item.name);
          return (
            <p key={`${item.dataKey ?? item.name}-${value}`} className="flex items-center justify-between gap-4">
              <span className="text-white/70">{name}</span>
              <span className="font-extrabold tabular-nums">{value}</span>
            </p>
          );
        })}
      </div>
    </div>
  );
}

function ChartFrame({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!mounted) {
    return <div className="h-72 min-h-72 rounded-3xl bg-muted" />;
  }

  return <div className="h-72 min-h-72 w-full min-w-0">{children}</div>;
}

export function CategoryPieChart({ data }: { data: ReportPoint[] }) {
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie dataKey="value" data={data} innerRadius={58} outerRadius={88} paddingAngle={3}>
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip formatter={(value) => [`₪${Number(value).toLocaleString("ar-PS")}`, "القيمة"]} />} />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function PurchaseAreaChart({ data }: { data: ReportPoint[] }) {
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="purchase" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.28} />
              <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisStyle} />
          <YAxis tickLine={false} axisLine={false} width={48} tick={axisStyle} />
          <Tooltip content={<ChartTooltip formatter={(value) => [`₪${Number(value).toLocaleString("ar-PS")}`, "مشتريات"]} />} />
          <Area type="monotone" dataKey="value" stroke="var(--chart-2)" fill="url(#purchase)" strokeWidth={3} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function FoodCostLineChart({ data }: { data: ReportPoint[] }) {
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisStyle} />
          <YAxis tickLine={false} axisLine={false} width={44} tick={axisStyle} />
          <Tooltip content={<ChartTooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "تكلفة الطعام"]} />} />
          <Line type="monotone" dataKey="value" stroke="var(--chart-3)" strokeWidth={3} dot={{ r: 4, fill: "var(--chart-3)" }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function FinanceAreaChart({
  data,
}: {
  data: Array<{ label: string; revenue: number; expenses: number }>;
}) {
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-5)" stopOpacity={0.32} />
              <stop offset="95%" stopColor="var(--chart-5)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisStyle} />
          <YAxis tickLine={false} axisLine={false} width={48} tick={axisStyle} />
          <Tooltip
            content={<ChartTooltip formatter={(value, name) => [
              `${Number(value).toLocaleString("ar-EG")} ₪`,
              name === "revenue" ? "الإيرادات" : "المصروفات",
            ]} />}
          />
          <Area type="monotone" dataKey="revenue" stroke="var(--chart-2)" fill="url(#revenue)" strokeWidth={3} />
          <Area type="monotone" dataKey="expenses" stroke="var(--chart-5)" fill="url(#expenses)" strokeWidth={3} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function FinanceBarChart({ data }: { data: ReportPoint[] }) {
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" horizontal={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisStyle} />
          <YAxis tickLine={false} axisLine={false} width={48} tick={axisStyle} />
          <Tooltip content={<ChartTooltip formatter={(value) => [`${Number(value).toLocaleString("ar-EG")} ₪`, "القيمة"]} />} />
          <Bar dataKey="value" radius={roundedBarRadius} barSize={34}>
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function WasteBarChart({ data }: { data: ReportPoint[] }) {
  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tick={axisStyle} />
          <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={150} tick={axisStyle} />
          <Tooltip content={<ChartTooltip formatter={(value) => [`₪${Number(value).toLocaleString("ar-PS")}`, "هدر"]} />} />
          <Bar dataKey="value" radius={roundedBarRadius} barSize={26}>
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={colors[(index + 1) % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
