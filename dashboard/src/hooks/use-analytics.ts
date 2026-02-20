"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardKPIs, PipelineCount, ActivityItem } from "@/types/analytics";

export function useDashboardKPIs() {
  return useQuery<DashboardKPIs>({
    queryKey: ["analytics", "kpis"],
    queryFn: async () => {
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const data = await res.json();
      return data.kpis;
    },
    refetchInterval: 30_000,
  });
}

export function usePipelineCounts() {
  return useQuery<PipelineCount[]>({
    queryKey: ["analytics", "pipeline"],
    queryFn: async () => {
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const data = await res.json();
      return data.pipeline;
    },
    refetchInterval: 30_000,
  });
}

export function useRecentActivity() {
  return useQuery<ActivityItem[]>({
    queryKey: ["analytics", "activity"],
    queryFn: async () => {
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const data = await res.json();
      return data.activity;
    },
    refetchInterval: 30_000,
  });
}
