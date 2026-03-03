"use client";

import { useRFQs } from "@/hooks/use-rfqs";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteDisplay } from "@/components/ui/route-display";
import { ContainerBadge } from "@/components/ui/container-badge";
import Link from "next/link";
import type { MasterRFQ, RFQStatus } from "@/types/rfq";

const STATUS_DISPLAY: Record<RFQStatus, { label: string; color: string }> = {
    Processing: { label: "Processing", color: "text-primary border-primary/20 bg-primary/10" },
    Missing_Port_Data: { label: "Missing Port Data", color: "text-destructive border-destructive/20 bg-destructive/10" },
    Missing_Door_Data: { label: "Missing Door Data", color: "text-destructive border-destructive/20 bg-destructive/10" },
    Parse_Error: { label: "Parse Error", color: "text-destructive border-destructive/20 bg-destructive/10" },
    Selected: { label: "Selected", color: "text-chart-2 border-chart-2/20 bg-chart-2/10" },
    Quoted: { label: "Quoted", color: "text-chart-4 border-chart-4/20 bg-chart-4/10" },
    Reminded: { label: "Reminded", color: "text-chart-3 border-chart-3/20 bg-chart-3/10" },
    Followed_Up: { label: "Followed Up", color: "text-chart-5 border-chart-5/20 bg-chart-5/10" },
    Customer_Replied: { label: "Customer Replied", color: "text-chart-1 border-chart-1/20 bg-chart-1/10" },
    Cancelled: { label: "Cancelled", color: "text-muted-foreground border-muted-foreground/20 bg-muted-foreground/10" },
    On_Hold: { label: "On Hold", color: "text-amber-600 border-amber-600/20 bg-amber-600/10" },
    Expired: { label: "Expired", color: "text-red-600 border-red-600/20 bg-red-600/10" },
};

interface ShipmentsTableProps {
    initialRFQs?: MasterRFQ[];
    disableLiveFetch?: boolean;
}

export function ShipmentsTable({ initialRFQs, disableLiveFetch = false }: ShipmentsTableProps) {
    const { data: liveRFQs, isLoading: liveLoading } = useRFQs({
        enabled: !disableLiveFetch,
    });
    const rfqs = disableLiveFetch ? (initialRFQs ?? []) : liveRFQs;
    const isLoading = disableLiveFetch ? false : liveLoading;

    return (
        <div className="flex flex-col rounded-3xl bg-card border border-black/5 dark:border-white/5 p-6 shadow-sm overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="font-semibold text-foreground text-lg tracking-tight">Recent RFQs</h3>
                    <p className="text-sm text-muted-foreground mt-1 font-medium">Latest freight quote requests</p>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-muted-foreground">{rfqs ? `${rfqs.length} total` : ""}</span>
                    <div className="flex items-center gap-1.5">
                        <button className="p-1.5 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-foreground cursor-pointer">
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button className="p-1.5 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-foreground cursor-pointer">
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                    <Link
                        href="/rfqs"
                        className="rounded-full bg-foreground px-5 py-2 text-xs font-semibold text-background hover:bg-foreground/90 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                    >
                        View All
                    </Link>
                </div>
            </div>

            <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                        <tr className="border-b border-black/5 dark:border-white/10 text-muted-foreground/80 text-xs uppercase tracking-wider">
                            <th className="font-bold py-4 px-4">RFQ ID</th>
                            <th className="font-bold py-4 px-4">Customer</th>
                            <th className="font-bold py-4 px-4">Received</th>
                            <th className="font-bold py-4 px-4">Route (POL → POD)</th>
                            <th className="font-bold py-4 px-4">Container</th>
                            <th className="font-bold py-4 px-4">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b border-gray-50 dark:border-white/5">
                                    <td className="py-4 px-4"><Skeleton className="h-4 w-24" /></td>
                                    <td className="py-4 px-4"><Skeleton className="h-4 w-36" /></td>
                                    <td className="py-4 px-4"><Skeleton className="h-4 w-24" /></td>
                                    <td className="py-4 px-4"><Skeleton className="h-4 w-40" /></td>
                                    <td className="py-4 px-4"><Skeleton className="h-4 w-20" /></td>
                                    <td className="py-4 px-4"><Skeleton className="h-6 w-24 rounded-full" /></td>
                                </tr>
                            ))
                        ) : rfqs && rfqs.length > 0 ? (
                            rfqs.slice(0, 8).map((rfq) => {
                                const statusInfo = STATUS_DISPLAY[rfq.status] ?? { label: rfq.status, color: "text-gray-600 border-gray-200 bg-gray-50" };
                                return (
                                    <tr key={rfq.rfq_id} className="group border-b border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-default">
                                        <td className="py-4 px-4">
                                            <Link href={`/rfqs/${rfq.rfq_id}`} className="font-mono text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                                                {rfq.rfq_id.substring(0, 12)}…
                                            </Link>
                                        </td>
                                        <td className="py-4 px-4 font-semibold text-foreground max-w-[160px] truncate">
                                            {rfq.customer_email}
                                        </td>
                                        <td className="py-4 px-4 text-muted-foreground font-medium">
                                            {format(new Date(rfq.received_at), "MMM d, yyyy")}
                                        </td>
                                        <td className="py-4 px-4 text-muted-foreground font-medium">
                                            <RouteDisplay
                                                pol={rfq.pol}
                                                pod={rfq.pod}
                                                shipments={rfq.shipments}
                                            />
                                        </td>
                                        <td className="py-4 px-4 font-semibold text-foreground">
                                            <ContainerBadge
                                                type={rfq.container_type}
                                                qty={rfq.qty}
                                                shipments={rfq.shipments}
                                                maxChips={3}
                                            />
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border ${statusInfo.color}`}>
                                                {statusInfo.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={6} className="py-8 text-center text-gray-500">
                                    No RFQs found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
