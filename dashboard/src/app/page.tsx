"use client";

import { useDashboardKPIs, usePipelineCounts, useRecentActivity } from "@/hooks/use-analytics";
import { useRFQs } from "@/hooks/use-rfqs";
import { CircularProgress } from "@/components/dashboard/circular-progress";
import { PipelineChart } from "@/components/dashboard/pipeline-chart";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import { Plus, MoveUpRight, MoveDownRight, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import Link from "next/link";

export default function DashboardPage() {
  const { data: kpis, isLoading: kpisLoading } = useDashboardKPIs();
  const { data: pipeline, isLoading: pipelineLoading } = usePipelineCounts();
  const { data: activity, isLoading: activityLoading } = useRecentActivity();
  const { data: rfqs } = useRFQs();

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
            className="flex items-center gap-2 rounded-full bg-[#1A1C20] px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-black/80 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New RFQ
          </Link>
          <Link
            href="/agents"
            className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            View Agents
          </Link>
          <Link
            href="/pricing"
            className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            Pricing Tables
          </Link>
        </div>
      </div>

      {/* Top KPI Widgets Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pipeline Activity Card */}
        <div className="flex flex-col rounded-[24px] bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/5 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">Pipeline Activity</h3>
            <Link href="/rfqs" className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              View all →
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
                primaryColor="#F97316"
                secondaryColor="#FFEDD5"
              />
            )}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                <span className="text-gray-500 capitalize">Processing</span>
                <span className="ml-auto font-semibold text-gray-900 dark:text-white">
                  {kpisLoading ? <Skeleton className="h-4 w-6 inline-block" /> : kpis?.activeRFQs ?? 0}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm border-t border-dashed border-gray-200 dark:border-white/10 pt-2">
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                <span className="text-gray-500 capitalize">Awaiting Quotes</span>
                <span className="ml-auto font-semibold text-gray-900 dark:text-white">
                  {kpisLoading ? <Skeleton className="h-4 w-6 inline-block" /> : kpis?.awaitingQuotes ?? 0}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm border-t border-dashed border-gray-200 dark:border-white/10 pt-2">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                <span className="text-gray-500 capitalize">Pending Selection</span>
                <span className="ml-auto font-semibold text-gray-900 dark:text-white">
                  {kpisLoading ? <Skeleton className="h-4 w-6 inline-block" /> : kpis?.pendingSelection ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quoted Today Card */}
        <div className="flex flex-col rounded-[24px] bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/5 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Quoted Today</h3>
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
                primaryColor="#22c55e"
                secondaryColor="#dcfce7"
              />
            )}
          </div>
          <div className="mt-4 text-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {kpisLoading ? <Skeleton className="h-8 w-16 inline-block" /> : kpis?.quotedToday ?? 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">quotes sent today</p>
          </div>
        </div>

        {/* Avg Response Time Card */}
        <div className="flex flex-col rounded-[24px] bg-[#EAE8E3] dark:bg-[#2A2A2A] border border-gray-100 dark:border-white/5 relative overflow-hidden shadow-sm">
          <div className="p-6 relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Avg. Response Time</h3>
            </div>
            <div className="flex items-baseline gap-3 mb-2">
              {kpisLoading ? (
                <Skeleton className="h-12 w-24" />
              ) : (
                <>
                  <span className="text-5xl font-light text-gray-900 dark:text-white">
                    {kpis?.avgResponseTimeHours != null
                      ? kpis.avgResponseTimeHours < 1
                        ? `${Math.round(kpis.avgResponseTimeHours * 60)}m`
                        : `${kpis.avgResponseTimeHours.toFixed(1)}h`
                      : "—"}
                  </span>
                  {kpis?.avgResponseTimeHours != null && (
                    <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
                      <MoveUpRight className="h-4 w-4" />
                      <span>Active</span>
                    </div>
                  )}
                </>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-6">Average agent quote turnaround</p>
            <Link
              href="/rfqs"
              className="inline-flex items-center gap-2 rounded-full bg-[#1A1C20] px-5 py-2 text-sm font-medium text-white shadow hover:bg-black/80 transition-colors"
            >
              View Pipeline
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="absolute -bottom-6 -right-6 h-40 w-56 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-white/10 dark:to-white/5 rounded-xl opacity-50 transform rotate-12" />
        </div>
      </div>

      {/* Middle Row: Pipeline Chart + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Chart */}
        <div className="lg:col-span-2 flex flex-col rounded-[24px] bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/5 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Pipeline Overview</h3>
              <p className="text-sm text-gray-500 mt-1">RFQ status distribution</p>
            </div>
            <Link href="/rfqs" className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center gap-1">
              Full pipeline <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {pipelineLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full rounded-2xl" />
              <div className="flex gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ) : pipeline && pipeline.length > 0 ? (
            <PipelineChart data={pipeline} />
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No pipeline data yet</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="flex flex-col rounded-[24px] bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/5 p-6 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
            <Link href="/rfqs" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
              All →
            </Link>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto">
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
                <div key={`${item.rfq_id}-${item.timestamp}`} className="flex items-start gap-3 group">
                  <div className="h-8 w-8 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center shrink-0 text-xs font-bold text-orange-500">
                    {item.customer_email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                      {item.customer_email}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {item.route} · <span className="text-orange-500">{item.status}</span>
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
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
