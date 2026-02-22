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
    <div className="relative min-h-screen bg-slate-50/50 dark:bg-black overflow-hidden font-sans">
      {/* Decorative Background Blob */}
      <div className="absolute top-0 left-0 right-0 h-[500px] w-full bg-gradient-to-br from-primary/5 via-primary/2 to-transparent dark:from-primary/10 dark:via-primary/5 blur-3xl rounded-[100%] pointer-events-none -translate-y-1/2 opacity-60" />

      <Header title="Dashboard" description="FCL Pricing Engine Overview" />
      <div className="relative p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 animate-in fade-in zoom-in-95 duration-700 ease-out fill-mode-both mt-4 md:mt-6">
        {/* KPI Row */}
        {kpisLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5 lg:gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24 rounded-3xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5 lg:gap-6">
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-[100ms] fill-mode-both">
              <KPICard
                title="Active RFQs"
                value={kpis?.activeRFQs ?? 0}
                icon={ClipboardList}
              />
            </div>
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-[200ms] fill-mode-both">
              <KPICard
                title="Awaiting Quotes"
                value={kpis?.awaitingQuotes ?? 0}
                icon={MessageSquare}
              />
            </div>
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-[300ms] fill-mode-both">
              <KPICard
                title="Pending Selection"
                value={kpis?.pendingSelection ?? 0}
                icon={Clock}
                description="Ready for manager review"
              />
            </div>
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-[400ms] fill-mode-both">
              <KPICard
                title="Quoted Today"
                value={kpis?.quotedToday ?? 0}
                icon={CheckCircle}
              />
            </div>
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-[500ms] fill-mode-both">
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
          </div>
        )}

        {/* Bento Grid: Pipeline & Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-12 duration-[800ms] delay-[600ms] fill-mode-both">
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
        <div className="animate-in fade-in slide-in-from-bottom-12 duration-[1000ms] delay-[800ms] fill-mode-both">
          {activityLoading ? (
            <Skeleton className="h-[300px] rounded-3xl" />
          ) : (
            <ActivityFeed items={activity || []} />
          )}
        </div>
      </div>
    </div>
  );
}
