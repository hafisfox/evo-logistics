import { Plane, Ship, Truck, type LucideIcon } from "lucide-react";
import type { FreightMode } from "@/types/rfq";

export const MODE_META: Record<FreightMode, { label: string; icon: LucideIcon; className: string }> = {
  ocean: { label: "Ocean", icon: Ship, className: "text-blue-500" },
  air: { label: "Air", icon: Plane, className: "text-sky-500" },
  land: { label: "Land", icon: Truck, className: "text-amber-500" },
};

export function modeMeta(mode?: FreightMode | null) {
  return MODE_META[(mode ?? "ocean") as FreightMode] ?? MODE_META.ocean;
}

/** Freight-mode glyph (Ship/Plane/Truck) used on RFQ rows and kanban cards. */
export function ModeIcon({
  mode,
  className = "h-4 w-4",
}: {
  mode?: FreightMode | null;
  className?: string;
}) {
  const meta = modeMeta(mode);
  const Icon = meta.icon;
  return (
    <Icon role="img" aria-label={`${meta.label} freight`} className={`${meta.className} ${className}`}>
      <title>{`${meta.label} freight`}</title>
    </Icon>
  );
}
