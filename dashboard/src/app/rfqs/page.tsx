"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/layout/header";
import { RFQTable } from "@/components/rfqs/rfq-table";
import { RFQKanban } from "@/components/rfqs/rfq-kanban";
import { RFQFilters } from "@/components/rfqs/rfq-filters";
import { ViewToggle } from "@/components/rfqs/view-toggle";
import { useRFQs } from "@/hooks/use-rfqs";
import { useUIStore } from "@/store/ui-store";
import { Skeleton } from "@/components/ui/skeleton";

export default function RFQPipelinePage() {
  const { data: rfqs, isLoading } = useRFQs();
  const { pipelineView, setPipelineView } = useUIStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");

  const filtered = useMemo(() => {
    if (!rfqs) return [];
    return rfqs.filter((r) => {
      // Search filter
      if (search) {
        const s = search.toLowerCase();
        const matchesSearch =
          r.rfq_id?.toLowerCase().includes(s) ||
          r.customer_email?.toLowerCase().includes(s) ||
          r.pol?.toLowerCase().includes(s) ||
          r.pod?.toLowerCase().includes(s);
        if (!matchesSearch) return false;
      }
      // Status filter
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      // Service filter
      if (serviceFilter !== "all" && r.service_type !== serviceFilter)
        return false;
      return true;
    });
  }, [rfqs, search, statusFilter, serviceFilter]);

  return (
    <div>
      <Header
        title="RFQ Pipeline"
        description={`${rfqs?.length || 0} total RFQs`}
      />
      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <RFQFilters
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            serviceFilter={serviceFilter}
            onServiceFilterChange={setServiceFilter}
          />
          <ViewToggle view={pipelineView} onViewChange={setPipelineView} />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : pipelineView === "table" ? (
          <RFQTable rfqs={filtered} />
        ) : (
          <RFQKanban rfqs={filtered} />
        )}
      </div>
    </div>
  );
}
