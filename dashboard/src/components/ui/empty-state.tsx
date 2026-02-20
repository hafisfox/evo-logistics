import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({ title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      <Inbox className="h-10 w-10 text-muted-foreground/50 mb-3" />
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground/70">{description}</p>
      )}
    </div>
  );
}
