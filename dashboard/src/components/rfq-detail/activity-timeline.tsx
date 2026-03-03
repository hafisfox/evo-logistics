"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useActivityLog } from "@/hooks/use-activity-log";
import { formatDate } from "@/lib/utils";
import {
  Activity, Mail, CheckCircle, Clock, AlertTriangle, RefreshCw, XCircle,
} from "lucide-react";

interface ActivityTimelineProps {
  rfqId: string;
}

const ACTION_CONFIG: Record<string, { icon: typeof Activity; color: string }> = {
  created: { icon: Mail, color: "text-blue-500" },
  updated: { icon: RefreshCw, color: "text-amber-500" },
  selected: { icon: CheckCircle, color: "text-emerald-500" },
  reminded: { icon: Clock, color: "text-orange-500" },
  expired: { icon: XCircle, color: "text-red-500" },
  escalated: { icon: AlertTriangle, color: "text-red-500" },
  stale_rfq_detected: { icon: AlertTriangle, color: "text-amber-500" },
  quote_expired: { icon: XCircle, color: "text-red-400" },
};

function getActionDisplay(action: string) {
  const config = ACTION_CONFIG[action];
  if (config) return config;
  return { icon: Activity, color: "text-muted-foreground" };
}

function formatAction(action: string, metadata: Record<string, unknown> | null): string {
  switch (action) {
    case "created":
      return "RFQ created";
    case "selected":
      return metadata?.agent
        ? `Agent ${metadata.agent} selected`
        : "Agent selected";
    case "reminded":
      return metadata?.reminder_count
        ? `Reminder #${metadata.reminder_count} sent`
        : "Reminder sent";
    case "expired":
      return "RFQ expired";
    case "escalated":
      return metadata?.reason
        ? `Escalated: ${metadata.reason}`
        : "Escalated to manager";
    case "stale_rfq_detected":
      return "No quotes received — flagged as stale";
    case "quote_expired":
      return metadata?.agent
        ? `Quote from ${metadata.agent} expired`
        : "Quote expired";
    default:
      return action.replace(/_/g, " ");
  }
}

export function ActivityTimeline({ rfqId }: ActivityTimelineProps) {
  const { data: logs, isLoading } = useActivityLog(rfqId);

  return (
    <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
      <CardHeader className="pb-3 px-6 pt-6">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-lg font-bold tracking-tight">Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-8 rounded-lg bg-muted/30 animate-pulse" />
            <div className="h-8 rounded-lg bg-muted/30 animate-pulse" />
            <div className="h-8 rounded-lg bg-muted/30 animate-pulse" />
          </div>
        ) : logs && logs.length > 0 ? (
          <div className="relative max-h-72 overflow-y-auto">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-3">
              {logs.map((log) => {
                const { icon: Icon, color } = getActionDisplay(log.action);
                return (
                  <div key={log.id} className="relative flex items-start gap-3 pl-1">
                    <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background border border-border">
                      <Icon className={`h-3 w-3 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-sm leading-tight">
                        {formatAction(log.action, log.metadata)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(log.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            No activity recorded
          </p>
        )}
      </CardContent>
    </Card>
  );
}
