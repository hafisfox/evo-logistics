"use client";

import { useRFQs } from "@/hooks/use-rfqs";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import type { RFQStatus } from "@/types/rfq";

const STATUS_DISPLAY: Record<RFQStatus, { label: string; color: string }> = {
    Processing: { label: "Processing", color: "text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20" },
    Missing_Port_Data: { label: "Missing Port Data", color: "text-red-600 border-red-200 bg-red-50 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20" },
    Missing_Door_Data: { label: "Missing Door Data", color: "text-red-600 border-red-200 bg-red-50 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20" },
    Parse_Error: { label: "Parse Error", color: "text-red-600 border-red-200 bg-red-50 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20" },
    Selected: { label: "Selected", color: "text-green-600 border-green-200 bg-green-50 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20" },
    Quoted: { label: "Quoted", color: "text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20" },
    Reminded: { label: "Reminded", color: "text-purple-600 border-purple-200 bg-purple-50 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20" },
    Followed_Up: { label: "Followed Up", color: "text-indigo-600 border-indigo-200 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20" },
    Customer_Replied: { label: "Customer Replied", color: "text-teal-600 border-teal-200 bg-teal-50 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20" },
};

export function ShipmentsTable() {
    const { data: rfqs, isLoading } = useRFQs();

    return (
        <div className="flex flex-col rounded-[24px] bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/5 p-6 shadow-sm overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Recent RFQs</h3>
                    <p className="text-sm text-gray-500 mt-1">Latest freight quote requests</p>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">{rfqs ? `${rfqs.length} total` : ""}</span>
                    <div className="flex items-center gap-1">
                        <button className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                            <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        </button>
                        <button className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                            <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        </button>
                    </div>
                    <Link
                        href="/rfqs"
                        className="rounded-full bg-[#1A1C20] px-4 py-2 text-xs font-medium text-white hover:bg-black/80 transition-colors"
                    >
                        View All
                    </Link>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-white/10 text-gray-500">
                            <th className="font-medium py-4 px-4">RFQ ID</th>
                            <th className="font-medium py-4 px-4">Customer</th>
                            <th className="font-medium py-4 px-4">Received</th>
                            <th className="font-medium py-4 px-4">Route (POL → POD)</th>
                            <th className="font-medium py-4 px-4">Container</th>
                            <th className="font-medium py-4 px-4">Status</th>
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
                                    <tr key={rfq.rfq_id} className="border-b border-gray-50 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                        <td className="py-4 px-4">
                                            <Link href={`/rfqs/${rfq.rfq_id}`} className="font-mono text-xs font-medium text-gray-900 dark:text-gray-100 hover:text-orange-500 transition-colors">
                                                {rfq.rfq_id.substring(0, 12)}…
                                            </Link>
                                        </td>
                                        <td className="py-4 px-4 text-gray-600 dark:text-gray-400 max-w-[160px] truncate">
                                            {rfq.customer_email}
                                        </td>
                                        <td className="py-4 px-4 text-gray-500 dark:text-gray-400">
                                            {format(new Date(rfq.received_at), "MMM d, yyyy")}
                                        </td>
                                        <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                                            {rfq.pol} → {rfq.pod}
                                        </td>
                                        <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                                            {rfq.qty}× {rfq.container_type}
                                        </td>
                                        <td className="py-4 px-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}>
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
