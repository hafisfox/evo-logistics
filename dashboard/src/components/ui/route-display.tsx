import { ArrowRight } from "lucide-react";
import { parseMultiValue } from "@/lib/utils";
import type { RFQShipment } from "@/types/rfq";

interface RouteDisplayProps {
  pol?: string | null;
  pod?: string | null;
  shipments?: RFQShipment[];
  showShipmentCount?: boolean;
}

export function RouteDisplay({
  pol,
  pod,
  shipments,
  showShipmentCount = true,
}: RouteDisplayProps) {
  const firstShipment = shipments?.[0];
  const polFirst = firstShipment?.pol || parseMultiValue(pol || "")[0] || "—";
  const podFirst = firstShipment?.pod || parseMultiValue(pod || "")[0] || "—";
  const inferredShipmentCount =
    shipments?.length ||
    Math.max(parseMultiValue(pol || "").length, parseMultiValue(pod || "").length, 1);
  const extraShipments = Math.max(inferredShipmentCount - 1, 0);

  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className="font-medium">{polFirst}</span>
      <ArrowRight className="h-3 w-3 text-muted-foreground" />
      <span className="font-medium">{podFirst}</span>
      {showShipmentCount && extraShipments > 0 ? (
        <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          +{extraShipments} shipments
        </span>
      ) : null}
    </span>
  );
}
