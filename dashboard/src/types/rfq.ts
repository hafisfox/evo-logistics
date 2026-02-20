export type RFQStatus =
  | "Processing"
  | "Missing_Port_Data"
  | "Missing_Door_Data"
  | "Parse_Error"
  | "Selected"
  | "Quoted";

export type QuoteStatus = "Requested" | "Received" | "Invalid_Quote";

export type ServiceType =
  | "port-to-port"
  | "door-to-port"
  | "port-to-door"
  | "door-to-door";

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
  service_type: ServiceType;
  pickup_address: string | null;
  delivery_address: string | null;
  received_at: string;
  selected_agent: string | null;
  final_price_usd: string | null;
  final_price_aed: string | null;
  quoted_at: string | null;
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
}

export interface RFQDetail extends MasterRFQ {
  quotes: AgentQuote[];
}

export interface SelectAgentPayload {
  rfq_id: string;
  selected_agent: string;
  selected_carrier: string;
  shipment_number: string;
  selected_by: string;
}

export interface SelectAgentResponse {
  success: boolean;
  rfq_id: string;
  final_price_aed: number;
  final_price_usd: number;
}
