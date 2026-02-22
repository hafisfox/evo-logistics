"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  className?: string;
}

export function KPICard({
  title,
  value,
  icon: Icon,
  description,
  className,
}: KPICardProps) {
  return (
    <Card className={cn("group hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-default", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center border border-muted-foreground/10 group-hover:scale-110 transition-transform duration-300">
            <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
