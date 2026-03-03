"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRFQNotes, useCreateRFQNote } from "@/hooks/use-rfq-notes";
import { formatDate } from "@/lib/utils";
import { MessageSquare, Send, Loader2 } from "lucide-react";

interface NotesSectionProps {
  rfqId: string;
}

export function NotesSection({ rfqId }: NotesSectionProps) {
  const { data: notes, isLoading } = useRFQNotes(rfqId);
  const createNote = useCreateRFQNote(rfqId);
  const [content, setContent] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    try {
      await createNote.mutateAsync(trimmed);
      setContent("");
    } catch {
      // Error is handled by the mutation's onError
    }
  };

  return (
    <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
      <CardHeader className="pb-3 px-6 pt-6">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-lg font-bold tracking-tight">Notes</CardTitle>
          {notes && notes.length > 0 && (
            <span className="text-xs text-muted-foreground">({notes.length})</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a note..."
            rows={2}
            maxLength={5000}
            className="flex-1 resize-none rounded-xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/20 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!content.trim() || createNote.isPending}
            className="h-auto rounded-xl self-end"
          >
            {createNote.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-12 rounded-xl bg-muted/30 animate-pulse" />
            <div className="h-12 rounded-xl bg-muted/30 animate-pulse" />
          </div>
        ) : notes && notes.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {notes.map((note) => (
              <div
                key={note.id}
                className="rounded-xl border border-white/10 dark:border-white/5 bg-white/30 dark:bg-black/10 px-3 py-2"
              >
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(note.created_at)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            No notes yet
          </p>
        )}
      </CardContent>
    </Card>
  );
}
