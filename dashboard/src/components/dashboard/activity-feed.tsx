"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/rfqs/status-badge";
import { formatDateTime } from "@/lib/utils";
import type { ActivityItem } from "@/types/analytics";

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-500 h-full flex flex-col overflow-hidden">
      <CardHeader className="p-6 pb-2">
        <CardTitle className="text-lg font-semibold tracking-tight">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-2">
        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={`${item.rfq_id}-${i}`} className="group flex items-center gap-4 hover:bg-white/40 dark:hover:bg-white/5 p-3 -mx-3 rounded-2xl transition-all duration-300">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/rfqs/${item.rfq_id}`}
                    className="text-sm font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors"
                  >
                    {item.rfq_id}
                  </Link>
                  <StatusBadge status={item.status} className="text-[10px] uppercase font-bold tracking-widest" />
                </div>
                <p className="text-xs text-muted-foreground truncate mt-1 opacity-90">
                  {item.customer_email} — {item.route}
                </p>
              </div>
              <span className="text-xs text-muted-foreground/80 whitespace-nowrap group-hover:text-muted-foreground transition-colors duration-200">
                {formatDateTime(item.timestamp)}
              </span>
            </div>
          ))}
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent activity
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
