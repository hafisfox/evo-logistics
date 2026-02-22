"use client";

import { useQuery } from "@tanstack/react-query";

interface WorkspaceCurrentResponse {
  workspaceId: string;
  role: "owner" | "admin" | "member" | string;
  workspaceName?: string;
  workspaceSlug?: string;
}

export function useWorkspaceAccess() {
  const query = useQuery<WorkspaceCurrentResponse>({
    queryKey: ["workspace-current"],
    queryFn: async () => {
      const res = await fetch("/api/workspaces/current");
      if (!res.ok) throw new Error("Failed to fetch workspace access");
      return res.json();
    },
    staleTime: 300_000,
  });

  const role = query.data?.role;
  const canManage = role === "owner" || role === "admin";

  return {
    ...query,
    role,
    canManage,
  };
}
