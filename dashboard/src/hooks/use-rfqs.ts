"use client";

import { useQuery } from "@tanstack/react-query";
import type { MasterRFQ } from "@/types/rfq";

export function useRFQs() {
  return useQuery<MasterRFQ[]>({
    queryKey: ["rfqs"],
    queryFn: async () => {
      const res = await fetch("/api/rfqs");
      if (!res.ok) throw new Error("Failed to fetch RFQs");
      return res.json();
    },
    refetchInterval: 30_000,
  });
}
