"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ExchangeRate } from "@/types/rfq";

export function useExchangeRates() {
  return useQuery<ExchangeRate[]>({
    queryKey: ["exchange-rates"],
    queryFn: async () => {
      const res = await fetch("/api/settings/exchange-rates");
      if (!res.ok) throw new Error("Failed to fetch exchange rates");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useCreateExchangeRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { rate: number; from_currency?: string; to_currency?: string; effective_date?: string }) => {
      const res = await fetch("/api/settings/exchange-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create exchange rate");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
    },
  });
}
