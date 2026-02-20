"use client";

import { useQuery } from "@tanstack/react-query";
import type { Agent } from "@/types/agent";

export function useAgents() {
  return useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Failed to fetch agents");
      return res.json();
    },
    refetchInterval: 300_000,
  });
}
