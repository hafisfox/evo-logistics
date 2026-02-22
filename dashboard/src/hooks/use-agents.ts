"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Agent } from "@/types/agent";

interface CreateAgentPayload {
  agent_name: string;
  email: string;
  status?: "active" | "inactive";
}

interface UpdateAgentPayload {
  current_agent_name: string;
  agent_name?: string;
  email?: string;
  status?: "active" | "inactive";
}

interface DeleteAgentPayload {
  agent_name: string;
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

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAgentPayload) => {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(await parseError(res, "Failed to create agent"));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateAgentPayload) => {
      const res = await fetch("/api/agents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(await parseError(res, "Failed to update agent"));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: DeleteAgentPayload) => {
      const res = await fetch("/api/agents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(await parseError(res, "Failed to delete agent"));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}
