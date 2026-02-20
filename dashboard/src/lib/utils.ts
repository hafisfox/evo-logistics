import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseMultiValue(value: string | null | undefined): string[] {
  if (!value) return [];
  if (typeof value === "string" && value.includes("\n"))
    return value.split("\n").map((v) => v.trim());
  return [String(value)];
}

export function formatCurrency(
  amount: number | string | null,
  currency: "AED" | "USD" = "AED"
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (num == null || isNaN(num)) return "—";
  const symbol = currency === "AED" ? "AED" : "USD";
  return `${symbol} ${num.toLocaleString("en-US", {
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  })}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function formatRoute(pol: string, pod: string): string {
  const polFirst = parseMultiValue(pol)[0] || "—";
  const podFirst = parseMultiValue(pod)[0] || "—";
  return `${polFirst} → ${podFirst}`;
}

export function formatContainer(type: string, qty: string): string {
  const types = parseMultiValue(type);
  const qtys = parseMultiValue(qty);
  return types
    .map((t, i) => `${qtys[i] || qtys[0] || "1"}×${t}`)
    .join(", ");
}
