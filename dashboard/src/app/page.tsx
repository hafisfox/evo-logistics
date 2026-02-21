"use client";

import { Header } from "@/components/layout/header";
import { KPICard } from "@/components/dashboard/kpi-card";
import { PipelineChart } from "@/components/dashboard/pipeline-chart";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { PendingActions } from "@/components/dashboard/pending-actions";
import {
  useDashboardKPIs,
  usePipelineCounts,
  useRecentActivity,
} from "@/hooks/use-analytics";
import { useRFQs } from "@/hooks/use-rfqs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ClipboardList,
  Clock,
  MessageSquare,
  CheckCircle,
  Timer,
} from "lucide-react";

export default function DashboardPage() {
  const { data: kpis, isLoading: kpisLoading } = useDashboardKPIs();
  const { data: pipeline, isLoading: pipelineLoading } = usePipelineCounts();
  const { data: activity, isLoading: activityLoading } = useRecentActivity();
  const { data: rfqs } = useRFQs();

  return (
    <div>
      <Header title="Dashboard" description="FCL Pricing Engine Overview" />
      <div className="p-6 space-y-6">
        {/* KPI Row */}
        {kpisLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard
              title="Active RFQs"
              value={kpis?.activeRFQs ?? 0}
              icon={ClipboardList}
            />
            <KPICard
              title="Awaiting Quotes"
              value={kpis?.awaitingQuotes ?? 0}
              icon={MessageSquare}
            />
            <KPICard
              title="Pending Selection"
              value={kpis?.pendingSelection ?? 0}
              icon={Clock}
              description="Ready for manager review"
            />
            <KPICard
              title="Quoted Today"
              value={kpis?.quotedToday ?? 0}
              icon={CheckCircle}
            />
            <KPICard
              title="Avg Response"
              value={
                kpis?.avgResponseTimeHours != null
                  ? `${kpis.avgResponseTimeHours}h`
                  : "—"
              }
              icon={Timer}
              description="Received to quoted"
            />
          </div>
        )}

        {/* Pipeline + Actions row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {pipelineLoading ? (
              <Skeleton className="h-48" />
            ) : (
              <PipelineChart data={pipeline || []} />
            )}
          </div>
          <div>
            <PendingActions rfqs={rfqs || []} />
          </div>
        </div>

        {/* Activity Feed */}
        {activityLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <ActivityFeed items={activity || []} />
        )}
      </div>
    </div>
  );
}
