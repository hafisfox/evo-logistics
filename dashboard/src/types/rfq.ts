export type RFQStatus =
  | "Processing"
  | "Missing_Port_Data"
  | "Missing_Door_Data"
  | "Parse_Error"
  | "Selected"
  | "Quoted"
  | "Reminded"
  | "Followed_Up"
  | "Customer_Replied"
  | "Cancelled"
  | "On_Hold"
  | "Expired";

export type QuoteStatus = "Requested" | "Reminded" | "Received" | "Invalid_Quote" | "Expired";

export type ServiceType =
  | "port-to-port"
  | "door-to-port"
  | "port-to-door"
  | "door-to-door";

export type FreightMode = "ocean" | "air" | "land";

export type Incoterms =
  | "EXW" | "FCA" | "FAS" | "FOB"
  | "CFR" | "CIF" | "CPT" | "CIP"
  | "DAP" | "DPU" | "DDP";

export interface RFQShipmentContainer {
  line_number: number;
  container_type: string;
  qty: number;
}

export interface RFQShipment {
  shipment_number: number;
  pol: string;
  pod: string;
  ready_date: string | null;
  delivery_deadline: string | null;
  service_type: ServiceType;
  pickup_address: string | null;
  delivery_address: string | null;
  containers: RFQShipmentContainer[];
  // Ocean freight fields
  commodity_description: string | null;
  hs_code: string | null;
  incoterms: Incoterms | null;
  is_dangerous_goods: boolean;
  dg_class: string | null;
  is_reefer: boolean;
  reefer_temperature: number | null;
  special_requirements: string | null;
  cargo_weight_kg: number | null;
  cargo_volume_cbm: number | null;
  freight_mode: FreightMode;
}

export interface QuoteSurcharges {
  BAF?: number;
  CAF?: number;
  THC?: number;
  PSS?: number;
  GRI?: number;
  ISPS?: number;
  ORC?: number;
  war_risk?: number;
  congestion?: number;
  [key: string]: number | undefined;
}

export interface FreeTimeDetails {
  demurrage_days?: number | null;
  detention_days?: number | null;
  combined_days?: number | null;
}

export interface MasterRFQ {
  rfq_id: string;
  thread_id: string;
  customer_email: string;
  status: RFQStatus;
  pol: string;
  pod: string;
  container_type: string;
  qty: string;
  ready_date: string;
  delivery_deadline: string | null;
  service_type: ServiceType;
  pickup_address: string | null;
  delivery_address: string | null;
  received_at: string;
  selected_agent: string | null;
  final_price_usd: string | null;
  final_price_aed: string | null;
  quoted_at: string | null;
  shipments?: RFQShipment[];
  shipment_count?: number;
  deleted_at?: string | null;
  // New aggregated fields
  commodity_description?: string | null;
  hs_code?: string | null;
  incoterms?: Incoterms | null;
  is_dangerous_goods?: boolean;
  is_reefer?: boolean;
  freight_mode?: FreightMode;
}

export interface AgentQuote {
  rfq_id: string;
  match: string;
  agent_name: string;
  agent_email: string;
  shipment_number: string;
  carrier: string;
  price: string;
  currency: string;
  etd: string;
  transit_time: string;
  free_time: string;
  validity: string;
  status: QuoteStatus;
  sent_at: string;
  received_at: string;
  // New fields
  surcharges: QuoteSurcharges | null;
  free_time_details: FreeTimeDetails | null;
  validity_date: string | null;
  conditions: string | null;
  freight_mode: FreightMode;
}

export interface RFQDetail extends MasterRFQ {
  quotes: AgentQuote[];
}

export interface RFQNote {
  id: string;
  rfq_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  entity_type: "rfq" | "quote" | "agent" | "pricing";
  entity_id: string;
  action: string;
  actor_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
  created_at: string;
}

export interface SelectAgentPayload {
  rfq_id: string;
  selected_agent: string;
  selected_match: string;
  selected_carrier: string;
  shipment_number: string;
  selected_by: string;
}

export interface SelectAgentResponse {
  success: boolean;
  rfq_id: string;
  final_price_aed: number;
  final_price_usd: number;
  error?: string;
}
