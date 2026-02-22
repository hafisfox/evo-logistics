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
    <Card className="hover:shadow-md transition-all duration-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={`${item.rfq_id}-${i}`} className="group flex items-center gap-3 hover:bg-muted/50 p-2.5 -mx-2.5 rounded-lg transition-colors duration-200">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/rfqs/${item.rfq_id}`}
                    className="text-sm font-mono text-primary hover:underline"
                  >
                    {item.rfq_id}
                  </Link>
                  <StatusBadge status={item.status} className="text-[10px]" />
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {item.customer_email} — {item.route}
                </p>
              </div>
              <span className="text-xs text-muted-foreground/80 whitespace-nowrap group-hover:text-muted-foreground transition-colors duration-200">
                {formatDateTime(item.timestamp)}
              </span>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent activity
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
