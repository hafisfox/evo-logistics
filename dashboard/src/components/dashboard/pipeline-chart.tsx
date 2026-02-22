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
    <Card className="rounded-3xl border-white/20 dark:border-white/5 bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.02)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-500 overflow-hidden flex flex-col h-full">
      <CardHeader className="p-6 pb-4">
        <CardTitle className="text-lg font-semibold tracking-tight">Pipeline Overview</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 flex-1 flex flex-col justify-center">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No data yet
          </p>
        ) : (
          <div className="space-y-3">
            {/* Stacked bar */}
            <div className="flex h-12 rounded-2xl overflow-hidden border border-white/10 dark:border-white/5 shadow-inner">
              {data.map((d, i) => {
                const config = STATUS_CONFIG[d.status];
                const pct = (d.count / total) * 100;
                return (
                  <div
                    key={d.status}
                    className={cn(
                      "transition-all duration-500 hover:opacity-90 hover:brightness-110 cursor-pointer relative",
                      i < data.length - 1 && "border-r-[3px] border-card/40"
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
            <div className="flex flex-wrap gap-x-5 gap-y-2 pt-2">
              {data.map((d) => {
                const config = STATUS_CONFIG[d.status];
                return (
                  <div key={d.status} className="flex items-center gap-2 group cursor-pointer">
                    <div
                      className="h-3 w-3 rounded-full shadow-sm group-hover:scale-110 transition-transform"
                      style={{
                        backgroundColor: config?.color || "#94a3b8",
                      }}
                    />
                    <span className="text-sm text-foreground/80 font-medium tracking-tight">
                      {config?.label || d.status}: <span className="font-semibold text-foreground">{d.count}</span>
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
