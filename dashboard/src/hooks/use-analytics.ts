"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardKPIs, PipelineCount, ActivityItem } from "@/types/analytics";

interface AnalyticsResponse {
  kpis: DashboardKPIs;
  pipeline: PipelineCount[];
  activity: ActivityItem[];
}

async function fetchAnalytics(): Promise<AnalyticsResponse> {
  const res = await fetch("/api/analytics");
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

export function useDashboardKPIs() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: fetchAnalytics,
    refetchInterval: 30_000,
    select: (data) => data.kpis,
  });
}

export function usePipelineCounts() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: fetchAnalytics,
    refetchInterval: 30_000,
    select: (data) => data.pipeline,
  });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: fetchAnalytics,
    refetchInterval: 30_000,
    select: (data) => data.activity,
  });
}
