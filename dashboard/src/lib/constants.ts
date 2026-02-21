export const USD_TO_AED = 3.685;
export const MARGIN = 0.13;
export const QUOTE_THRESHOLD = 2;



export const CARRIERS = [
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
] as const;

export const CONTAINER_TYPES = [
  "20FT",
  "40FT",
  "40HC",
  "40HQ",
  "45FT",
  "20OT",
  "40OT",
] as const;

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
    color: "#22C55E",
    bgClass: "bg-green-100",
    textClass: "text-green-800",
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
