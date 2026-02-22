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
    <Card className="rounded-3xl border-white/20 dark:border-white/5 bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.02)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-500 flex flex-col h-full overflow-hidden">
      <CardHeader className="p-6 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-full bg-orange-500/10 text-orange-500">
            <AlertCircle className="h-4 w-4" />
          </div>
          <CardTitle className="text-lg font-semibold tracking-tight">Action Required</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-2">
        <div className="space-y-1">
          {actionable.slice(0, 5).map((rfq) => (
            <div
              key={rfq.rfq_id}
              className="group flex items-center justify-between gap-4 hover:bg-white/40 dark:hover:bg-white/5 p-3.5 -mx-3.5 rounded-2xl transition-all duration-300 hover:scale-[1.01]"
            >
              <div className="flex-1 min-w-0">
                <Link
                  href={`/rfqs/${rfq.rfq_id}`}
                  className="text-sm font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors"
                >
                  {rfq.rfq_id}
                </Link>
                <div className="flex items-center gap-2 mt-1.5 opacity-90">
                  <RouteDisplay pol={rfq.pol} pod={rfq.pod} />
                  <ContainerBadge type={rfq.container_type} qty={rfq.qty} />
                </div>
              </div>
              {rfq.status === "Processing" && (
                <Button size="sm" variant="default" className="rounded-xl shadow-sm hover:shadow-md transition-all" asChild>
                  <Link href={`/rfqs/${rfq.rfq_id}/select`}>
                    <UserCheck className="h-4 w-4 mr-1.5" />
                    Assign
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
