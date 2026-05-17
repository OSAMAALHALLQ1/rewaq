import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "ILS") {
  return new Intl.NumberFormat("ar-PS", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("ar-PS", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value / 100);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-PS").format(value);
}

export function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
