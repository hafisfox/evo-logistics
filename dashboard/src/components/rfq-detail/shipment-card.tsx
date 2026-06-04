"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RouteDisplay } from "@/components/ui/route-display";
import { ContainerBadge } from "@/components/ui/container-badge";
import { StatusBadge } from "@/components/rfqs/status-badge";
import { formatDate } from "@/lib/utils";
import { buildLegacyShipmentsFromRFQ } from "@/lib/rfq-normalization";
import { ModeIcon, modeMeta } from "@/components/rfqs/mode-icon";
import { calculateChargeableWeight, totalChargeableWeight } from "@/lib/dim-weight";
import type { MasterRFQ } from "@/types/rfq";
import {
  MapPin, Calendar, Truck, Package, AlertTriangle, Thermometer, Scale, FileText,
} from "lucide-react";

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
          {shipments.map((shipment) => {
            const mode = shipment.freight_mode ?? "ocean";
            const pieces = shipment.pieces ?? [];
            const chargeableWeight =
              mode === "air" && pieces.length > 0 ? totalChargeableWeight(pieces) : 0;
            return (
            <div
              key={shipment.shipment_number}
              className="rounded-2xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/20 px-4 py-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <ModeIcon mode={mode} className="h-3.5 w-3.5" />
                  Shipment {shipment.shipment_number}
                  <span className="text-muted-foreground/70">· {modeMeta(mode).label}</span>
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
                  <p className="mb-1 text-xs text-muted-foreground">
                    {mode === "air" ? "Chargeable Wt" : "Containers"}
                  </p>
                  {mode === "air" ? (
                    <p className="text-sm font-medium">
                      {chargeableWeight > 0 ? `${chargeableWeight.toLocaleString()} kg` : "—"}
                    </p>
                  ) : (
                    <ContainerBadge shipments={[shipment]} maxChips={6} />
                  )}
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

              {/* Cargo Detail Fields */}
              {(shipment.commodity_description || shipment.is_dangerous_goods || shipment.is_reefer || shipment.incoterms || shipment.cargo_weight_kg || shipment.cargo_volume_cbm || shipment.hs_code || shipment.special_requirements) ? (
                <div className="mt-4 border-t pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Cargo Details</p>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {shipment.commodity_description ? (
                      <div className="flex items-start gap-1.5">
                        <Package className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Commodity</p>
                          <p className="text-sm font-medium">{shipment.commodity_description}</p>
                        </div>
                      </div>
                    ) : null}
                    {shipment.hs_code ? (
                      <div className="flex items-start gap-1.5">
                        <FileText className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">HS Code</p>
                          <p className="text-sm font-medium font-mono">{shipment.hs_code}</p>
                        </div>
                      </div>
                    ) : null}
                    {mode !== "air" && shipment.incoterms ? (
                      <div>
                        <p className="text-xs text-muted-foreground">Incoterms</p>
                        <span className="inline-block mt-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                          {shipment.incoterms}
                        </span>
                      </div>
                    ) : null}
                    {shipment.is_dangerous_goods ? (
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Dangerous Goods</p>
                          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                            {shipment.dg_class ? `IMO Class ${shipment.dg_class}` : "Yes"}
                          </p>
                        </div>
                      </div>
                    ) : null}
                    {mode !== "air" && shipment.is_reefer ? (
                      <div className="flex items-start gap-1.5">
                        <Thermometer className="mt-0.5 h-3.5 w-3.5 text-cyan-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Reefer</p>
                          <p className="text-sm font-medium text-cyan-600 dark:text-cyan-400">
                            {shipment.reefer_temperature != null ? `${shipment.reefer_temperature}°C` : "Yes"}
                          </p>
                        </div>
                      </div>
                    ) : null}
                    {shipment.cargo_weight_kg ? (
                      <div className="flex items-start gap-1.5">
                        <Scale className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Weight</p>
                          <p className="text-sm font-medium">{Number(shipment.cargo_weight_kg).toLocaleString()} kg</p>
                        </div>
                      </div>
                    ) : null}
                    {shipment.cargo_volume_cbm ? (
                      <div>
                        <p className="text-xs text-muted-foreground">Volume</p>
                        <p className="text-sm font-medium">{Number(shipment.cargo_volume_cbm).toLocaleString()} CBM</p>
                      </div>
                    ) : null}
                  </div>
                  {shipment.special_requirements ? (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">Special Requirements</p>
                      <p className="text-sm mt-0.5 text-amber-700 dark:text-amber-300">{shipment.special_requirements}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {mode === "air" && pieces.length > 0 ? (
                <div className="mt-4 border-t pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pieces &amp; Dimensions
                  </p>
                  <div className="space-y-1.5">
                    {pieces.map((piece) => {
                      const cw =
                        piece.length_cm && piece.width_cm && piece.height_cm
                          ? calculateChargeableWeight(
                              piece.weight_kg ?? 0,
                              piece.length_cm,
                              piece.width_cm,
                              piece.height_cm
                            )
                          : piece.weight_kg ?? 0;
                      return (
                        <div
                          key={piece.piece_number}
                          className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm"
                        >
                          <span className="flex items-center gap-1 font-medium">
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                            {piece.count ?? 1}×
                          </span>
                          {piece.packaging_type ? (
                            <span className="text-muted-foreground">{piece.packaging_type}</span>
                          ) : null}
                          <span className="font-mono text-xs text-muted-foreground">
                            {piece.length_cm ?? "?"}×{piece.width_cm ?? "?"}×{piece.height_cm ?? "?"} cm
                          </span>
                          {piece.weight_kg != null ? (
                            <span className="text-xs text-muted-foreground">{piece.weight_kg} kg actual</span>
                          ) : null}
                          <span className="text-xs font-medium text-sky-600 dark:text-sky-400">
                            {(Math.round(cw * 100) / 100).toLocaleString()} kg ch.
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Total chargeable weight:{" "}
                    <span className="font-semibold text-foreground">
                      {chargeableWeight.toLocaleString()} kg
                    </span>
                  </p>
                </div>
              ) : null}

              {mode === "land" && shipment.truck_detail ? (
                <div className="mt-4 border-t pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Truck Details
                  </p>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {shipment.truck_detail.load_type ? (
                      <div>
                        <p className="text-xs text-muted-foreground">Load Type</p>
                        <span className="inline-block mt-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          {shipment.truck_detail.load_type}
                        </span>
                      </div>
                    ) : null}
                    {shipment.truck_detail.equipment_type ? (
                      <div className="flex items-start gap-1.5">
                        <Truck className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Equipment</p>
                          <p className="text-sm font-medium">{shipment.truck_detail.equipment_type}</p>
                        </div>
                      </div>
                    ) : null}
                    {shipment.truck_detail.weight_lbs != null ? (
                      <div>
                        <p className="text-xs text-muted-foreground">Weight</p>
                        <p className="text-sm font-medium font-mono">
                          {shipment.truck_detail.weight_lbs.toLocaleString()} lbs
                        </p>
                      </div>
                    ) : null}
                    {shipment.truck_detail.nmfc_class ? (
                      <div>
                        <p className="text-xs text-muted-foreground">NMFC Class</p>
                        <p className="text-sm font-medium font-mono">{shipment.truck_detail.nmfc_class}</p>
                      </div>
                    ) : null}
                    {shipment.truck_detail.origin_zip || shipment.truck_detail.destination_zip ? (
                      <div>
                        <p className="text-xs text-muted-foreground">ZIP Lane</p>
                        <p className="text-sm font-medium font-mono">
                          {shipment.truck_detail.origin_zip ?? "?"} → {shipment.truck_detail.destination_zip ?? "?"}
                        </p>
                      </div>
                    ) : null}
                    {shipment.truck_detail.accessorials && shipment.truck_detail.accessorials.length > 0 ? (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Accessorials</p>
                        <p className="text-sm">{shipment.truck_detail.accessorials.join(", ")}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            );
          })}
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
