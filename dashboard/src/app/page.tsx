import Link from "next/link";
import { Plus } from "lucide-react";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default function DashboardPage() {
  const today = new Date();
  const day = today.getDate().toString().padStart(2, "0");
  const weekday = today.toLocaleDateString("en-US", { weekday: "short" });
  const monthYear = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-black/20 text-2xl font-light text-gray-900 dark:text-gray-100">
            {day}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {weekday},
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {monthYear}
            </span>
          </div>
        </div>

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
            className="flex items-center gap-2 rounded-full border border-black/5 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-sm px-5 py-2.5 text-sm font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-300"
          >
            View Agents
          </Link>
          <Link
            href="/pricing"
            className="flex items-center gap-2 rounded-full border border-black/5 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-sm px-5 py-2.5 text-sm font-medium text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-300"
          >
            Pricing Tables
          </Link>
        </div>
      </div>

      <DashboardContent />
    </div>
  );
}
