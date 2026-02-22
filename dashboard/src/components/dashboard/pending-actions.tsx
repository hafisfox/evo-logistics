"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RouteDisplay } from "@/components/ui/route-display";
import { ContainerBadge } from "@/components/ui/container-badge";
import type { MasterRFQ } from "@/types/rfq";
import { UserCheck, AlertCircle } from "lucide-react";

interface PendingActionsProps {
  rfqs: MasterRFQ[];
}

export function PendingActions({ rfqs }: PendingActionsProps) {
  const actionable = rfqs.filter(
    (r) => r.status === "Processing" || r.status === "Missing_Port_Data" || r.status === "Missing_Door_Data"
  );

  return (
    <Card className="hover:shadow-md transition-all duration-300 flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-orange-500" />
          <CardTitle className="text-base">Pending Actions</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {actionable.slice(0, 5).map((rfq) => (
            <div
              key={rfq.rfq_id}
              className="group flex items-center justify-between gap-3 hover:bg-muted/50 p-3 -mx-3 rounded-lg transition-colors duration-200"
            >
              <div className="flex-1 min-w-0">
                <Link
                  href={`/rfqs/${rfq.rfq_id}`}
                  className="text-sm font-mono text-primary hover:underline"
                >
                  {rfq.rfq_id}
                </Link>
                <div className="flex items-center gap-2 mt-0.5">
                  <RouteDisplay pol={rfq.pol} pod={rfq.pod} />
                  <ContainerBadge type={rfq.container_type} qty={rfq.qty} />
                </div>
              </div>
              {rfq.status === "Processing" && (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/rfqs/${rfq.rfq_id}/select`}>
                    <UserCheck className="h-3.5 w-3.5 mr-1" />
                    Select
                  </Link>
                </Button>
              )}
            </div>
          ))}
          {actionable.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No pending actions
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
