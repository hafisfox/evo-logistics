"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type WorkspaceMailbox = {
  email: string;
  status: "connected" | "disconnected" | "error" | string;
  token_expires_at: string | null;
  watch_expiration: string | null;
  last_error: string | null;
  updated_at: string;
};

interface MailboxOAuthStartResponse {
  authorizationUrl: string;
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

export function useStartWorkspaceMailboxOAuth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/workspaces/current/mailbox/oauth/start");
      if (!res.ok) throw new Error("Failed to start mailbox OAuth flow");
      return (await res.json()) as MailboxOAuthStartResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-mailbox"] });
    },
  });
}

export function useDisconnectWorkspaceMailbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/workspaces/current/mailbox/disconnect", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to disconnect mailbox");
      return (await res.json()) as { success: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-mailbox"] });
    },
  });
}
