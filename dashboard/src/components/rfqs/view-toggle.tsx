"use client";

import { Button } from "@/components/ui/button";
import { LayoutGrid, TableIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViewToggleProps {
  view: "table" | "kanban";
  onViewChange: (view: "table" | "kanban") => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center border rounded-md">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "rounded-r-none",
          view === "table" && "bg-muted"
        )}
        onClick={() => onViewChange("table")}
      >
        <TableIcon className="h-4 w-4 mr-1" />
        Table
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "rounded-l-none",
          view === "kanban" && "bg-muted"
        )}
        onClick={() => onViewChange("kanban")}
      >
        <LayoutGrid className="h-4 w-4 mr-1" />
        Kanban
      </Button>
    </div>
  );
}
