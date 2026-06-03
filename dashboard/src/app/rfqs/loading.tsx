import { Skeleton } from "@/components/ui/skeleton";

export default function RFQsLoading() {
  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </div>

      {/* Table rows */}
      <div className="rounded-3xl border border-black/5 dark:border-white/5 bg-card p-6 space-y-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
