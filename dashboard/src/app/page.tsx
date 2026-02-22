"use client";

import { useDashboardKPIs } from "@/hooks/use-analytics";
import { CircularProgress } from "@/components/dashboard/circular-progress";
import { Plus, ListTodo, Download, Settings2, MoveUpRight } from "lucide-react";
import { ProfitChart } from "@/components/dashboard/profit-chart";
import { DestinationMap } from "@/components/dashboard/destination-map";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import { format } from "date-fns";

export default function DashboardPage() {
  const { data: kpis, isLoading: kpisLoading } = useDashboardKPIs();

  const today = new Date();

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
              {format(today, "E")},
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {format(today, "MMMM")}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button className="flex items-center gap-2 rounded-full bg-[#1A1C20] px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-black/80 transition-colors">
            <Plus className="h-4 w-4" />
            Add New Shipment
          </button>
          <button className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            <ListTodo className="h-4 w-4" />
            View my Tasks
          </button>
          <button className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            <Settings2 className="h-4 w-4" />
            Manage Widgets
          </button>
        </div>
      </div>

      {/* Top Widgets Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Efficiency Card */}
        <div className="flex flex-col rounded-[24px] bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/5 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">Fleet Efficiency</h3>
            <select className="text-xs border rounded-full px-3 py-1 bg-transparent text-gray-500 outline-none cursor-pointer">
              <option>This week</option>
            </select>
          </div>
          <div className="flex items-center gap-6 mt-4">
            <CircularProgress
              percentage={71}
              total={172}
              label="Total Fleet"
              size={140}
              strokeWidth={12}
              primaryColor="#F97316"
              secondaryColor="#FFEDD5"
            />
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                <span className="text-gray-500 capitalize">on the move</span>
                <span className="ml-auto font-medium">122</span>
              </div>
              <div className="flex items-center gap-2 text-sm border-t border-dashed border-gray-200 dark:border-white/10 pt-2">
                <span className="h-2 w-2 rounded-full bg-gray-300" />
                <span className="text-gray-500 capitalize">unutilized</span>
                <span className="ml-auto font-medium">31</span>
              </div>
              <div className="flex items-center gap-2 text-sm border-t border-dashed border-gray-200 dark:border-white/10 pt-2">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                <span className="text-gray-500 capitalize">in maintenance</span>
                <span className="ml-auto font-medium">19</span>
              </div>
            </div>
          </div>
        </div>

        {/* Delivery Status Card */}
        <div className="flex flex-col rounded-[24px] bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/5 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Delivery Status</h3>
          </div>
          <div className="flex-1 flex items-center justify-center mt-4">
            <CircularProgress
              percentage={89}
              total={100}
              label="Within Time Limit"
              size={160}
              strokeWidth={14}
              primaryColor="#F97316"
              secondaryColor="#FFEDD5"
            />
          </div>
        </div>

        {/* Vehicles On The Road */}
        <div className="flex flex-col rounded-[24px] bg-[#EAE8E3] dark:bg-[#2A2A2A] border border-gray-100 dark:border-white/5 relative overflow-hidden shadow-sm">
          <div className="p-6 relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Vehicles On The Road</h3>
            </div>
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-5xl font-light text-gray-900 dark:text-white">112</span>
              <div className="flex items-center gap-1 text-sm text-green-600 font-medium">
                <MoveUpRight className="h-4 w-4" />
                <span>+8%</span>
              </div>
              <span className="text-xs text-gray-500">From this time yesterday</span>
            </div>
            <button className="rounded-full bg-[#1A1C20] px-5 py-2 text-sm font-medium text-white shadow hover:bg-black/80 transition-colors">
              Track Vehicles
            </button>
          </div>
          <div className="absolute -bottom-6 -right-6 h-40 w-56 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-white/10 dark:to-white/5 rounded-xl opacity-50 transform rotate-12" />
        </div>
      </div>

      {/* Middle Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ProfitChart />
        </div>
        <div>
          <DestinationMap />
        </div>
      </div>

      {/* Shipments Table Row */}
      <div className="w-full">
        <ShipmentsTable />
      </div>

    </div>
  );
}
