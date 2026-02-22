"use client";

import { useRFQs } from "@/hooks/use-rfqs";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function ShipmentsTable() {
    const { data: rfqs, isLoading } = useRFQs();

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case "in transit":
                return "text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
            case "delivered":
                return "text-green-600 border-green-200 bg-green-50 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20";
            case "pending":
            case "processing":
                return "text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20";
            default:
                return "text-gray-600 border-gray-200 bg-gray-50 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20";
        }
    };

    return (
        <div className="flex flex-col rounded-[24px] bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/5 p-6 shadow-sm overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Shipments Overview</h3>
                    <p className="text-sm text-gray-500 mt-1">Keep track of recent shipping activity</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:gap-4">
                    <div className="flex items-center bg-gray-50 dark:bg-white/5 rounded-full p-1">
                        <button className="px-4 py-1.5 text-sm font-medium rounded-full bg-[#1A1C20] text-white shadow-sm transition-colors">
                            All Shipments
                        </button>
                        <button className="px-4 py-1.5 text-sm font-medium rounded-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                            Delivered
                        </button>
                        <button className="px-4 py-1.5 text-sm font-medium rounded-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                            In transit
                        </button>
                        <button className="px-4 py-1.5 text-sm font-medium rounded-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hidden sm:block transition-colors">
                            Processing
                        </button>
                        <button className="px-4 py-1.5 text-sm font-medium rounded-full text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hidden sm:block transition-colors">
                            Pending
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                            <Filter className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        </button>
                        <span className="text-sm text-gray-500">1-10 of 72</span>
                        <div className="flex items-center gap-1">
                            <button className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                                <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            </button>
                            <button className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                                <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-white/10 text-gray-500">
                            <th className="font-medium py-4 px-4">Order ID ↓↑</th>
                            <th className="font-medium py-4 px-4">Company ↓↑</th>
                            <th className="font-medium py-4 px-4">Arrival Date ↓↑</th>
                            <th className="font-medium py-4 px-4">Route ↓↑</th>
                            <th className="font-medium py-4 px-4">Weight ↓↑</th>
                            <th className="font-medium py-4 px-4">Status ↓↑</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="border-b border-gray-50 dark:border-white/5">
                                    <td className="py-4 px-4"><Skeleton className="h-4 w-24" /></td>
                                    <td className="py-4 px-4"><Skeleton className="h-4 w-32" /></td>
                                    <td className="py-4 px-4"><Skeleton className="h-4 w-24" /></td>
                                    <td className="py-4 px-4"><Skeleton className="h-4 w-40" /></td>
                                    <td className="py-4 px-4"><Skeleton className="h-4 w-16" /></td>
                                    <td className="py-4 px-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                                </tr>
                            ))
                        ) : rfqs && rfqs.length > 0 ? (
                            rfqs.slice(0, 5).map((rfq) => (
                                <tr key={rfq.rfq_id} className="border-b border-gray-50 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                    <td className="py-4 px-4 font-medium text-gray-900 dark:text-gray-100">
                                        ISJ{rfq.rfq_id.substring(0, 6).toUpperCase()}
                                    </td>
                                    <td className="py-4 px-4 text-gray-600 dark:text-gray-400">Nebula Nexus</td>
                                    <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                                        {format(new Date(rfq.received_at), "MM-dd-yyyy")}
                                    </td>
                                    <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                                        {rfq.pol} — {rfq.pod}
                                    </td>
                                    <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                                        {rfq.qty ? rfq.qty : "12.5 kg"}
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(rfq.status === 'Processing' ? 'Processing' : rfq.status === 'Quoted' ? 'In transit' : 'Delivered')}`}>
                                            {rfq.status === 'Processing' ? 'Processing' : rfq.status === 'Quoted' ? 'In transit' : 'Delivered'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className="py-8 text-center text-gray-500">
                                    No shipments found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
