import type { FreightMode } from "@/types/rfq";

export const USD_TO_AED = 3.685;
export const MARGIN = 0.13;
export const QUOTE_THRESHOLD = 2;

// Feature flags — gate air/land modes in UI
export const FEATURE_AIR_FREIGHT_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_AIR_FREIGHT === "true";
export const FEATURE_LAND_FREIGHT_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_LAND_FREIGHT === "true";

// Mode-keyed carrier lists
export const CARRIERS_BY_MODE: Record<FreightMode, readonly string[]> = {
  ocean: [
    "COSCO",
    "MAERSK",
    "EVERGREEN",
    "MSC",
    "ONE",
    "HAPAG-LLOYD",
    "CMA CGM",
    "YANG MING",
    "HMM",
    "ZIM",
    "PIL",
  ],
  air: [
    "EMIRATES SKYCARGO",
    "QATAR AIRWAYS CARGO",
    "ETIHAD CARGO",
    "LUFTHANSA CARGO",
    "TURKISH CARGO",
    "SINGAPORE AIRLINES CARGO",
    "CATHAY CARGO",
    "KOREAN AIR CARGO",
    "CARGOLUX",
    "FEDEX",
    "DHL EXPRESS",
  ],
  land: [
    "ARAMEX",
    "HALA TRANSPORT",
    "TRISTAR",
    "AL FUTTAIM LOGISTICS",
    "GULF AGENCY COMPANY",
    "AGILITY",
  ],
} as const;

// Mode-keyed equipment/unit types
export const EQUIPMENT_BY_MODE: Record<FreightMode, readonly string[]> = {
  ocean: [
    "20FT",
    "40FT",
    "40HC",
    "40HQ",
    "45FT",
    "20OT",
    "40OT",
    "20RF",
    "40RF",
  ],
  air: ["PALLET", "BOX", "SKID", "LOOSE", "CRATE", "CARTON", "DRUM"],
  land: ["DRY VAN", "FLATBED", "REEFER", "TANKER", "LOWBED", "CURTAINSIDE"],
} as const;

// Mode-keyed service types
export const SERVICE_TYPES_BY_MODE: Record<FreightMode, readonly string[]> = {
  ocean: ["port-to-port", "door-to-port", "port-to-door", "door-to-door"],
  air: [
    "airport-to-airport",
    "door-to-airport",
    "airport-to-door",
    "door-to-door",
  ],
  land: [
    "door-to-door",
    "terminal-to-terminal",
    "door-to-terminal",
    "terminal-to-door",
  ],
} as const;

// Backward-compat aliases (ocean-only references throughout codebase)
export const CARRIERS = CARRIERS_BY_MODE.ocean;
export const CONTAINER_TYPES = EQUIPMENT_BY_MODE.ocean;

export const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgClass: string; textClass: string }
> = {
  Processing: {
    label: "Processing",
    color: "#3B82F6",
    bgClass: "bg-blue-100",
    textClass: "text-blue-800",
  },
  Missing_Port_Data: {
    label: "Missing Port Data",
    color: "#F97316",
    bgClass: "bg-orange-100",
    textClass: "text-orange-800",
  },
  Missing_Door_Data: {
    label: "Missing Door Data",
    color: "#F97316",
    bgClass: "bg-orange-100",
    textClass: "text-orange-800",
  },
  Parse_Error: {
    label: "Parse Error",
    color: "#EF4444",
    bgClass: "bg-red-100",
    textClass: "text-red-800",
  },
  Selected: {
    label: "Selected",
    color: "#8B5CF6",
    bgClass: "bg-purple-100",
    textClass: "text-purple-800",
  },
  Quoted: {
    label: "Quoted",
    color: "#22D3EE",
    bgClass: "bg-cyan-500/10",
    textClass: "text-cyan-400",
  },
  Followed_Up: {
    label: "Followed Up",
    color: "#14B8A6",
    bgClass: "bg-teal-100",
    textClass: "text-teal-800",
  },
  Customer_Replied: {
    label: "Customer Replied",
    color: "#6366F1",
    bgClass: "bg-indigo-100",
    textClass: "text-indigo-800",
  },
  Requested: {
    label: "Requested",
    color: "#64748B",
    bgClass: "bg-slate-100",
    textClass: "text-slate-800",
  },
  Reminded: {
    label: "Reminded",
    color: "#EAB308",
    bgClass: "bg-yellow-100",
    textClass: "text-yellow-800",
  },
  Received: {
    label: "Received",
    color: "#10B981",
    bgClass: "bg-emerald-100",
    textClass: "text-emerald-800",
  },
  Invalid_Quote: {
    label: "Invalid Quote",
    color: "#EF4444",
    bgClass: "bg-red-100",
    textClass: "text-red-800",
  },
  Cancelled: {
    label: "Cancelled",
    color: "#6B7280",
    bgClass: "bg-gray-100",
    textClass: "text-gray-800",
  },
  On_Hold: {
    label: "On Hold",
    color: "#F59E0B",
    bgClass: "bg-amber-100",
    textClass: "text-amber-800",
  },
  Expired: {
    label: "Expired",
    color: "#9CA3AF",
    bgClass: "bg-gray-100",
    textClass: "text-gray-500",
  },
};

export const KANBAN_COLUMNS = [
  "Processing",
  "Missing_Port_Data",
  "Missing_Door_Data",
  "Parse_Error",
  "Reminded",
  "Selected",
  "Quoted",
  "Followed_Up",
  "Customer_Replied",
] as const;
