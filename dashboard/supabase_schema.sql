-- Supabase schema snapshot (workspace multi-tenant v1)
-- Canonical migration: dashboard/supabase/migrations/20260222_001_multitenant_workspaces.sql

create extension if not exists pgcrypto;

create type workspace_role as enum ('owner', 'admin', 'member');
create type workspace_member_status as enum ('active', 'invited', 'suspended');
create type workspace_invite_status as enum ('pending', 'accepted', 'revoked', 'expired');
create type mailbox_status as enum ('connected', 'disconnected', 'error');

create type rfq_status as enum (
  'Processing',
  'Missing_Port_Data',
  'Missing_Door_Data',
  'Parse_Error',
  'Selected',
  'Quoted',
  'Reminded',
  'Followed_Up',
  'Customer_Replied'
);

create type quote_status as enum (
  'Requested',
  'Reminded',
  'Received',
  'Invalid_Quote'
);

create type service_type as enum (
  'port-to-port',
  'door-to-port',
  'port-to-door',
  'door-to-door'
);

create type agent_status as enum ('active', 'inactive');

-- Workspace core
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  kind text not null check (kind in ('personal', 'team')),
  created_by uuid references auth.users(id) on delete set null,
  is_bootstrap boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  default_workspace_id uuid references workspaces(id) on delete set null,
  mfa_enabled boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role workspace_role not null default 'member',
  status workspace_member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role workspace_role not null default 'member',
  invited_by uuid references auth.users(id) on delete set null,
  invite_token uuid not null unique default gen_random_uuid(),
  status workspace_invite_status not null default 'pending',
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_mailboxes (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  email text not null unique,
  gmail_refresh_token_encrypted text,
  gmail_access_token_encrypted text,
  token_expires_at timestamptz,
  status mailbox_status not null default 'disconnected',
  last_error text,
  watch_expiration timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table audit_events (
  id bigserial primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Operational tables (workspace-scoped)
create table master_rfqs (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  rfq_id text not null,
  thread_id text not null,
  customer_email text not null,
  status rfq_status not null default 'Processing',
  pol text,
  pod text,
  container_type text,
  qty text,
  ready_date date,
  delivery_deadline date,
  service_type service_type not null,
  pickup_address text,
  delivery_address text,
  received_at timestamptz not null default now(),
  selected_agent text,
  final_price_usd numeric,
  final_price_aed numeric,
  quoted_at timestamptz,
  primary key (workspace_id, rfq_id),
  unique (workspace_id, thread_id)
);

create table processed_email_events (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  source text not null,
  gmail_message_id text not null,
  thread_id text,
  subject text,
  sender text,
  claimed_at timestamptz not null default now(),
  primary key (workspace_id, source, gmail_message_id)
);

create table rfq_id_aliases (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  duplicate_rfq_id text not null,
  canonical_rfq_id text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, duplicate_rfq_id),
  foreign key (workspace_id, canonical_rfq_id)
    references master_rfqs(workspace_id, rfq_id)
    on delete cascade,
  check (duplicate_rfq_id <> canonical_rfq_id)
);

create table agent_outbound_log (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  match text not null,
  rfq_id text not null,
  agent_name text not null,
  agent_email text not null,
  shipment_number text not null,
  carrier text not null,
  price numeric,
  currency text not null default 'USD',
  etd date,
  transit_time text,
  free_time text,
  validity date,
  status quote_status not null default 'Requested',
  sent_at timestamptz not null default now(),
  received_at timestamptz,
  primary key (workspace_id, match),
  foreign key (workspace_id, rfq_id)
    references master_rfqs(workspace_id, rfq_id)
    on delete cascade
);

create table agents (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  agent_name text not null,
  email text not null,
  status agent_status not null default 'active',
  primary key (workspace_id, agent_name),
  unique (workspace_id, email)
);

create table do_charges (
  id bigserial primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  carrier text not null,
  document numeric not null,
  "20FT" numeric not null,
  "40FT" numeric not null,
  "40HQ" numeric not null,
  unique (workspace_id, carrier)
);

create table destination_charges (
  id bigserial primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  charge_type text not null,
  basis text not null,
  "20FT" numeric not null,
  "40FT" numeric not null
);

create table transportation_charges (
  id bigserial primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  place text not null,
  price numeric not null,
  unique (workspace_id, place)
);

create table app_settings (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  key text not null,
  value numeric not null,
  updated_at timestamptz,
  primary key (workspace_id, key)
);

-- High-value indexes
create index idx_workspace_members_user_workspace on workspace_members(user_id, workspace_id);
create index idx_master_rfqs_workspace_status on master_rfqs(workspace_id, status);
create index idx_processed_email_events_workspace_thread on processed_email_events(workspace_id, thread_id);
create index idx_rfq_id_aliases_workspace_canonical on rfq_id_aliases(workspace_id, canonical_rfq_id);
create index idx_agent_outbound_log_workspace_rfq on agent_outbound_log(workspace_id, rfq_id);
create index idx_app_settings_workspace_key on app_settings(workspace_id, key);

-- RLS policy definitions are maintained in migration file.
