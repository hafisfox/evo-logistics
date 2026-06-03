"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FEATURE_AIR_FREIGHT_ENABLED,
  FEATURE_LAND_FREIGHT_ENABLED,
  KANBAN_COLUMNS,
} from "@/lib/constants";
import { MODE_META } from "./mode-icon";
import { cn } from "@/lib/utils";
import type { FreightMode } from "@/types/rfq";
import { Search } from "lucide-react";

interface RFQFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  serviceFilter: string;
  onServiceFilterChange: (value: string) => void;
  modeFilter: string;
  onModeFilterChange: (value: string) => void;
}

export function RFQFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  serviceFilter,
  onServiceFilterChange,
  modeFilter,
  onModeFilterChange,
}: RFQFiltersProps) {
  const showModeFilter = FEATURE_AIR_FREIGHT_ENABLED || FEATURE_LAND_FREIGHT_ENABLED;
  const modeOptions: Array<{ value: string; label: string; mode?: FreightMode }> = [
    { value: "all", label: "All" },
    { value: "ocean", label: "Ocean", mode: "ocean" },
    ...(FEATURE_AIR_FREIGHT_ENABLED
      ? [{ value: "air", label: "Air", mode: "air" as FreightMode }]
      : []),
    ...(FEATURE_LAND_FREIGHT_ENABLED
      ? [{ value: "land", label: "Land", mode: "land" as FreightMode }]
      : []),
  ];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 w-full sm:min-w-[200px] sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search RFQ ID, customer email, route..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {KANBAN_COLUMNS.map((s) => (
            <SelectItem key={s} value={s}>
              {s.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={serviceFilter} onValueChange={onServiceFilterChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Services" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Services</SelectItem>
          <SelectItem value="port-to-port">Port to Port</SelectItem>
          <SelectItem value="door-to-port">Door to Port</SelectItem>
          <SelectItem value="port-to-door">Port to Door</SelectItem>
          <SelectItem value="door-to-door">Door to Door</SelectItem>
        </SelectContent>
      </Select>
      {showModeFilter && (
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-card/60 p-1 backdrop-blur-xl">
          {modeOptions.map((opt) => {
            const active = modeFilter === opt.value;
            const meta = opt.mode ? MODE_META[opt.mode] : null;
            const Icon = meta?.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onModeFilterChange(opt.value)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
                )}
              >
                {Icon ? <Icon className={cn("h-3.5 w-3.5", active ? "" : meta?.className)} /> : null}
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
