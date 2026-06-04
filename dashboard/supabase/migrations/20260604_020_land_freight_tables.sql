begin;

-- Land freight foundation (Phase 3): trucking carrier master data, FTL lane rates,
-- LTL/NMFC class tariffs, port drayage rates, and per-shipment truck details.
-- Workspace-scoped + RLS, mirroring migration 019 (air pricing) and migration 018
-- (rfq_shipment_pieces). Rates stored in USD to match the land pricing engine.

-- Trucking carrier master data (MC#/DOT#, equipment capabilities, active flag).
create table if not exists public.truck_carrier_profiles (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  mc_number text,
  dot_number text,
  equipment_types text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint truck_carrier_profiles_workspace_name_unique unique (workspace_id, name)
);

create index if not exists idx_truck_carrier_profiles_workspace
  on public.truck_carrier_profiles (workspace_id, name);

-- FTL lane rates: per-mile or flat rate per origin/destination ZIP + equipment type.
-- A NULL flat_rate_usd means price by per_mile_rate_usd × distance; min_charge_usd is
-- the floor. fuel_surcharge_pct is applied to the linehaul (see calculate_ftl_price()).
create table if not exists public.truck_lane_rates (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  carrier text not null,
  origin_zip text not null,
  destination_zip text not null,
  equipment_type text not null default 'DRY VAN',
  rate_per_mile_usd numeric check (rate_per_mile_usd is null or rate_per_mile_usd >= 0),
  flat_rate_usd numeric check (flat_rate_usd is null or flat_rate_usd >= 0),
  min_charge_usd numeric not null default 0 check (min_charge_usd >= 0),
  fuel_surcharge_pct numeric not null default 0 check (fuel_surcharge_pct >= 0),
  created_at timestamptz not null default now(),
  constraint truck_lane_rates_workspace_lane_equip_unique
    unique (workspace_id, carrier, origin_zip, destination_zip, equipment_type)
);

create index if not exists idx_truck_lane_rates_workspace_lane
  on public.truck_lane_rates (workspace_id, carrier, origin_zip, destination_zip);

-- LTL NMFC freight-class tariff. Density band (min/max lb/ft^3) is informational for
-- class assignment; rate_per_100lb_usd is the class-based rate used by calculate_ltl_price().
create table if not exists public.ltl_freight_classes (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nmfc_class text not null,
  description text,
  min_density numeric,
  max_density numeric,
  rate_per_100lb_usd numeric not null check (rate_per_100lb_usd >= 0),
  min_charge_usd numeric not null default 0 check (min_charge_usd >= 0),
  created_at timestamptz not null default now(),
  constraint ltl_freight_classes_workspace_class_unique unique (workspace_id, nmfc_class)
);

create index if not exists idx_ltl_freight_classes_workspace_class
  on public.ltl_freight_classes (workspace_id, nmfc_class);

-- Port drayage rates by terminal + destination ZIP (intermodal first/last mile).
create table if not exists public.drayage_rates (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  terminal text not null,
  destination_zip text not null,
  rate_usd numeric not null check (rate_usd >= 0),
  distance_miles numeric check (distance_miles is null or distance_miles >= 0),
  created_at timestamptz not null default now(),
  constraint drayage_rates_workspace_terminal_dest_unique
    unique (workspace_id, terminal, destination_zip)
);

create index if not exists idx_drayage_rates_workspace_terminal
  on public.drayage_rates (workspace_id, terminal, destination_zip);

-- Per-shipment truck details (mirrors rfq_shipment_pieces, migration 018).
-- equipment_type stored as free text to match EQUIPMENT_BY_MODE.land in the dashboard;
-- load_type constrained to FTL/LTL/PTL.
create table if not exists public.rfq_shipment_truck_details (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rfq_id text not null,
  shipment_number integer not null,
  equipment_type text,
  load_type text check (load_type in ('FTL', 'LTL', 'PTL')),
  weight_lbs numeric,
  nmfc_class text,
  commodity_description text,
  hazmat boolean not null default false,
  accessorials jsonb,
  origin_zip text,
  destination_zip text,
  created_at timestamptz not null default now(),
  primary key (workspace_id, rfq_id, shipment_number),
  constraint rfq_shipment_truck_details_shipment_fkey
    foreign key (workspace_id, rfq_id, shipment_number)
    references public.rfq_shipments(workspace_id, rfq_id, shipment_number)
    on delete cascade
);

create index if not exists idx_rfq_shipment_truck_details_workspace_rfq_shipment
  on public.rfq_shipment_truck_details (workspace_id, rfq_id, shipment_number);

-- RLS: same pattern as migrations 018 + 019. Read/write for workspace members; the
-- API layer further restricts writes to owner/admin.
alter table public.truck_carrier_profiles enable row level security;
alter table public.truck_carrier_profiles force row level security;
alter table public.truck_lane_rates enable row level security;
alter table public.truck_lane_rates force row level security;
alter table public.ltl_freight_classes enable row level security;
alter table public.ltl_freight_classes force row level security;
alter table public.drayage_rates enable row level security;
alter table public.drayage_rates force row level security;
alter table public.rfq_shipment_truck_details enable row level security;
alter table public.rfq_shipment_truck_details force row level security;

create policy truck_carrier_profiles_select on public.truck_carrier_profiles
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy truck_carrier_profiles_insert on public.truck_carrier_profiles
  for insert to authenticated
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy truck_carrier_profiles_update on public.truck_carrier_profiles
  for update to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy truck_carrier_profiles_delete on public.truck_carrier_profiles
  for delete to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy truck_lane_rates_select on public.truck_lane_rates
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy truck_lane_rates_insert on public.truck_lane_rates
  for insert to authenticated
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy truck_lane_rates_update on public.truck_lane_rates
  for update to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy truck_lane_rates_delete on public.truck_lane_rates
  for delete to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy ltl_freight_classes_select on public.ltl_freight_classes
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy ltl_freight_classes_insert on public.ltl_freight_classes
  for insert to authenticated
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy ltl_freight_classes_update on public.ltl_freight_classes
  for update to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy ltl_freight_classes_delete on public.ltl_freight_classes
  for delete to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy drayage_rates_select on public.drayage_rates
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy drayage_rates_insert on public.drayage_rates
  for insert to authenticated
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy drayage_rates_update on public.drayage_rates
  for update to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy drayage_rates_delete on public.drayage_rates
  for delete to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy rfq_shipment_truck_details_select on public.rfq_shipment_truck_details
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy rfq_shipment_truck_details_insert on public.rfq_shipment_truck_details
  for insert to authenticated
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy rfq_shipment_truck_details_update on public.rfq_shipment_truck_details
  for update to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy rfq_shipment_truck_details_delete on public.rfq_shipment_truck_details
  for delete to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

commit;
