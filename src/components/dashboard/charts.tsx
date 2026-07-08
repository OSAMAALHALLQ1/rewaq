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

const colors = ["#2563eb", "#0ea5e9", "#16a34a", "#f59e0b", "#8b5cf6", "#dc2626"];

function ChartFrame({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!mounted) {
    return <div className="h-72 min-h-72 rounded-lg bg-slate-50" />;
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
          <Tooltip formatter={(value) => [`₪${Number(value).toLocaleString("ar-PS")}`, "القيمة"]} />
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
              <stop offset="5%" stopColor="#0f766e" stopOpacity={0.32} />
              <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={48} />
          <Tooltip formatter={(value) => [`₪${Number(value).toLocaleString("ar-PS")}`, "مشتريات"]} />
          <Area type="monotone" dataKey="value" stroke="#0f766e" fill="url(#purchase)" strokeWidth={2} />
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
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={44} />
          <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "تكلفة الطعام"]} />
          <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} />
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
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.32} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={48} />
          <Tooltip
            formatter={(value, name) => [
              `${Number(value).toLocaleString("ar-EG")} ₪`,
              name === "revenue" ? "الإيرادات" : "المصروفات",
            ]}
          />
          <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="url(#revenue)" strokeWidth={2} />
          <Area type="monotone" dataKey="expenses" stroke="#f59e0b" fill="url(#expenses)" strokeWidth={2} />
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
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={48} />
          <Tooltip formatter={(value) => [`${Number(value).toLocaleString("ar-EG")} ₪`, "القيمة"]} />
          <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 8, 8]} />
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
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} />
          <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={150} />
          <Tooltip formatter={(value) => [`₪${Number(value).toLocaleString("ar-PS")}`, "هدر"]} />
          <Bar dataKey="value" fill="#dc2626" radius={[8, 8, 8, 8]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
