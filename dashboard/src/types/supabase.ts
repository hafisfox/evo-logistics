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
          workspace_id: string;
          key: string;
          value: Numeric;
          updated_at: string | null;
        };
        Insert: {
          workspace_id: string;
          key: string;
          value: Numeric;
          updated_at?: string | null;
        };
        Update: {
          workspace_id?: string;
          key?: string;
          value?: Numeric;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          kind: "personal" | "team" | string;
          created_by: string | null;
          is_bootstrap: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          kind: "personal" | "team" | string;
          created_by?: string | null;
          is_bootstrap?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          kind?: "personal" | "team" | string;
          created_by?: string | null;
          is_bootstrap?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: "owner" | "admin" | "member" | string;
          status: "active" | "invited" | "suspended" | string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: "owner" | "admin" | "member" | string;
          status?: "active" | "invited" | "suspended" | string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          role?: "owner" | "admin" | "member" | string;
          status?: "active" | "invited" | "suspended" | string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspace_invites: {
        Row: {
          id: string;
          workspace_id: string;
          email: string;
          role: "owner" | "admin" | "member" | string;
          invited_by: string | null;
          invite_token: string;
          status: "pending" | "accepted" | "revoked" | "expired" | string;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          email: string;
          role?: "owner" | "admin" | "member" | string;
          invited_by?: string | null;
          invite_token?: string;
          status?: "pending" | "accepted" | "revoked" | "expired" | string;
          expires_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          email?: string;
          role?: "owner" | "admin" | "member" | string;
          invited_by?: string | null;
          invite_token?: string;
          status?: "pending" | "accepted" | "revoked" | "expired" | string;
          expires_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspace_mailboxes: {
        Row: {
          workspace_id: string;
          email: string;
          gmail_refresh_token_encrypted: string | null;
          gmail_access_token_encrypted: string | null;
          token_expires_at: string | null;
          status: "connected" | "disconnected" | "error" | string;
          last_error: string | null;
          watch_expiration: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          email: string;
          gmail_refresh_token_encrypted?: string | null;
          gmail_access_token_encrypted?: string | null;
          token_expires_at?: string | null;
          status?: "connected" | "disconnected" | "error" | string;
          last_error?: string | null;
          watch_expiration?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          workspace_id?: string;
          email?: string;
          gmail_refresh_token_encrypted?: string | null;
          gmail_access_token_encrypted?: string | null;
          token_expires_at?: string | null;
          status?: "connected" | "disconnected" | "error" | string;
          last_error?: string | null;
          watch_expiration?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_events: {
        Row: {
          id: number;
          workspace_id: string;
          actor_user_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          workspace_id: string;
          actor_user_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          workspace_id?: string;
          actor_user_id?: string | null;
          action?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          default_workspace_id: string | null;
          mfa_enabled: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          default_workspace_id?: string | null;
          mfa_enabled?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          default_workspace_id?: string | null;
          mfa_enabled?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      master_rfqs: {
        Row: {
          workspace_id: string;
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
          deleted_at: string | null;
          user_id?: string | null;
        };
        Insert: {
          workspace_id: string;
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
          deleted_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          workspace_id?: string;
          rfq_id?: string;
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
          deleted_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      rfq_shipments: {
        Row: {
          workspace_id: string;
          rfq_id: string;
          shipment_number: number;
          pol: string | null;
          pod: string | null;
          ready_date: string | null;
          delivery_deadline: string | null;
          service_type: string;
          pickup_address: string | null;
          delivery_address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          rfq_id: string;
          shipment_number: number;
          pol?: string | null;
          pod?: string | null;
          ready_date?: string | null;
          delivery_deadline?: string | null;
          service_type?: string;
          pickup_address?: string | null;
          delivery_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          workspace_id?: string;
          rfq_id?: string;
          shipment_number?: number;
          pol?: string | null;
          pod?: string | null;
          ready_date?: string | null;
          delivery_deadline?: string | null;
          service_type?: string;
          pickup_address?: string | null;
          delivery_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rfq_shipment_containers: {
        Row: {
          workspace_id: string;
          rfq_id: string;
          shipment_number: number;
          line_number: number;
          container_type: string;
          qty: number;
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          rfq_id: string;
          shipment_number: number;
          line_number: number;
          container_type: string;
          qty: number;
          created_at?: string;
        };
        Update: {
          workspace_id?: string;
          rfq_id?: string;
          shipment_number?: number;
          line_number?: number;
          container_type?: string;
          qty?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      agent_quotes: {
        Row: {
          id: string;
          workspace_id: string;
          rfq_id: string;
          shipment_number: number;
          match: string;
          agent_name: string;
          agent_email: string;
          carrier: string;
          price: Numeric | null;
          currency: string;
          etd: string | null;
          transit_time: number | null;
          free_time: number | null;
          validity: string | null;
          status: string;
          sent_at: string | null;
          received_at: string | null;
          raw_meta: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          rfq_id: string;
          shipment_number: number;
          match: string;
          agent_name: string;
          agent_email: string;
          carrier?: string;
          price?: Numeric | null;
          currency?: string;
          etd?: string | null;
          transit_time?: number | null;
          free_time?: number | null;
          validity?: string | null;
          status?: string;
          sent_at?: string | null;
          received_at?: string | null;
          raw_meta?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          rfq_id?: string;
          shipment_number?: number;
          match?: string;
          agent_name?: string;
          agent_email?: string;
          carrier?: string;
          price?: Numeric | null;
          currency?: string;
          etd?: string | null;
          transit_time?: number | null;
          free_time?: number | null;
          validity?: string | null;
          status?: string;
          sent_at?: string | null;
          received_at?: string | null;
          raw_meta?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      agent_outbound_log: {
        Row: {
          workspace_id: string;
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
          workspace_id: string;
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
          workspace_id?: string;
          match?: string;
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
          workspace_id: string;
          agent_name: string;
          email: string;
          status: string;
          user_id?: string | null;
        };
        Insert: {
          workspace_id: string;
          agent_name: string;
          email: string;
          status?: string;
          user_id?: string | null;
        };
        Update: {
          workspace_id?: string;
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
          workspace_id: string;
          carrier: string;
          document: Numeric;
          "20FT": Numeric;
          "40FT": Numeric;
          "40HQ": Numeric;
          user_id?: string | null;
        };
        Insert: {
          id?: number;
          workspace_id: string;
          carrier: string;
          document: Numeric;
          "20FT": Numeric;
          "40FT": Numeric;
          "40HQ": Numeric;
          user_id?: string | null;
        };
        Update: {
          id?: number;
          workspace_id?: string;
          carrier?: string;
          document?: Numeric;
          "20FT"?: Numeric;
          "40FT"?: Numeric;
          "40HQ"?: Numeric;
          user_id?: string | null;
        };
        Relationships: [];
      };
      do_charge_profiles: {
        Row: {
          id: number;
          workspace_id: string;
          carrier: string;
          document: Numeric;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          workspace_id: string;
          carrier: string;
          document: Numeric;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          workspace_id?: string;
          carrier?: string;
          document?: Numeric;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      do_charge_rates: {
        Row: {
          id: number;
          profile_id: number;
          container_type: string;
          rate: Numeric;
          created_at: string;
        };
        Insert: {
          id?: number;
          profile_id: number;
          container_type: string;
          rate: Numeric;
          created_at?: string;
        };
        Update: {
          id?: number;
          profile_id?: number;
          container_type?: string;
          rate?: Numeric;
          created_at?: string;
        };
        Relationships: [];
      };
      destination_charges: {
        Row: {
          id: number;
          workspace_id: string;
          charge_type: string;
          basis: string;
          "20FT": Numeric;
          "40FT": Numeric;
          user_id?: string | null;
        };
        Insert: {
          id?: number;
          workspace_id: string;
          charge_type: string;
          basis: string;
          "20FT": Numeric;
          "40FT": Numeric;
          user_id?: string | null;
        };
        Update: {
          id?: number;
          workspace_id?: string;
          charge_type?: string;
          basis?: string;
          "20FT"?: Numeric;
          "40FT"?: Numeric;
          user_id?: string | null;
        };
        Relationships: [];
      };
      destination_charge_items: {
        Row: {
          id: number;
          workspace_id: string;
          charge_type: string;
          basis: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          workspace_id: string;
          charge_type: string;
          basis: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          workspace_id?: string;
          charge_type?: string;
          basis?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      destination_charge_rates: {
        Row: {
          id: number;
          item_id: number;
          container_type: string;
          rate: Numeric;
          created_at: string;
        };
        Insert: {
          id?: number;
          item_id: number;
          container_type: string;
          rate: Numeric;
          created_at?: string;
        };
        Update: {
          id?: number;
          item_id?: number;
          container_type?: string;
          rate?: Numeric;
          created_at?: string;
        };
        Relationships: [];
      };
      transportation_charges: {
        Row: {
          id: number;
          workspace_id: string;
          place: string;
          price: Numeric;
          user_id?: string | null;
        };
        Insert: {
          id?: number;
          workspace_id: string;
          place: string;
          price: Numeric;
          user_id?: string | null;
        };
        Update: {
          id?: number;
          workspace_id?: string;
          place?: string;
          price?: Numeric;
          user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      v_do_charges_legacy: {
        Row: {
          id: number;
          workspace_id: string;
          carrier: string;
          document: Numeric;
          "20FT": Numeric | null;
          "40FT": Numeric | null;
          "40HQ": Numeric | null;
        };
        Relationships: [];
      };
      v_destination_charges_legacy: {
        Row: {
          id: number;
          workspace_id: string;
          charge_type: string;
          basis: string;
          "20FT": Numeric | null;
          "40FT": Numeric | null;
        };
        Relationships: [];
      };
      v_master_rfq_legacy_projection: {
        Row: {
          workspace_id: string;
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
          service_type: string | null;
          pickup_address: string | null;
          delivery_address: string | null;
          received_at: string;
          selected_agent: string | null;
          final_price_usd: Numeric | null;
          final_price_aed: Numeric | null;
          quoted_at: string | null;
          deleted_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
