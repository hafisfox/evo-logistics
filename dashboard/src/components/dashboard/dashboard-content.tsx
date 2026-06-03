"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, BadgeDollarSign, MoveUpRight, TrendingUp } from "lucide-react";

import { useDashboardSummary } from "@/hooks/use-dashboard-summary";
import { CircularProgress } from "@/components/dashboard/circular-progress";
import { PipelineChart } from "@/components/dashboard/pipeline-chart";
import { Skeleton } from "@/components/ui/skeleton";

function InlineSkeleton({ className }: { className: string }) {
  return <span aria-hidden className={`inline-block rounded-md bg-accent animate-pulse ${className}`} />;
}

function ShipmentsTableFallback() {
  return (
    <div
      data-testid="shipments-table-fallback"
      className="flex flex-col rounded-3xl bg-card border border-black/5 dark:border-white/5 p-6 shadow-sm overflow-hidden"
    >
      <div className="space-y-2 mb-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

const DeferredShipmentsTable = dynamic(
  () => import("@/components/dashboard/shipments-table").then((mod) => mod.ShipmentsTable),
  {
    loading: () => <ShipmentsTableFallback />,
  }
);

function FunnelRow({ label, count, percent, color }: { label: string; count: number; percent: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex-1 h-6 bg-black/[0.03] dark:bg-white/[0.03] rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2`}
          style={{ width: `${Math.max(percent, 4)}%` }}
        >
          {percent >= 15 && <span className="text-[10px] font-bold text-white">{percent}%</span>}
        </div>
      </div>
      <span className="text-sm font-bold text-foreground w-8 text-right">{count}</span>
    </div>
  );
}

export function DashboardContent() {
  const { data: summary, isLoading, isError } = useDashboardSummary();

  const kpis = summary?.kpis;
  const pipeline = summary?.pipeline;
  const activity = summary?.activity;

  const pipelineTotal = pipeline?.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const activeCount = pipeline?.find((item) => item.status === "Processing")?.count ?? 0;
  const activePercent = pipelineTotal > 0 ? Math.round((activeCount / pipelineTotal) * 100) : 0;

  const quotedCount =
    pipeline?.find((item) => item.status === "Quoted" || item.status === "Selected")?.count ?? 0;
  const quotedPercent = pipelineTotal > 0 ? Math.round((quotedCount / pipelineTotal) * 100) : 0;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="group flex flex-col rounded-3xl bg-card border border-black/5 dark:border-white/5 p-6 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-foreground tracking-tight">Pipeline Activity</h3>
              <Link
                href="/rfqs"
                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex items-center gap-6 mt-4">
              {isLoading ? (
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
                    {isLoading ? <InlineSkeleton className="h-4 w-6" /> : kpis?.activeRFQs ?? 0}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm border-t border-dashed border-black/5 dark:border-white/10 pt-2">
                  <span className="h-2 w-2 rounded-full bg-chart-4" />
                  <span className="text-muted-foreground capitalize">Awaiting Quotes</span>
                  <span className="ml-auto font-semibold text-foreground">
                    {isLoading ? (
                      <InlineSkeleton className="h-4 w-6" />
                    ) : (
                      kpis?.awaitingQuotes ?? 0
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm border-t border-dashed border-black/5 dark:border-white/10 pt-2">
                  <span className="h-2 w-2 rounded-full bg-chart-2" />
                  <span className="text-muted-foreground capitalize">Pending Selection</span>
                  <span className="ml-auto font-semibold text-foreground">
                    {isLoading ? (
                      <InlineSkeleton className="h-4 w-6" />
                    ) : (
                      kpis?.pendingSelection ?? 0
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="group flex flex-col rounded-3xl bg-card border border-black/5 dark:border-white/5 p-6 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-chart-2/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-chart-2" />
              <h3 className="font-semibold text-foreground tracking-tight">Quoted Today</h3>
            </div>
            <div className="flex-1 flex items-center justify-center mt-4">
              {isLoading ? (
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
              {isLoading ? (
                <div className="mx-auto h-8 w-16 rounded-md bg-accent animate-pulse" />
              ) : (
                <p className="text-3xl font-bold text-foreground tracking-tight">{kpis?.quotedToday ?? 0}</p>
              )}
              <p className="text-sm text-muted-foreground mt-1 font-medium">quotes sent today</p>
            </div>
          </div>
        </div>

        <div className="group flex flex-col rounded-3xl bg-secondary border border-black/5 dark:border-white/5 relative overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-chart-3/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="p-6 relative z-10 flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <span className="h-2 w-2 rounded-full bg-chart-3" />
                <h3 className="font-semibold text-secondary-foreground tracking-tight">
                  Avg. Response Time
                </h3>
              </div>
              <div className="flex items-baseline gap-3 mb-2">
                {isLoading ? (
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
              <p className="text-xs text-muted-foreground mb-6 font-medium">
                Average agent quote turnaround
              </p>
            </div>
            <Link
              href="/rfqs"
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background shadow-md shadow-black/10 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
            >
              View Pipeline
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="absolute -bottom-6 -right-6 h-44 w-56 bg-chart-3/15 blur-2xl rounded-full opacity-45 transition-transform duration-700 ease-out group-hover:scale-125" />
        </div>
      </div>

      {/* Conversion funnel + Revenue row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="group flex flex-col rounded-3xl bg-card border border-black/5 dark:border-white/5 p-6 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-chart-4/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="h-4 w-4 text-chart-4" />
              <h3 className="font-semibold text-foreground tracking-tight">Conversion Funnel</h3>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const total = kpis?.totalRFQs ?? 0;
                  const quoted = kpis?.quotedCount ?? 0;
                  const selected = kpis?.selectedCount ?? 0;
                  const quotedPct = total > 0 ? Math.round((quoted / total) * 100) : 0;
                  const selectedPct = total > 0 ? Math.round((selected / total) * 100) : 0;
                  return (
                    <>
                      <FunnelRow label="Total RFQs" count={total} percent={100} color="bg-primary" />
                      <FunnelRow label="Quoted" count={quoted} percent={quotedPct} color="bg-chart-4" />
                      <FunnelRow label="Selected" count={selected} percent={selectedPct} color="bg-chart-2" />
                      <div className="pt-3 border-t border-dashed border-black/5 dark:border-white/10">
                        <p className="text-sm text-muted-foreground font-medium">
                          Win rate: <span className="text-foreground font-bold">{kpis?.conversionRate ?? 0}%</span>
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        <div className="group flex flex-col rounded-3xl bg-card border border-black/5 dark:border-white/5 p-6 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-chart-2/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-5">
              <BadgeDollarSign className="h-4 w-4 text-chart-2" />
              <h3 className="font-semibold text-foreground tracking-tight">Revenue (Selected Quotes)</h3>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-40" />
                <Skeleton className="h-6 w-32" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-4xl font-light tracking-tighter text-foreground">
                    AED {(kpis?.totalRevenueAED ?? 0).toLocaleString("en-US")}
                  </p>
                  <p className="text-sm text-muted-foreground font-medium mt-1">
                    USD {(kpis?.totalRevenueUSD ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="flex items-center gap-4 pt-3 border-t border-dashed border-black/5 dark:border-white/10">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground tracking-tight">{kpis?.selectedCount ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">Completed</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground tracking-tight">{kpis?.quotedToday ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">Quoted Today</p>
                  </div>
                  <div className="h-8 w-px bg-border" />
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground tracking-tight">
                      {kpis?.avgResponseTimeHours != null
                        ? kpis.avgResponseTimeHours < 1
                          ? `${Math.round(kpis.avgResponseTimeHours * 60)}m`
                          : `${kpis.avgResponseTimeHours.toFixed(1)}h`
                        : "—"}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-medium">Avg Response</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col">
          {isLoading ? (
            <Skeleton className="h-full min-h-[300px] w-full rounded-[24px]" />
          ) : pipeline && pipeline.length > 0 ? (
            <PipelineChart data={pipeline} />
          ) : (
            <div className="flex flex-col rounded-[24px] bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/5 p-6 shadow-sm items-center justify-center min-h-[300px]">
              <p className="text-sm text-gray-500 text-center">No pipeline data yet</p>
            </div>
          )}
        </div>

        <div className="flex flex-col rounded-3xl bg-card border border-black/5 dark:border-white/5 p-6 shadow-sm overflow-hidden min-h-[300px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-foreground tracking-tight">Recent Activity</h3>
            <Link
              href="/rfqs"
              className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              All <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-hide">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))
            ) : activity && activity.length > 0 ? (
              activity.slice(0, 6).map((item) => (
                <div
                  key={`${item.rfq_id}-${item.timestamp}`}
                  className="group/item flex items-start gap-3 p-2 -mx-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200 cursor-default"
                >
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
                      <span className="text-chart-1 font-medium bg-chart-1/10 px-1.5 rounded-sm">
                        {item.status}
                      </span>
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

      <div className="w-full">
        {isLoading ? (
          <ShipmentsTableFallback />
        ) : isError ? (
          <div className="flex flex-col rounded-3xl bg-card border border-black/5 dark:border-white/5 p-6 shadow-sm">
            <p className="text-sm text-muted-foreground">Unable to load recent RFQs right now.</p>
          </div>
        ) : (
          <DeferredShipmentsTable initialRFQs={summary?.recentRfqs ?? []} disableLiveFetch />
        )}
      </div>
    </>
  );
}
