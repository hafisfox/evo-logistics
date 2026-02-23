export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agent_outbound_log: {
        Row: {
          agent_email: string
          agent_name: string
          carrier: string
          currency: string
          etd: string | null
          free_time: number | null
          match: string
          price: number | null
          received_at: string | null
          rfq_id: string
          sent_at: string
          shipment_number: string
          status: Database["public"]["Enums"]["quote_status"]
          transit_time: number | null
          user_id: string | null
          validity: string | null
          workspace_id: string
        }
        Insert: {
          agent_email: string
          agent_name: string
          carrier: string
          currency?: string
          etd?: string | null
          free_time?: number | null
          match: string
          price?: number | null
          received_at?: string | null
          rfq_id: string
          sent_at?: string
          shipment_number: string
          status?: Database["public"]["Enums"]["quote_status"]
          transit_time?: number | null
          user_id?: string | null
          validity?: string | null
          workspace_id: string
        }
        Update: {
          agent_email?: string
          agent_name?: string
          carrier?: string
          currency?: string
          etd?: string | null
          free_time?: number | null
          match?: string
          price?: number | null
          received_at?: string | null
          rfq_id?: string
          sent_at?: string
          shipment_number?: string
          status?: Database["public"]["Enums"]["quote_status"]
          transit_time?: number | null
          user_id?: string | null
          validity?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_outbound_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_outbound_log_workspace_rfq_id_fkey"
            columns: ["workspace_id", "rfq_id"]
            isOneToOne: false
            referencedRelation: "master_rfqs"
            referencedColumns: ["workspace_id", "rfq_id"]
          },
          {
            foreignKeyName: "agent_outbound_log_workspace_rfq_id_fkey"
            columns: ["workspace_id", "rfq_id"]
            isOneToOne: false
            referencedRelation: "v_master_rfq_legacy_projection"
            referencedColumns: ["workspace_id", "rfq_id"]
          },
        ]
      }
      agent_quotes: {
        Row: {
          agent_email: string
          agent_name: string
          carrier: string
          created_at: string
          currency: string
          etd: string | null
          free_time: number | null
          id: string
          match: string
          price: number | null
          raw_meta: Json
          received_at: string | null
          rfq_id: string
          sent_at: string | null
          shipment_number: number
          status: Database["public"]["Enums"]["quote_status"]
          transit_time: number | null
          updated_at: string
          validity: string | null
          workspace_id: string
        }
        Insert: {
          agent_email: string
          agent_name: string
          carrier: string
          created_at?: string
          currency?: string
          etd?: string | null
          free_time?: number | null
          id?: string
          match: string
          price?: number | null
          raw_meta?: Json
          received_at?: string | null
          rfq_id: string
          sent_at?: string | null
          shipment_number: number
          status?: Database["public"]["Enums"]["quote_status"]
          transit_time?: number | null
          updated_at?: string
          validity?: string | null
          workspace_id: string
        }
        Update: {
          agent_email?: string
          agent_name?: string
          carrier?: string
          created_at?: string
          currency?: string
          etd?: string | null
          free_time?: number | null
          id?: string
          match?: string
          price?: number | null
          raw_meta?: Json
          received_at?: string | null
          rfq_id?: string
          sent_at?: string | null
          shipment_number?: number
          status?: Database["public"]["Enums"]["quote_status"]
          transit_time?: number | null
          updated_at?: string
          validity?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_quotes_shipment_fkey"
            columns: ["workspace_id", "rfq_id", "shipment_number"]
            isOneToOne: false
            referencedRelation: "rfq_shipments"
            referencedColumns: ["workspace_id", "rfq_id", "shipment_number"]
          },
          {
            foreignKeyName: "agent_quotes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          agent_name: string
          email: string
          status: Database["public"]["Enums"]["agent_status"]
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          agent_name: string
          email: string
          status?: Database["public"]["Enums"]["agent_status"]
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          agent_name?: string
          email?: string
          status?: Database["public"]["Enums"]["agent_status"]
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
          workspace_id: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
          workspace_id: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: number
          metadata: Json
          workspace_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          metadata?: Json
          workspace_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: number
          metadata?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      destination_charge_items: {
        Row: {
          basis: string
          charge_type: string
          created_at: string
          id: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          basis: string
          charge_type: string
          created_at?: string
          id?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          basis?: string
          charge_type?: string
          created_at?: string
          id?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "destination_charge_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      destination_charge_rates: {
        Row: {
          container_type: string
          created_at: string
          id: number
          item_id: number
          rate: number
        }
        Insert: {
          container_type: string
          created_at?: string
          id?: number
          item_id: number
          rate: number
        }
        Update: {
          container_type?: string
          created_at?: string
          id?: number
          item_id?: number
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "destination_charge_rates_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "destination_charge_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "destination_charge_rates_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "v_destination_charges_legacy"
            referencedColumns: ["id"]
          },
        ]
      }
      destination_charges: {
        Row: {
          "20FT": number
          "40FT": number
          basis: string
          charge_type: string
          id: number
          workspace_id: string
        }
        Insert: {
          "20FT": number
          "40FT": number
          basis: string
          charge_type: string
          id?: number
          workspace_id: string
        }
        Update: {
          "20FT"?: number
          "40FT"?: number
          basis?: string
          charge_type?: string
          id?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "destination_charges_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      do_charge_profiles: {
        Row: {
          carrier: string
          created_at: string
          document: number
          id: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          carrier: string
          created_at?: string
          document: number
          id?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          carrier?: string
          created_at?: string
          document?: number
          id?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "do_charge_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      do_charge_rates: {
        Row: {
          container_type: string
          created_at: string
          id: number
          profile_id: number
          rate: number
        }
        Insert: {
          container_type: string
          created_at?: string
          id?: number
          profile_id: number
          rate: number
        }
        Update: {
          container_type?: string
          created_at?: string
          id?: number
          profile_id?: number
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "do_charge_rates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "do_charge_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "do_charge_rates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_do_charges_legacy"
            referencedColumns: ["id"]
          },
        ]
      }
      do_charges: {
        Row: {
          "20FT": number
          "40FT": number
          "40HQ": number
          carrier: string
          document: number
          id: number
          workspace_id: string
        }
        Insert: {
          "20FT": number
          "40FT": number
          "40HQ": number
          carrier: string
          document: number
          id?: number
          workspace_id: string
        }
        Update: {
          "20FT"?: number
          "40FT"?: number
          "40HQ"?: number
          carrier?: string
          document?: number
          id?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "do_charges_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      master_rfqs: {
        Row: {
          container_type: string | null
          containers: Json | null
          customer_email: string
          deleted_at: string | null
          delivery_address: string | null
          delivery_deadline: string | null
          final_price_aed: number | null
          final_price_usd: number | null
          pickup_address: string | null
          pod: string | null
          pol: string | null
          qty: string | null
          quoted_at: string | null
          ready_date: string | null
          received_at: string
          rfq_id: string
          selected_agent: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["rfq_status"]
          thread_id: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          container_type?: string | null
          containers?: Json | null
          customer_email: string
          deleted_at?: string | null
          delivery_address?: string | null
          delivery_deadline?: string | null
          final_price_aed?: number | null
          final_price_usd?: number | null
          pickup_address?: string | null
          pod?: string | null
          pol?: string | null
          qty?: string | null
          quoted_at?: string | null
          ready_date?: string | null
          received_at?: string
          rfq_id: string
          selected_agent?: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["rfq_status"]
          thread_id: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          container_type?: string | null
          containers?: Json | null
          customer_email?: string
          deleted_at?: string | null
          delivery_address?: string | null
          delivery_deadline?: string | null
          final_price_aed?: number | null
          final_price_usd?: number | null
          pickup_address?: string | null
          pod?: string | null
          pol?: string | null
          qty?: string | null
          quoted_at?: string | null
          ready_date?: string | null
          received_at?: string
          rfq_id?: string
          selected_agent?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["rfq_status"]
          thread_id?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_rfqs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_email_events: {
        Row: {
          claimed_at: string
          gmail_message_id: string
          sender: string | null
          source: string
          subject: string | null
          thread_id: string | null
          workspace_id: string
        }
        Insert: {
          claimed_at?: string
          gmail_message_id: string
          sender?: string | null
          source: string
          subject?: string | null
          thread_id?: string | null
          workspace_id: string
        }
        Update: {
          claimed_at?: string
          gmail_message_id?: string
          sender?: string | null
          source?: string
          subject?: string | null
          thread_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processed_email_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_id_aliases: {
        Row: {
          canonical_rfq_id: string
          created_at: string
          duplicate_rfq_id: string
          workspace_id: string
        }
        Insert: {
          canonical_rfq_id: string
          created_at?: string
          duplicate_rfq_id: string
          workspace_id: string
        }
        Update: {
          canonical_rfq_id?: string
          created_at?: string
          duplicate_rfq_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_id_aliases_workspace_canonical_fkey"
            columns: ["workspace_id", "canonical_rfq_id"]
            isOneToOne: false
            referencedRelation: "master_rfqs"
            referencedColumns: ["workspace_id", "rfq_id"]
          },
          {
            foreignKeyName: "rfq_id_aliases_workspace_canonical_fkey"
            columns: ["workspace_id", "canonical_rfq_id"]
            isOneToOne: false
            referencedRelation: "v_master_rfq_legacy_projection"
            referencedColumns: ["workspace_id", "rfq_id"]
          },
          {
            foreignKeyName: "rfq_id_aliases_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_shipment_containers: {
        Row: {
          container_type: string
          created_at: string
          line_number: number
          qty: number
          rfq_id: string
          shipment_number: number
          workspace_id: string
        }
        Insert: {
          container_type: string
          created_at?: string
          line_number: number
          qty: number
          rfq_id: string
          shipment_number: number
          workspace_id: string
        }
        Update: {
          container_type?: string
          created_at?: string
          line_number?: number
          qty?: number
          rfq_id?: string
          shipment_number?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_shipment_containers_shipment_fkey"
            columns: ["workspace_id", "rfq_id", "shipment_number"]
            isOneToOne: false
            referencedRelation: "rfq_shipments"
            referencedColumns: ["workspace_id", "rfq_id", "shipment_number"]
          },
          {
            foreignKeyName: "rfq_shipment_containers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_shipments: {
        Row: {
          created_at: string
          delivery_address: string | null
          delivery_deadline: string | null
          pickup_address: string | null
          pod: string | null
          pol: string | null
          ready_date: string | null
          rfq_id: string
          service_type: Database["public"]["Enums"]["service_type"]
          shipment_number: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          delivery_address?: string | null
          delivery_deadline?: string | null
          pickup_address?: string | null
          pod?: string | null
          pol?: string | null
          ready_date?: string | null
          rfq_id: string
          service_type?: Database["public"]["Enums"]["service_type"]
          shipment_number: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          delivery_address?: string | null
          delivery_deadline?: string | null
          pickup_address?: string | null
          pod?: string | null
          pol?: string | null
          ready_date?: string | null
          rfq_id?: string
          service_type?: Database["public"]["Enums"]["service_type"]
          shipment_number?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_shipments_master_rfqs_fkey"
            columns: ["workspace_id", "rfq_id"]
            isOneToOne: false
            referencedRelation: "master_rfqs"
            referencedColumns: ["workspace_id", "rfq_id"]
          },
          {
            foreignKeyName: "rfq_shipments_master_rfqs_fkey"
            columns: ["workspace_id", "rfq_id"]
            isOneToOne: false
            referencedRelation: "v_master_rfq_legacy_projection"
            referencedColumns: ["workspace_id", "rfq_id"]
          },
          {
            foreignKeyName: "rfq_shipments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      transportation_charges: {
        Row: {
          id: number
          place: string
          price: number
          workspace_id: string
        }
        Insert: {
          id?: number
          place: string
          price: number
          workspace_id: string
        }
        Update: {
          id?: number
          place?: string
          price?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transportation_charges_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_workspace_id: string | null
          deleted_at: string | null
          full_name: string | null
          id: string
          mfa_enabled: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_workspace_id?: string | null
          deleted_at?: string | null
          full_name?: string | null
          id: string
          mfa_enabled?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_workspace_id?: string | null
          deleted_at?: string | null
          full_name?: string | null
          id?: string
          mfa_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_default_workspace_id_fkey"
            columns: ["default_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invite_token: string
          invited_by: string | null
          role: Database["public"]["Enums"]["workspace_role"]
          status: Database["public"]["Enums"]["workspace_invite_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          status?: Database["public"]["Enums"]["workspace_invite_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          status?: Database["public"]["Enums"]["workspace_invite_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_mailboxes: {
        Row: {
          created_at: string
          email: string
          gmail_access_token_encrypted: string | null
          gmail_refresh_token_encrypted: string | null
          last_error: string | null
          status: Database["public"]["Enums"]["mailbox_status"]
          token_expires_at: string | null
          updated_at: string
          watch_expiration: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          gmail_access_token_encrypted?: string | null
          gmail_refresh_token_encrypted?: string | null
          last_error?: string | null
          status?: Database["public"]["Enums"]["mailbox_status"]
          token_expires_at?: string | null
          updated_at?: string
          watch_expiration?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          gmail_access_token_encrypted?: string | null
          gmail_refresh_token_encrypted?: string | null
          last_error?: string | null
          status?: Database["public"]["Enums"]["mailbox_status"]
          token_expires_at?: string | null
          updated_at?: string
          watch_expiration?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_mailboxes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          status: Database["public"]["Enums"]["workspace_member_status"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          status?: Database["public"]["Enums"]["workspace_member_status"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          status?: Database["public"]["Enums"]["workspace_member_status"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_bootstrap: boolean
          kind: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_bootstrap?: boolean
          kind: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_bootstrap?: boolean
          kind?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_destination_charges_legacy: {
        Row: {
          "20FT": number | null
          "40FT": number | null
          basis: string | null
          charge_type: string | null
          id: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "destination_charge_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      v_do_charges_legacy: {
        Row: {
          "20FT": number | null
          "40FT": number | null
          "40HQ": number | null
          carrier: string | null
          document: number | null
          id: number | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "do_charge_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      v_master_rfq_legacy_projection: {
        Row: {
          container_type: string | null
          customer_email: string | null
          deleted_at: string | null
          delivery_address: string | null
          delivery_deadline: string | null
          final_price_aed: number | null
          final_price_usd: number | null
          pickup_address: string | null
          pod: string | null
          pol: string | null
          qty: string | null
          quoted_at: string | null
          ready_date: string | null
          received_at: string | null
          rfq_id: string | null
          selected_agent: string | null
          service_type: string | null
          status: Database["public"]["Enums"]["rfq_status"] | null
          thread_id: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_rfqs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_workspace_role: {
        Args: { allowed_roles: string[]; target_workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      agent_status: "active" | "inactive"
      mailbox_status: "connected" | "disconnected" | "error"
      quote_status: "Requested" | "Received" | "Invalid_Quote" | "Reminded"
      rfq_status:
        | "Processing"
        | "Missing_Port_Data"
        | "Missing_Door_Data"
        | "Parse_Error"
        | "Selected"
        | "Quoted"
        | "Reminded"
        | "Followed_Up"
        | "Customer_Replied"
      service_type:
        | "port-to-port"
        | "door-to-port"
        | "port-to-door"
        | "door-to-door"
      workspace_invite_status: "pending" | "accepted" | "revoked" | "expired"
      workspace_member_status: "active" | "invited" | "suspended"
      workspace_role: "owner" | "admin" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_status: ["active", "inactive"],
      mailbox_status: ["connected", "disconnected", "error"],
      quote_status: ["Requested", "Received", "Invalid_Quote", "Reminded"],
      rfq_status: [
        "Processing",
        "Missing_Port_Data",
        "Missing_Door_Data",
        "Parse_Error",
        "Selected",
        "Quoted",
        "Reminded",
        "Followed_Up",
        "Customer_Replied",
      ],
      service_type: [
        "port-to-port",
        "door-to-port",
        "port-to-door",
        "door-to-door",
      ],
      workspace_invite_status: ["pending", "accepted", "revoked", "expired"],
      workspace_member_status: ["active", "invited", "suspended"],
      workspace_role: ["owner", "admin", "member"],
    },
  },
} as const

