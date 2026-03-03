"use client";

import { useQuery } from "@tanstack/react-query";
import type { ActivityLog } from "@/types/rfq";

export function useActivityLog(rfqId: string) {
  return useQuery<ActivityLog[]>({
    queryKey: ["rfq-activity", rfqId],
    queryFn: async () => {
      const res = await fetch(`/api/rfqs/${rfqId}/activity`);
      if (!res.ok) throw new Error("Failed to fetch activity log");
      return res.json();
    },
    enabled: !!rfqId,
    refetchInterval: 30_000,
  });
}
