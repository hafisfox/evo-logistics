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
import type { MasterRFQ } from "@/types/rfq";
import { Eye, UserCheck } from "lucide-react";

interface RFQTableProps {
  rfqs: MasterRFQ[];
}

export function RFQTable({ rfqs }: RFQTableProps) {
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
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/rfqs/${rfq.rfq_id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  {rfq.status === "Processing" && (
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/rfqs/${rfq.rfq_id}/select`}>
                        <UserCheck className="h-4 w-4" />
                      </Link>
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
