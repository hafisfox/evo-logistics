begin;

-- Phase 4 (Land Freight API Integration): persistence for external API rate
-- intelligence and detention/demurrage tracking. Workspace-scoped + RLS,
-- mirroring migration 020 (land freight tables). All amounts in USD.

-- External rate quotes: normalized rate intelligence aggregated from external
-- APIs (DAT / SMC3 / Uber Freight / Loadsmart) via automations/freight_apis.
-- source='api' marks market intelligence (NOT customer pricing). One current
-- snapshot per (workspace, lane, mode) is kept; refresh replaces source='api' rows.
create table if not exists public.external_rate_quotes (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rfq_id text,
  provider text not null,
  freight_mode text not null default 'land',
  carrier text,
  origin text not null,
  destination text not null,
  equipment_type text,
  price_usd numeric not null check (price_usd >= 0),
  currency text not null default 'USD',
  transit_time_days integer,
  valid_until date,
  surcharges jsonb not null default '[]'::jsonb,
  source text not null default 'api' check (source in ('api', 'agent_email')),
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_external_rate_quotes_workspace_lane
  on public.external_rate_quotes (workspace_id, origin, destination, freight_mode);
create index if not exists idx_external_rate_quotes_workspace_rfq
  on public.external_rate_quotes (workspace_id, rfq_id);

-- Detention/demurrage events: tracked containers/loads accruing D&D fees.
-- free_until marks the end of free time; the scheduled task (check_detention_
-- demurrage) accrues fee_usd = days_past(free_until) * daily_rate_usd.
create table if not exists public.detention_demurrage_events (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rfq_id text,
  shipment_number integer,
  kind text not null default 'detention' check (kind in ('detention', 'demurrage')),
  reference text,
  free_until date,
  free_time_days integer,
  daily_rate_usd numeric not null default 0 check (daily_rate_usd >= 0),
  days_used integer not null default 0,
  fee_usd numeric not null default 0 check (fee_usd >= 0),
  status text not null default 'accruing' check (status in ('accruing', 'cleared', 'waived')),
  last_alerted_at text,
  created_at timestamptz not null default now()
);

create index if not exists idx_dd_events_workspace_status
  on public.detention_demurrage_events (workspace_id, status);
create index if not exists idx_dd_events_workspace_rfq
  on public.detention_demurrage_events (workspace_id, rfq_id);

-- RLS: workspace-scoped, role-aware (owner/admin/member), force enabled.
alter table public.external_rate_quotes enable row level security;
alter table public.external_rate_quotes force row level security;
alter table public.detention_demurrage_events enable row level security;
alter table public.detention_demurrage_events force row level security;

create policy external_rate_quotes_select on public.external_rate_quotes
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy external_rate_quotes_insert on public.external_rate_quotes
  for insert to authenticated
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy external_rate_quotes_update on public.external_rate_quotes
  for update to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy external_rate_quotes_delete on public.external_rate_quotes
  for delete to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy detention_demurrage_events_select on public.detention_demurrage_events
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy detention_demurrage_events_insert on public.detention_demurrage_events
  for insert to authenticated
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy detention_demurrage_events_update on public.detention_demurrage_events
  for update to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy detention_demurrage_events_delete on public.detention_demurrage_events
  for delete to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

commit;
