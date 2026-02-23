"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RouteDisplay } from "@/components/ui/route-display";
import { ContainerBadge } from "@/components/ui/container-badge";
import { StatusBadge } from "@/components/rfqs/status-badge";
import { formatDate } from "@/lib/utils";
import { buildLegacyShipmentsFromRFQ } from "@/lib/rfq-normalization";
import type { MasterRFQ } from "@/types/rfq";
import { MapPin, Calendar, Truck } from "lucide-react";

interface ShipmentCardProps {
  rfq: MasterRFQ;
}

export function ShipmentCard({ rfq }: ShipmentCardProps) {
  const shipments =
    rfq.shipments && rfq.shipments.length > 0
      ? rfq.shipments
      : buildLegacyShipmentsFromRFQ(rfq);

  return (
    <Card className="rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 dark:bg-card/40 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(255,255,255,0.03)] overflow-hidden">
      <CardHeader className="pb-4 px-6 pt-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold tracking-tight">Shipment Details</CardTitle>
          <StatusBadge status={rfq.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-6 pb-6">
        <div className="space-y-3">
          {shipments.map((shipment) => (
            <div
              key={shipment.shipment_number}
              className="rounded-2xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/20 px-4 py-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Shipment {shipment.shipment_number}
                </p>
                <span className="text-xs font-medium text-muted-foreground">
                  {shipment.service_type}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Route</p>
                  <RouteDisplay shipments={[shipment]} showShipmentCount={false} />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Containers</p>
                  <ContainerBadge shipments={[shipment]} maxChips={6} />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Ready Date</p>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-sm font-medium">{formatDate(shipment.ready_date)}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Delivery Deadline</p>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-red-500" />
                    <p className="text-sm font-medium text-red-600">
                      {formatDate(shipment.delivery_deadline)}
                    </p>
                  </div>
                </div>
              </div>

              {shipment.pickup_address || shipment.delivery_address ? (
                <div className="mt-4 grid grid-cols-1 gap-4 border-t pt-3 md:grid-cols-2">
                  {shipment.pickup_address ? (
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Pickup</p>
                        <p className="text-sm">{shipment.pickup_address}</p>
                      </div>
                    </div>
                  ) : null}
                  {shipment.delivery_address ? (
                    <div className="flex items-start gap-2">
                      <Truck className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Delivery</p>
                        <p className="text-sm">{shipment.delivery_address}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 pt-2 border-t text-sm">
          <div>
            <span className="text-muted-foreground">Customer: </span>
            <span className="font-medium">{rfq.customer_email}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Received: </span>
            <span>{formatDate(rfq.received_at)}</span>
          </div>
          {rfq.selected_agent ? (
            <div>
              <span className="text-muted-foreground">Agent: </span>
              <span className="font-medium">{rfq.selected_agent}</span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
