"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STATUS_CONFIG } from "@/lib/constants";
import type { PipelineCount } from "@/types/analytics";

interface PipelineChartProps {
  data: PipelineCount[];
}

export function PipelineChart({ data }: PipelineChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card className="hover:shadow-md transition-all duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pipeline Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No data yet
          </p>
        ) : (
          <div className="space-y-3">
            {/* Stacked bar */}
            <div className="flex h-8 rounded-full overflow-hidden border border-muted/20">
              {data.map((d, i) => {
                const config = STATUS_CONFIG[d.status];
                const pct = (d.count / total) * 100;
                return (
                  <div
                    key={d.status}
                    className={cn(
                      "transition-all duration-300 hover:opacity-80 cursor-pointer",
                      i < data.length - 1 && "border-r-2 border-background"
                    )}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: config?.color || "#94a3b8",
                    }}
                    title={`${config?.label || d.status}: ${d.count}`}
                  />
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {data.map((d) => {
                const config = STATUS_CONFIG[d.status];
                return (
                  <div key={d.status} className="flex items-center gap-1.5">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: config?.color || "#94a3b8",
                      }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {config?.label || d.status}: {d.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
