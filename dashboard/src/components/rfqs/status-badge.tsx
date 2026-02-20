"use client";

import { Badge } from "@/components/ui/badge";
import { STATUS_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    bgClass: "bg-gray-100",
    textClass: "text-gray-800",
  };

  return (
    <Badge
      variant="secondary"
      className={cn(config.bgClass, config.textClass, "font-medium", className)}
    >
      {config.label}
    </Badge>
  );
}
