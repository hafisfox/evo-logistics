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
    <div className="rounded-md border overflow-x-auto">
      <Table className="min-w-[800px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">RFQ ID</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Route</TableHead>
            <TableHead>Containers</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ready Date</TableHead>
            <TableHead>Price (AED)</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rfqs.map((rfq) => (
            <TableRow key={rfq.rfq_id}>
              <TableCell className="font-mono text-sm">
                <Link
                  href={`/rfqs/${rfq.rfq_id}`}
                  className="text-primary hover:underline"
                >
                  {rfq.rfq_id}
                </Link>
              </TableCell>
              <TableCell className="text-sm max-w-[180px] truncate">
                {rfq.customer_email}
              </TableCell>
              <TableCell>
                <RouteDisplay pol={rfq.pol} pod={rfq.pod} />
              </TableCell>
              <TableCell>
                <ContainerBadge type={rfq.container_type} qty={rfq.qty} />
              </TableCell>
              <TableCell className="text-sm">{rfq.service_type}</TableCell>
              <TableCell>
                <StatusBadge status={rfq.status} />
              </TableCell>
              <TableCell className="text-sm">
                {formatDate(rfq.ready_date)}
              </TableCell>
              <TableCell>
                {rfq.final_price_aed ? (
                  <CurrencyDisplay amount={rfq.final_price_aed} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    aria-label={`View RFQ ${rfq.rfq_id}`}
                    title={`View RFQ ${rfq.rfq_id}`}
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
                      onClick={() => handleDelete(rfq.rfq_id)}
                      disabled={deleteMutation.isPending}
                      aria-label={`Delete RFQ ${rfq.rfq_id}`}
                      title={`Delete RFQ ${rfq.rfq_id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
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
