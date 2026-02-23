"use client";

import { useQuery } from "@tanstack/react-query";

import type { DashboardSummary } from "@/types/dashboard-summary";

const DASHBOARD_SUMMARY_REFRESH_MS = 20_000;

async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const response = await fetch("/api/dashboard/summary");
  if (!response.ok) {
    throw new Error("Failed to fetch dashboard summary");
  }
  return response.json();
}

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary"],
    queryFn: fetchDashboardSummary,
    staleTime: DASHBOARD_SUMMARY_REFRESH_MS,
    refetchInterval: DASHBOARD_SUMMARY_REFRESH_MS,
  });
}
