"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExternalRateQuote } from "@/types/pricing";

export interface MarketRateRefreshPayload {
  origin: string;
  destination: string;
  freight_mode?: string;
  equipment_type?: string | null;
  load_type?: string | null;
  weight_lbs?: number | null;
  nmfc_class?: string | null;
  rfq_id?: string | null;
}

// Persisted external market-rate quotes for the current workspace.
export function useMarketRates() {
  return useQuery<ExternalRateQuote[]>({
    queryKey: ["rates", "market"],
    queryFn: async () => {
      const res = await fetch("/api/rates/market");
      if (!res.ok) throw new Error("Failed to fetch market rates");
      return res.json();
    },
    refetchInterval: 600_000,
  });
}

// Trigger a fresh aggregation for a lane via the Modal endpoint, then refetch.
export function useRefreshMarketRates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: MarketRateRefreshPayload) => {
      const res = await fetch("/api/rates/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let message = "Failed to refresh market rates";
        try {
          const payloadJson = (await res.json()) as { error?: string };
          message = payloadJson.error || message;
        } catch {
          // keep fallback message
        }
        throw new Error(message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rates", "market"] });
    },
  });
}
