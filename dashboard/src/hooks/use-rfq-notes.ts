"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RFQNote } from "@/types/rfq";

export function useRFQNotes(rfqId: string) {
  return useQuery<RFQNote[]>({
    queryKey: ["rfq-notes", rfqId],
    queryFn: async () => {
      const res = await fetch(`/api/rfqs/${rfqId}/notes`);
      if (!res.ok) throw new Error("Failed to fetch notes");
      return res.json();
    },
    enabled: !!rfqId,
  });
}

export function useCreateRFQNote(rfqId: string) {
  const queryClient = useQueryClient();

  return useMutation<RFQNote, Error, string>({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/rfqs/${rfqId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create note");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfq-notes", rfqId] });
    },
  });
}
