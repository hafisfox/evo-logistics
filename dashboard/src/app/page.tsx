"use client";

import { useDashboardKPIs, usePipelineCounts, useRecentActivity } from "@/hooks/use-analytics";
import { CircularProgress } from "@/components/dashboard/circular-progress";
import { PipelineChart } from "@/components/dashboard/pipeline-chart";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import { Plus, MoveUpRight, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import Link from "next/link";

export default function DashboardPage() {
  const { data: kpis, isLoading: kpisLoading } = useDashboardKPIs();
  const { data: pipeline, isLoading: pipelineLoading } = usePipelineCounts();
  const { data: activity, isLoading: activityLoading } = useRecentActivity();
  const today = new Date();

  // Calculate pipeline total for the CircularProgress widget
  const pipelineTotal = pipeline?.reduce((sum, d) => sum + d.count, 0) ?? 0;
  const activeCount = pipeline?.find((d) => d.status === "Processing")?.count ?? 0;
  const activePercent = pipelineTotal > 0 ? Math.round((activeCount / pipelineTotal) * 100) : 0;

  const quotedCount = pipeline?.find((d) => d.status === "Quoted" || d.status === "Selected")?.count ?? 0;
  const quotedPercent = pipelineTotal > 0 ? Math.round((quotedCount / pipelineTotal) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700 ease-out fill-mode-both">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Date Display */}
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-2xl font-light text-gray-900 dark:text-gray-100">
            {format(today, "dd")}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {format(today, "EEE")},
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {format(today, "MMMM yyyy")}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/rfqs"
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
          >
            <Plus className="h-4 w-4" />
            New RFQ
          </Link>
          <Link
            href="/agents"
            className="flex items-center gap-2 rounded-full border border-black/5 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-md px-5 py-2.5 text-sm font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-300"
          >
            View Agents
          </Link>
          <Link
            href="/pricing"
            className="flex items-center gap-2 rounded-full border border-black/5 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-md px-5 py-2.5 text-sm font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-300"
          >
            Pricing Tables
          </Link>
        </div>
      </div>

      {/* Top KPI Widgets Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pipeline Activity Card */}
        <div className="group flex flex-col rounded-3xl bg-card border border-black/5 dark:border-white/5 p-6 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-foreground tracking-tight">Pipeline Activity</h3>
              <Link href="/rfqs" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex items-center gap-6 mt-4">
              {pipelineLoading ? (
                <Skeleton className="h-[140px] w-[140px] rounded-full" />
              ) : (
                <CircularProgress
                  percentage={activePercent}
                  total={pipelineTotal}
                  label="Processing"
                  size={140}
                  strokeWidth={12}
                  primaryColor="oklch(0.55 0.15 230)"
                  secondaryColor="oklch(0.55 0.15 230 / 0.1)"
                />
              )}
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground capitalize">Processing</span>
                  <span className="ml-auto font-semibold text-foreground">
                    {kpisLoading ? <Skeleton className="h-4 w-6 inline-block" /> : kpis?.activeRFQs ?? 0}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm border-t border-dashed border-black/5 dark:border-white/10 pt-2">
                  <span className="h-2 w-2 rounded-full bg-chart-4" />
                  <span className="text-muted-foreground capitalize">Awaiting Quotes</span>
                  <span className="ml-auto font-semibold text-foreground">
                    {kpisLoading ? <Skeleton className="h-4 w-6 inline-block" /> : kpis?.awaitingQuotes ?? 0}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm border-t border-dashed border-black/5 dark:border-white/10 pt-2">
                  <span className="h-2 w-2 rounded-full bg-chart-2" />
                  <span className="text-muted-foreground capitalize">Pending Selection</span>
                  <span className="ml-auto font-semibold text-foreground">
                    {kpisLoading ? <Skeleton className="h-4 w-6 inline-block" /> : kpis?.pendingSelection ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quoted Today Card */}
        <div className="group flex flex-col rounded-3xl bg-card border border-black/5 dark:border-white/5 p-6 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-chart-2/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-chart-2" />
              <h3 className="font-semibold text-foreground tracking-tight">Quoted Today</h3>
            </div>
            <div className="flex-1 flex items-center justify-center mt-4">
              {kpisLoading ? (
                <Skeleton className="h-[160px] w-[160px] rounded-full" />
              ) : (
                <CircularProgress
                  percentage={quotedPercent}
                  total={pipelineTotal}
                  label="Conversion Rate"
                  size={160}
                  strokeWidth={14}
                  primaryColor="oklch(0.696 0.17 162.48)"
                  secondaryColor="oklch(0.696 0.17 162.48 / 0.1)"
                />
              )}
            </div>
            <div className="mt-4 text-center">
              <p className="text-3xl font-bold text-foreground tracking-tight">
                {kpisLoading ? <Skeleton className="h-8 w-16 inline-block" /> : kpis?.quotedToday ?? 0}
              </p>
              <p className="text-sm text-muted-foreground mt-1 font-medium">quotes sent today</p>
            </div>
          </div>
        </div>

        {/* Avg Response Time Card */}
        <div className="group flex flex-col rounded-3xl bg-secondary border border-black/5 dark:border-white/5 relative overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-chart-3/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="p-6 relative z-10 flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <span className="h-2 w-2 rounded-full bg-chart-3" />
                <h3 className="font-semibold text-secondary-foreground tracking-tight">Avg. Response Time</h3>
              </div>
              <div className="flex items-baseline gap-3 mb-2">
                {kpisLoading ? (
                  <Skeleton className="h-12 w-24" />
                ) : (
                  <>
                    <span className="text-5xl font-light text-secondary-foreground tracking-tighter">
                      {kpis?.avgResponseTimeHours != null
                        ? kpis.avgResponseTimeHours < 1
                          ? `${Math.round(kpis.avgResponseTimeHours * 60)}m`
                          : `${kpis.avgResponseTimeHours.toFixed(1)}h`
                        : "—"}
                    </span>
                    {kpis?.avgResponseTimeHours != null && (
                      <div className="flex items-center gap-1 text-sm text-chart-2 font-semibold">
                        <MoveUpRight className="h-4 w-4 stroke-[3]" />
                        <span>Active</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-6 font-medium">Average agent quote turnaround</p>
            </div>
            <Link
              href="/rfqs"
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background shadow-md shadow-black/10 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
            >
              View Pipeline
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="absolute -bottom-6 -right-6 h-48 w-64 bg-chart-3/20 blur-3xl rounded-full opacity-50 transition-transform duration-700 ease-out group-hover:scale-150" />
        </div>
      </div>

      {/* Middle Row: Pipeline Chart + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Chart */}
        <div className="lg:col-span-2 flex flex-col">
          {pipelineLoading ? (
            <Skeleton className="h-full min-h-[300px] w-full rounded-[24px]" />
          ) : pipeline && pipeline.length > 0 ? (
            <PipelineChart data={pipeline} />
          ) : (
            <div className="flex flex-col rounded-[24px] bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/5 p-6 shadow-sm items-center justify-center min-h-[300px]">
              <p className="text-sm text-gray-500 text-center">No pipeline data yet</p>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="flex flex-col rounded-3xl bg-card border border-black/5 dark:border-white/5 p-6 shadow-sm overflow-hidden min-h-[300px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-foreground tracking-tight">Recent Activity</h3>
            <Link href="/rfqs" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-hide">
            {activityLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))
            ) : activity && activity.length > 0 ? (
              activity.slice(0, 6).map((item) => (
                <div key={`${item.rfq_id}-${item.timestamp}`} className="group/item flex items-start gap-3 p-2 -mx-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200 cursor-default">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-bold text-primary shadow-sm border border-primary/20">
                    {item.customer_email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-sm font-semibold text-foreground truncate leading-tight group-hover/item:text-primary transition-colors">
                      {item.customer_email}
                    </p>
                    <p className="text-[12px] text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                      <span className="font-medium text-foreground/70">{item.route}</span>
                      <span className="h-1 w-1 rounded-full bg-border" />
                      <span className="text-chart-1 font-medium bg-chart-1/10 px-1.5 rounded-sm">{item.status}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 font-medium uppercase tracking-wider">
                      {format(new Date(item.timestamp), "MMM d, HH:mm")}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
            )}
          </div>
        </div>
      </div>

      {/* RFQ Table */}
      <div className="w-full">
        <ShipmentsTable />
      </div>
    </div>
  );
}
