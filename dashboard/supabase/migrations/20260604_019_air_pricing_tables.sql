begin;

-- Air freight rate book (Phase 1 air foundation): airline master data + weight-tier
-- rates per lane. Workspace-scoped + RLS, mirroring migration 018 (rfq_shipment_pieces).
-- Rates are stored in USD/kg to match calculate_air_price() in the pricing engine.

-- Airline master data (IATA code, display name, cargo capabilities, active flag).
create table if not exists public.air_carrier_profiles (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  iata_code text not null,
  name text not null,
  cargo_types text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint air_carrier_profiles_workspace_iata_unique unique (workspace_id, iata_code)
);

create index if not exists idx_air_carrier_profiles_workspace
  on public.air_carrier_profiles (workspace_id, iata_code);

-- Weight-tier rates per lane per airline. One row per (carrier, origin, destination,
-- weight break). min_weight_kg is the IATA break start (0, 45, 100, 300, 500, 1000);
-- the lookup picks the highest min_weight_kg <= chargeable weight.
create table if not exists public.air_charge_rates (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  carrier text not null,
  origin text not null,
  destination text not null,
  min_weight_kg numeric not null default 0 check (min_weight_kg >= 0),
  rate_per_kg_usd numeric not null check (rate_per_kg_usd > 0),
  min_charge_usd numeric not null default 0 check (min_charge_usd >= 0),
  created_at timestamptz not null default now(),
  constraint air_charge_rates_workspace_lane_tier_unique
    unique (workspace_id, carrier, origin, destination, min_weight_kg)
);

create index if not exists idx_air_charge_rates_workspace_lane
  on public.air_charge_rates (workspace_id, carrier, origin, destination, min_weight_kg);

-- RLS: same pattern as rfq_shipment_pieces (migration 018). Read/write allowed for
-- workspace members; the API layer further restricts writes to owner/admin.
alter table public.air_carrier_profiles enable row level security;
alter table public.air_carrier_profiles force row level security;
alter table public.air_charge_rates enable row level security;
alter table public.air_charge_rates force row level security;

create policy air_carrier_profiles_select on public.air_carrier_profiles
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy air_carrier_profiles_insert on public.air_carrier_profiles
  for insert to authenticated
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy air_carrier_profiles_update on public.air_carrier_profiles
  for update to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy air_carrier_profiles_delete on public.air_carrier_profiles
  for delete to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy air_charge_rates_select on public.air_charge_rates
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy air_charge_rates_insert on public.air_charge_rates
  for insert to authenticated
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy air_charge_rates_update on public.air_charge_rates
  for update to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy air_charge_rates_delete on public.air_charge_rates
  for delete to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

commit;
