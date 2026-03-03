"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RFQTable } from "@/components/rfqs/rfq-table";
import { RFQKanban } from "@/components/rfqs/rfq-kanban";
import { RFQFilters } from "@/components/rfqs/rfq-filters";
import { ViewToggle } from "@/components/rfqs/view-toggle";
import { useRFQs } from "@/hooks/use-rfqs";
import { useUIStore } from "@/store/ui-store";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

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
        const shipmentSearchText = (r.shipments || [])
          .map((shipment) => `${shipment.pol} ${shipment.pod}`)
          .join(" ")
          .toLowerCase();
        const matchesSearch =
          r.rfq_id?.toLowerCase().includes(s) ||
          r.customer_email?.toLowerCase().includes(s) ||
          r.pol?.toLowerCase().includes(s) ||
          r.pod?.toLowerCase().includes(s) ||
          shipmentSearchText.includes(s);
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
    <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 animate-in fade-in zoom-in-95 duration-700 ease-out fill-mode-both">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <RFQFilters
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          serviceFilter={serviceFilter}
          onServiceFilterChange={setServiceFilter}
        />
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="h-9 rounded-xl font-semibold shadow-sm">
            <Link href="/rfqs/new">
              <Plus className="h-4 w-4 mr-1" />
              Create RFQ
            </Link>
          </Button>
          <ViewToggle view={pipelineView} onViewChange={setPipelineView} />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : pipelineView === "table" ? (
        <RFQTable rfqs={filtered} />
      ) : (
        <RFQKanban rfqs={filtered} />
      )}
    </div>
  );
}
