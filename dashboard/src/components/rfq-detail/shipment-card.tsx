"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RouteDisplay } from "@/components/ui/route-display";
import { ContainerBadge } from "@/components/ui/container-badge";
import { StatusBadge } from "@/components/rfqs/status-badge";
import { formatDate } from "@/lib/utils";
import type { MasterRFQ } from "@/types/rfq";
import { MapPin, Calendar, Truck } from "lucide-react";

interface ShipmentCardProps {
  rfq: MasterRFQ;
}

export function ShipmentCard({ rfq }: ShipmentCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Shipment Details</CardTitle>
          <StatusBadge status={rfq.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Route</p>
            <RouteDisplay pol={rfq.pol} pod={rfq.pod} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Containers</p>
            <ContainerBadge type={rfq.container_type} qty={rfq.qty} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Service Type</p>
            <p className="text-sm font-medium">{rfq.service_type}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Ready Date</p>
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-sm font-medium">{formatDate(rfq.ready_date)}</p>
            </div>
          </div>
        </div>

        {(rfq.pickup_address || rfq.delivery_address) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
            {rfq.pickup_address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="text-sm">{rfq.pickup_address}</p>
                </div>
              </div>
            )}
            {rfq.delivery_address && (
              <div className="flex items-start gap-2">
                <Truck className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Delivery</p>
                  <p className="text-sm">{rfq.delivery_address}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 pt-2 border-t text-sm">
          <div>
            <span className="text-muted-foreground">Customer: </span>
            <span className="font-medium">{rfq.customer_email}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Received: </span>
            <span>{formatDate(rfq.received_at)}</span>
          </div>
          {rfq.selected_agent && (
            <div>
              <span className="text-muted-foreground">Agent: </span>
              <span className="font-medium">{rfq.selected_agent}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
