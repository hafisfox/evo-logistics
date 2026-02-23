"use client";

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
import { formatDate } from "@/lib/utils";
import { useDeleteRFQ } from "@/hooks/use-rfqs";
import { useWorkspaceAccess } from "@/hooks/use-workspace-access";
import { toast } from "sonner";
import type { MasterRFQ } from "@/types/rfq";
import { Eye, Trash2, UserCheck } from "lucide-react";

interface RFQTableProps {
  rfqs: MasterRFQ[];
}

export function RFQTable({ rfqs }: RFQTableProps) {
  const { canManage } = useWorkspaceAccess();
  const deleteMutation = useDeleteRFQ();

  const handleDelete = async (rfqId: string) => {
    const confirmed = window.confirm(`Delete RFQ \"${rfqId}\"?`);
    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync(rfqId);
      toast.success("RFQ deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete RFQ");
    }
  };

  if (rfqs.length === 0) {
    return <EmptyState title="No RFQs found" description="Waiting for incoming customer enquiries" />;
  }

  return (
    <div className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-x-auto scrollbar-hide">
      <Table className="min-w-[800px]">
        <TableHeader className="bg-black/[0.02] dark:bg-white/[0.02]">
          <TableRow className="border-b border-black/5 dark:border-white/5 hover:bg-transparent">
            <TableHead className="w-[140px] font-semibold text-muted-foreground h-12">RFQ ID</TableHead>
            <TableHead className="font-semibold text-muted-foreground h-12">Customer</TableHead>
            <TableHead className="font-semibold text-muted-foreground h-12">Route</TableHead>
            <TableHead className="font-semibold text-muted-foreground h-12">Containers</TableHead>
            <TableHead className="font-semibold text-muted-foreground h-12">Service</TableHead>
            <TableHead className="font-semibold text-muted-foreground h-12">Status</TableHead>
            <TableHead className="font-semibold text-muted-foreground h-12">Ready Date</TableHead>
            <TableHead className="font-semibold text-muted-foreground h-12">Price (AED)</TableHead>
            <TableHead className="text-right font-semibold text-muted-foreground h-12 w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rfqs.map((rfq) => (
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
                      onClick={(e) => { e.stopPropagation(); handleDelete(rfq.rfq_id); }}
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
  );
}
