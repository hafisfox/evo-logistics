-- =====================================================================
-- Migration 017: Ocean freight field expansion
--
-- Adds: commodity/HS code/incoterms/DG/reefer/weight/volume to shipments,
--        surcharges/free-time-details/validity-date/conditions to quotes,
--        exchange_rates table, activity_logs table, rfq_notes table,
--        reminder_count to agent_outbound_log, freight_mode columns,
--        missing indexes.
-- =====================================================================
begin;

-- =========================
-- rfq_shipments: new ocean freight fields
-- =========================
alter table public.rfq_shipments
  add column if not exists commodity_description text,
  add column if not exists hs_code text,
  add column if not exists incoterms text,
  add column if not exists is_dangerous_goods boolean not null default false,
  add column if not exists dg_class text,
  add column if not exists is_reefer boolean not null default false,
  add column if not exists reefer_temperature numeric,
  add column if not exists special_requirements text,
  add column if not exists cargo_weight_kg numeric,
  add column if not exists cargo_volume_cbm numeric,
  add column if not exists freight_mode text not null default 'ocean';

-- Validate incoterms values when set
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'rfq_shipments_incoterms_check'
      and conrelid = 'public.rfq_shipments'::regclass
  ) then
    alter table public.rfq_shipments
      add constraint rfq_shipments_incoterms_check
      check (incoterms is null or incoterms in (
        'EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP'
      ));
  end if;
end $$;

-- Validate freight_mode
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'rfq_shipments_freight_mode_check'
      and conrelid = 'public.rfq_shipments'::regclass
  ) then
    alter table public.rfq_shipments
      add constraint rfq_shipments_freight_mode_check
      check (freight_mode in ('ocean','air','land'));
  end if;
end $$;

-- =========================
-- agent_quotes: surcharge & validity fields
-- =========================
alter table public.agent_quotes
  add column if not exists surcharges jsonb,
  add column if not exists free_time_details jsonb,
  add column if not exists validity_date date,
  add column if not exists conditions text,
  add column if not exists freight_mode text not null default 'ocean';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'agent_quotes_freight_mode_check'
      and conrelid = 'public.agent_quotes'::regclass
  ) then
    alter table public.agent_quotes
      add constraint agent_quotes_freight_mode_check
      check (freight_mode in ('ocean','air','land'));
  end if;
end $$;

-- =========================
-- agent_outbound_log: reminder tracking
-- =========================
alter table public.agent_outbound_log
  add column if not exists reminder_count integer not null default 0;

-- =========================
-- exchange_rates table
-- =========================
create table if not exists public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  from_currency text not null default 'USD',
  to_currency text not null default 'AED',
  rate numeric not null check (rate > 0),
  effective_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_exchange_rates_workspace_currencies
  on public.exchange_rates (workspace_id, from_currency, to_currency, effective_date desc);

alter table public.exchange_rates enable row level security;
alter table public.exchange_rates force row level security;

drop policy if exists exchange_rates_select on public.exchange_rates;
create policy exchange_rates_select on public.exchange_rates
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner','admin','member'])));

drop policy if exists exchange_rates_write on public.exchange_rates;
create policy exchange_rates_write on public.exchange_rates
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner','admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner','admin'])));

-- =========================
-- activity_logs table
-- =========================
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  actor_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_entity
  on public.activity_logs (workspace_id, entity_type, entity_id);

create index if not exists idx_activity_logs_created
  on public.activity_logs (workspace_id, created_at desc);

alter table public.activity_logs enable row level security;
alter table public.activity_logs force row level security;

drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select on public.activity_logs
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner','admin','member'])));

drop policy if exists activity_logs_write on public.activity_logs;
create policy activity_logs_write on public.activity_logs
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner','admin','member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner','admin','member'])));

-- =========================
-- rfq_notes table
-- =========================
create table if not exists public.rfq_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rfq_id text not null,
  author_id uuid not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rfq_notes_rfq
  on public.rfq_notes (workspace_id, rfq_id, created_at desc);

alter table public.rfq_notes enable row level security;
alter table public.rfq_notes force row level security;

drop policy if exists rfq_notes_select on public.rfq_notes;
create policy rfq_notes_select on public.rfq_notes
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner','admin','member'])));

drop policy if exists rfq_notes_write on public.rfq_notes;
create policy rfq_notes_write on public.rfq_notes
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner','admin','member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner','admin','member'])));

