"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./status-badge";
import { RouteDisplay } from "@/components/ui/route-display";
import { ContainerBadge } from "@/components/ui/container-badge";
import { KANBAN_COLUMNS, STATUS_CONFIG } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { MasterRFQ } from "@/types/rfq";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RFQKanbanProps {
  rfqs: MasterRFQ[];
}

export function RFQKanban({ rfqs }: RFQKanbanProps) {
  const grouped = KANBAN_COLUMNS.reduce(
    (acc, status) => {
      acc[status] = rfqs.filter((r) => r.status === status);
      return acc;
    },
    {} as Record<string, MasterRFQ[]>
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((status) => {
        const items = grouped[status] || [];
        const config = STATUS_CONFIG[status];
        return (
          <div key={status} className="flex-shrink-0 w-72">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-medium">{config?.label || status}</h3>
              <Badge variant="secondary" className="text-xs">
                {items.length}
              </Badge>
            </div>
            <ScrollArea className="h-[calc(100vh-220px)]">
              <div className="space-y-2 pr-2">
                {items.map((rfq) => (
                  <Link key={rfq.rfq_id} href={`/rfqs/${rfq.rfq_id}`}>
                    <Card className="rounded-2xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer overflow-hidden">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-primary">
                            {rfq.rfq_id}
                          </span>
                          <StatusBadge status={rfq.status} className="text-[10px]" />
                        </div>
                        <RouteDisplay pol={rfq.pol} pod={rfq.pod} shipments={rfq.shipments} />
                        <div className="flex items-center justify-between">
                          <ContainerBadge
                            type={rfq.container_type}
                            qty={rfq.qty}
                            shipments={rfq.shipments}
                          />
                          <span className="text-xs text-muted-foreground">
                            {formatDate(rfq.shipments?.[0]?.ready_date || rfq.ready_date)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {rfq.customer_email}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
                {items.length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No RFQs
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
