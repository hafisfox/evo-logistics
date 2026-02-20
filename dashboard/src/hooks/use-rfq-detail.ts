"use client";

import { useQuery } from "@tanstack/react-query";
import type { MasterRFQ, AgentQuote } from "@/types/rfq";

export function useRFQDetail(rfqId: string) {
  return useQuery<{ rfq: MasterRFQ; quotes: AgentQuote[] }>({
    queryKey: ["rfq", rfqId],
    queryFn: async () => {
      const res = await fetch(`/api/rfqs/${rfqId}`);
      if (!res.ok) throw new Error("Failed to fetch RFQ detail");
      return res.json();
    },
    refetchInterval: 10_000,
    enabled: !!rfqId,
  });
}

export function useRFQQuotes(rfqId: string) {
  return useQuery<AgentQuote[]>({
    queryKey: ["rfq-quotes", rfqId],
    queryFn: async () => {
      const res = await fetch(`/api/rfqs/${rfqId}/quotes`);
      if (!res.ok) throw new Error("Failed to fetch quotes");
      return res.json();
    },
    refetchInterval: 10_000,
    enabled: !!rfqId,
  });
}
