import { Badge } from "@/components/ui/badge";
import { parseMultiValue } from "@/lib/utils";
import type { RFQShipment } from "@/types/rfq";

interface ContainerBadgeProps {
  type?: string | null;
  qty?: string | null;
  shipments?: RFQShipment[];
  maxChips?: number;
}

function buildLegacyChips(type?: string | null, qty?: string | null): string[] {
  const types = parseMultiValue(type || "");
  const qtys = parseMultiValue(qty || "");
  return types.map((containerType, index) => `${qtys[index] || qtys[0] || "1"}×${containerType}`);
}

function buildShipmentChips(shipments: RFQShipment[]): string[] {
  return shipments.flatMap((shipment) =>
    shipment.containers.map(
      (container) => `${container.qty || 1}×${container.container_type || "40HQ"}`
    )
  );
}

export function ContainerBadge({ type, qty, shipments, maxChips = 5 }: ContainerBadgeProps) {
  const chips =
    shipments && shipments.length > 0 ? buildShipmentChips(shipments) : buildLegacyChips(type, qty);
  const visible = chips.slice(0, maxChips);
  const hiddenCount = Math.max(chips.length - visible.length, 0);

  return (
    <span className="inline-flex flex-wrap gap-1">
      {visible.map((label, index) => (
        <Badge key={`${label}-${index}`} variant="outline" className="text-xs font-mono">
          {label}
        </Badge>
      ))}
      {hiddenCount > 0 ? (
        <Badge variant="outline" className="text-xs font-semibold">
          +{hiddenCount}
        </Badge>
      ) : null}
    </span>
  );
}
