"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type WorkspaceMailbox = {
  email: string;
  status: "connected" | "disconnected" | "error" | string;
  watch_expiration: string | null;
  last_error: string | null;
  updated_at: string;
};

interface MailboxPayload {
  email: string;
  status?: "connected" | "disconnected";
}

export function useWorkspaceMailbox() {
  return useQuery<WorkspaceMailbox | null>({
    queryKey: ["workspace-mailbox"],
    queryFn: async () => {
      const res = await fetch("/api/workspaces/current/mailbox");
      if (!res.ok) throw new Error("Failed to load mailbox settings");
      const payload = (await res.json()) as { mailbox: WorkspaceMailbox | null };
      return payload.mailbox ?? null;
    },
  });
}

export function useUpdateWorkspaceMailbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: MailboxPayload) => {
      const res = await fetch("/api/workspaces/current/mailbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update mailbox settings");
      return (await res.json()) as {
        success: boolean;
        mailbox: WorkspaceMailbox;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-mailbox"] });
    },
  });
}
