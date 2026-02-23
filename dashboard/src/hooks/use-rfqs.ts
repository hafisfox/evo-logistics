"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MasterRFQ } from "@/types/rfq";

interface UseRFQsOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
}

export function useRFQs(options: UseRFQsOptions = {}) {
  const { enabled = true, refetchInterval = 30_000 } = options;
  return useQuery<MasterRFQ[]>({
    queryKey: ["rfqs"],
    queryFn: async () => {
      const res = await fetch("/api/rfqs");
      if (!res.ok) throw new Error("Failed to fetch RFQs");
      return res.json();
    },
    enabled,
    refetchInterval: enabled ? refetchInterval : false,
  });
}

async function parseError(res: Response, fallback: string) {
  try {
    const payload = (await res.json()) as { error?: string; details?: string[] };
    if (payload.details?.length) {
      return `${payload.error || fallback}: ${payload.details.join(" ")}`;
    }
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

export function useDeleteRFQ() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rfqId: string) => {
      const res = await fetch(`/api/rfqs/${rfqId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to delete RFQ"));
      return res.json();
    },
    onSuccess: (_data, rfqId) => {
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
      queryClient.invalidateQueries({ queryKey: ["rfq", rfqId] });
    },
  });
}
