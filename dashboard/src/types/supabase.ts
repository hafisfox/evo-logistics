export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Numeric = number | string;

export interface Database {
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string;
          value: Numeric;
          updated_at: string | null;
        };
        Insert: {
          key: string;
          value: Numeric;
          updated_at?: string | null;
        };
        Update: {
          key?: string;
          value?: Numeric;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      master_rfqs: {
        Row: {
          rfq_id: string;
          thread_id: string;
          customer_email: string;
          status: string;
          pol: string | null;
          pod: string | null;
          container_type: string | null;
          qty: string | null;
          ready_date: string | null;
          delivery_deadline: string | null;
          service_type: string;
          pickup_address: string | null;
          delivery_address: string | null;
          received_at: string;
          selected_agent: string | null;
          final_price_usd: Numeric | null;
          final_price_aed: Numeric | null;
          quoted_at: string | null;
          user_id?: string | null;
        };
        Insert: {
          rfq_id: string;
          thread_id: string;
          customer_email: string;
          service_type: string;
          status?: string;
          pol?: string | null;
          pod?: string | null;
          container_type?: string | null;
          qty?: string | null;
          ready_date?: string | null;
          delivery_deadline?: string | null;
          pickup_address?: string | null;
          delivery_address?: string | null;
          received_at?: string;
          selected_agent?: string | null;
          final_price_usd?: Numeric | null;
          final_price_aed?: Numeric | null;
          quoted_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          thread_id?: string;
          customer_email?: string;
          status?: string;
          pol?: string | null;
          pod?: string | null;
          container_type?: string | null;
          qty?: string | null;
          ready_date?: string | null;
          delivery_deadline?: string | null;
          service_type?: string;
          pickup_address?: string | null;
          delivery_address?: string | null;
          received_at?: string;
          selected_agent?: string | null;
          final_price_usd?: Numeric | null;
          final_price_aed?: Numeric | null;
          quoted_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      agent_outbound_log: {
        Row: {
          match: string;
          rfq_id: string;
          agent_name: string;
          agent_email: string;
          shipment_number: string;
          carrier: string;
          price: Numeric | null;
          currency: string;
          etd: string | null;
          transit_time: string | null;
          free_time: string | null;
          validity: string | null;
          status: string;
          sent_at: string;
          received_at: string | null;
          user_id?: string | null;
        };
        Insert: {
          match: string;
          rfq_id: string;
          agent_name: string;
          agent_email: string;
          shipment_number: string;
          carrier: string;
          price?: Numeric | null;
          currency?: string;
          etd?: string | null;
          transit_time?: string | null;
          free_time?: string | null;
          validity?: string | null;
          status?: string;
          sent_at?: string;
          received_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          rfq_id?: string;
          agent_name?: string;
          agent_email?: string;
          shipment_number?: string;
          carrier?: string;
          price?: Numeric | null;
          currency?: string;
          etd?: string | null;
          transit_time?: string | null;
          free_time?: string | null;
          validity?: string | null;
          status?: string;
          sent_at?: string;
          received_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      agents: {
        Row: {
          agent_name: string;
          email: string;
          status: string;
          user_id?: string | null;
        };
        Insert: {
          agent_name: string;
          email: string;
          status?: string;
          user_id?: string | null;
        };
        Update: {
          agent_name?: string;
          email?: string;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      do_charges: {
        Row: {
          id: number;
          carrier: string;
          document: Numeric;
          "20FT": Numeric;
          "40FT": Numeric;
          "40HQ": Numeric;
          user_id?: string | null;
        };
        Insert: {
          id?: number;
          carrier: string;
          document: Numeric;
          "20FT": Numeric;
          "40FT": Numeric;
          "40HQ": Numeric;
          user_id?: string | null;
        };
        Update: {
          id?: number;
          carrier?: string;
          document?: Numeric;
          "20FT"?: Numeric;
          "40FT"?: Numeric;
          "40HQ"?: Numeric;
          user_id?: string | null;
        };
        Relationships: [];
      };
      destination_charges: {
        Row: {
          id: number;
          charge_type: string;
          basis: string;
          "20FT": Numeric;
          "40FT": Numeric;
          user_id?: string | null;
        };
        Insert: {
          id?: number;
          charge_type: string;
          basis: string;
          "20FT": Numeric;
          "40FT": Numeric;
          user_id?: string | null;
        };
        Update: {
          id?: number;
          charge_type?: string;
          basis?: string;
          "20FT"?: Numeric;
          "40FT"?: Numeric;
          user_id?: string | null;
        };
        Relationships: [];
      };
      transportation_charges: {
        Row: {
          id: number;
          place: string;
          price: Numeric;
          user_id?: string | null;
        };
        Insert: {
          id?: number;
          place: string;
          price: Numeric;
          user_id?: string | null;
        };
        Update: {
          id?: number;
          place?: string;
          price?: Numeric;
          user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
