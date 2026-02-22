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
    <Card className={cn("group rounded-3xl border-white/20 dark:border-white/5 bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.02)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(255,255,255,0.05)] hover:-translate-y-1 transition-all duration-500 cursor-default overflow-hidden", className)}>
      <CardContent className="p-5 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col flex-1 pl-4">
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground opacity-80 mt-1">
                {description}
              </p>
            )}
          </div>
          <div className="absolute top-5 md:top-6 right-5 md:right-6 h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 flex items-center justify-center border border-primary/10 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-inner">
            <Icon className="h-6 w-6 text-primary/80 group-hover:text-primary drop-shadow-sm transition-colors duration-300" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
