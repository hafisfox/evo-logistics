import { Skeleton } from "@/components/ui/skeleton";

export default function WorkspaceSettingsLoading() {
  return (
    <div className="max-w-2xl space-y-6 md:space-y-8 p-4 md:p-6 lg:p-8">
      {/* Pricing Constants card */}
      <Skeleton className="h-[280px] rounded-3xl" />
      {/* Mailbox card */}
      <Skeleton className="h-[240px] rounded-3xl" />
      {/* Exchange Rate card */}
      <Skeleton className="h-[260px] rounded-3xl" />
    </div>
  );
}