-- =========================
-- Missing indexes on existing tables
-- =========================
create index if not exists idx_agent_quotes_rfq_id
  on public.agent_quotes (rfq_id);

create index if not exists idx_rfq_shipments_rfq_id
  on public.rfq_shipments (rfq_id);

create index if not exists idx_agent_quotes_status
  on public.agent_quotes (status);

create index if not exists idx_agent_quotes_validity_date
  on public.agent_quotes (validity_date)
  where validity_date is not null;

create index if not exists idx_master_rfqs_quoted_at
  on public.master_rfqs (workspace_id, quoted_at)
  where quoted_at is not null;

-- =========================
-- Update legacy projection view to include new fields
-- =========================
create or replace view public.v_master_rfq_legacy_projection as
with shipment_lines as (
  select
    s.workspace_id,
    s.rfq_id,
    s.shipment_number,
    s.pol,
    s.pod,
    s.ready_date,
    s.delivery_deadline,
    s.service_type,
    s.pickup_address,
    s.delivery_address,
    s.commodity_description,
    s.hs_code,
    s.incoterms,
    s.is_dangerous_goods,
    s.dg_class,
    s.is_reefer,
    s.reefer_temperature,
    s.special_requirements,
    s.cargo_weight_kg,
    s.cargo_volume_cbm,
    s.freight_mode,
    c.line_number,
    c.container_type,
    c.qty
  from public.rfq_shipments s
  left join public.rfq_shipment_containers c
    on c.workspace_id = s.workspace_id
   and c.rfq_id = s.rfq_id
   and c.shipment_number = s.shipment_number
), aggregated as (
  select
    workspace_id,
    rfq_id,
    string_agg(coalesce(pol, 'TBD'), E'\n' order by shipment_number, line_number) as pol,
    string_agg(coalesce(pod, 'TBD'), E'\n' order by shipment_number, line_number) as pod,
    string_agg(coalesce(container_type, 'TBD'), E'\n' order by shipment_number, line_number) as container_type,
    string_agg(coalesce(qty::text, '1'), E'\n' order by shipment_number, line_number) as qty,
    min(ready_date) as ready_date,
    min(delivery_deadline) as delivery_deadline,
    string_agg(distinct service_type::text, E'\n') as service_type,
    nullif(string_agg(distinct nullif(pickup_address, ''), E'\n'), '') as pickup_address,
    nullif(string_agg(distinct nullif(delivery_address, ''), E'\n'), '') as delivery_address,
    -- Aggregate new fields (take first non-null per RFQ)
    (array_agg(commodity_description order by shipment_number) filter (where commodity_description is not null))[1] as commodity_description,
    (array_agg(hs_code order by shipment_number) filter (where hs_code is not null))[1] as hs_code,
    (array_agg(incoterms order by shipment_number) filter (where incoterms is not null))[1] as incoterms,
    bool_or(is_dangerous_goods) as is_dangerous_goods,
    bool_or(is_reefer) as is_reefer,
    (array_agg(freight_mode order by shipment_number))[1] as freight_mode
  from shipment_lines
  group by workspace_id, rfq_id
)
select
  m.workspace_id,
  m.rfq_id,
  m.thread_id,
  m.customer_email,
  m.status,
  coalesce(a.pol, m.pol) as pol,
  coalesce(a.pod, m.pod) as pod,
  coalesce(a.container_type, m.container_type) as container_type,
  coalesce(a.qty, m.qty) as qty,
  coalesce(a.ready_date, m.ready_date) as ready_date,
  coalesce(a.delivery_deadline, m.delivery_deadline) as delivery_deadline,
  coalesce(a.service_type, m.service_type::text) as service_type,
  coalesce(a.pickup_address, m.pickup_address) as pickup_address,
  coalesce(a.delivery_address, m.delivery_address) as delivery_address,
  m.received_at,
  m.selected_agent,
  m.final_price_usd,
  m.final_price_aed,
  m.quoted_at,
  m.deleted_at,
  -- New aggregated fields
  a.commodity_description,
  a.hs_code,
  a.incoterms,
  coalesce(a.is_dangerous_goods, false) as is_dangerous_goods,
  coalesce(a.is_reefer, false) as is_reefer,
  coalesce(a.freight_mode, 'ocean') as freight_mode
from public.master_rfqs m
left join aggregated a
  on a.workspace_id = m.workspace_id
 and a.rfq_id = m.rfq_id;

commit;
