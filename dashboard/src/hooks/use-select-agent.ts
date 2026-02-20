"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SelectAgentPayload, SelectAgentResponse } from "@/types/rfq";

export function useSelectAgent() {
  const queryClient = useQueryClient();

  return useMutation<SelectAgentResponse, Error, SelectAgentPayload>({
    mutationFn: async (payload) => {
      const res = await fetch(`/api/rfqs/${payload.rfq_id}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Selection failed: ${text}`);
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
      queryClient.invalidateQueries({ queryKey: ["rfq", variables.rfq_id] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}
