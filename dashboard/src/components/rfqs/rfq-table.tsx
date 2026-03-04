"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";
import { RouteDisplay } from "@/components/ui/route-display";
import { ContainerBadge } from "@/components/ui/container-badge";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { formatDate } from "@/lib/utils";
import { useDeleteRFQ } from "@/hooks/use-rfqs";
import { useWorkspaceAccess } from "@/hooks/use-workspace-access";
import { toast } from "sonner";
import type { MasterRFQ } from "@/types/rfq";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Trash2,
  UserCheck,
} from "lucide-react";

const PAGE_SIZE = 25;

type SortKey = "rfq_id" | "customer_email" | "status" | "ready_date" | "received_at" | "final_price_aed";
type SortDir = "asc" | "desc";

function getSortValue(rfq: MasterRFQ, key: SortKey): string | number {
  switch (key) {
    case "rfq_id":
      return rfq.rfq_id;
    case "customer_email":
      return rfq.customer_email?.toLowerCase() ?? "";
    case "status":
      return rfq.status;
    case "ready_date":
      return rfq.shipments?.[0]?.ready_date || rfq.ready_date || "";
    case "received_at":
      return rfq.received_at || "";
    case "final_price_aed":
      return rfq.final_price_aed ? parseFloat(rfq.final_price_aed) : 0;
    default:
      return "";
  }
}

function exportCSV(rfqs: MasterRFQ[]) {
  const headers = [
    "RFQ ID",
    "Customer",
    "POL",
    "POD",
    "Container",
    "Qty",
    "Service Type",
    "Status",
    "Ready Date",
    "Received At",
    "Price (AED)",
    "Price (USD)",
    "Selected Agent",
  ];

  const escapeCSV = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const rows = rfqs.map((rfq) => [
    rfq.rfq_id,
    rfq.customer_email,
    rfq.shipments?.[0]?.pol || rfq.pol || "",
    rfq.shipments?.[0]?.pod || rfq.pod || "",
    rfq.container_type || "",
    rfq.qty || "",
    rfq.shipments?.[0]?.service_type || rfq.service_type || "",
    rfq.status,
    rfq.shipments?.[0]?.ready_date || rfq.ready_date || "",
    rfq.received_at || "",
    rfq.final_price_aed || "",
    rfq.final_price_usd || "",
    rfq.selected_agent || "",
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.map((v) => escapeCSV(String(v))).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rfqs-export-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface RFQTableProps {
  rfqs: MasterRFQ[];
}

export function RFQTable({ rfqs }: RFQTableProps) {
  const { canManage } = useWorkspaceAccess();
  const deleteMutation = useDeleteRFQ();
  const [sortKey, setSortKey] = useState<SortKey>("received_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Reset to page 0 when the filtered dataset changes
  useEffect(() => {
    setPage(0);
  }, [rfqs.length]);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
      setPage(0);
    },
    [sortKey]
  );

  const sorted = useMemo(() => {
    const copy = [...rfqs];
    copy.sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rfqs, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget);
      toast.success("RFQ deleted");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete RFQ");
    }
  };

  const renderSortIcon = (column: SortKey) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const renderSortableHeader = (column: SortKey, children: React.ReactNode) => (
    <TableHead
      className="font-semibold text-muted-foreground h-12 cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => handleSort(column)}
    >
      <span className="inline-flex items-center gap-1.5">
        {children}
        {renderSortIcon(column)}
      </span>
    </TableHead>
  );

  if (rfqs.length === 0) {
    return <EmptyState title="No RFQs found" description="Waiting for incoming customer enquiries" />;
  }

  return (
    <div className="space-y-3">
      {/* Export button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(rfqs)}
          className="h-8 rounded-xl text-xs font-medium gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-x-auto scrollbar-hide">
        <Table className="min-w-[800px]">
          <TableHeader className="bg-black/[0.02] dark:bg-white/[0.02]">
            <TableRow className="border-b border-black/5 dark:border-white/5 hover:bg-transparent">
              {renderSortableHeader("rfq_id", "RFQ ID")}
              {renderSortableHeader("customer_email", "Customer")}
              <TableHead className="font-semibold text-muted-foreground h-12">Route</TableHead>
              <TableHead className="font-semibold text-muted-foreground h-12">Containers</TableHead>
              <TableHead className="font-semibold text-muted-foreground h-12">Service</TableHead>
              {renderSortableHeader("status", "Status")}
              {renderSortableHeader("ready_date", "Ready Date")}
              {renderSortableHeader("final_price_aed", "Price (AED)")}
              <TableHead className="text-right font-semibold text-muted-foreground h-12 w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((rfq) => (
              <TableRow
                key={rfq.rfq_id}
                className="group border-b border-black/5 dark:border-white/5 hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-all cursor-pointer"
              >
                <TableCell className="font-mono text-sm py-4">
                  <Link
                    href={`/rfqs/${rfq.rfq_id}`}
                    className="text-primary font-medium hover:underline transition-all"
                  >
                    {rfq.rfq_id}
                  </Link>
                </TableCell>
                <TableCell className="text-sm max-w-[180px] truncate font-medium text-foreground py-4">
                  {rfq.customer_email}
                </TableCell>
                <TableCell className="py-4">
                  <RouteDisplay pol={rfq.pol} pod={rfq.pod} shipments={rfq.shipments} />
                </TableCell>
                <TableCell className="py-4">
                  <ContainerBadge type={rfq.container_type} qty={rfq.qty} shipments={rfq.shipments} />
                </TableCell>
                <TableCell className="text-sm font-medium text-muted-foreground py-4">
                  {rfq.shipments?.[0]?.service_type || rfq.service_type}
                </TableCell>
                <TableCell className="py-4">
                  <StatusBadge status={rfq.status} />
                </TableCell>
                <TableCell className="text-sm font-medium text-muted-foreground py-4">
                  {formatDate(rfq.shipments?.[0]?.ready_date || rfq.ready_date)}
                </TableCell>
                <TableCell className="py-4 cursor-default">
                  {rfq.final_price_aed ? (
                    <span className="font-mono font-medium opacity-90 group-hover:opacity-100 transition-opacity"><CurrencyDisplay amount={rfq.final_price_aed} /></span>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right py-4 cursor-default">
                  <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      aria-label={`View RFQ ${rfq.rfq_id}`}
                      title={`View RFQ ${rfq.rfq_id}`}
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Link href={`/rfqs/${rfq.rfq_id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    {rfq.status === "Processing" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        aria-label={`Select agent for RFQ ${rfq.rfq_id}`}
                        title={`Select agent for RFQ ${rfq.rfq_id}`}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-600/10 transition-colors"
                      >
                        <Link href={`/rfqs/${rfq.rfq_id}/select`}>
                          <UserCheck className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(rfq.rfq_id); }}
                        disabled={deleteMutation.isPending}
                        aria-label={`Delete RFQ ${rfq.rfq_id}`}
                        title={`Delete RFQ ${rfq.rfq_id}`}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-xs text-muted-foreground font-medium">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const startPage = Math.max(0, Math.min(page - 2, totalPages - 5));
              const pageNum = startPage + i;
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8 rounded-lg text-xs"
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum + 1}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={`Delete RFQ "${deleteTarget}"?`}
        description="This action cannot be undone. The RFQ and all associated data will be permanently removed."
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
