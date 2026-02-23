begin;

create extension if not exists pgcrypto;

create table if not exists public.rfq_shipments (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rfq_id text not null,
  shipment_number integer not null check (shipment_number > 0),
  pol text,
  pod text,
  ready_date date,
  delivery_deadline date,
  service_type service_type not null default 'port-to-port',
  pickup_address text,
  delivery_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, rfq_id, shipment_number),
  constraint rfq_shipments_master_rfqs_fkey
    foreign key (workspace_id, rfq_id)
    references public.master_rfqs(workspace_id, rfq_id)
    on delete cascade
);

create table if not exists public.rfq_shipment_containers (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rfq_id text not null,
  shipment_number integer not null,
  line_number integer not null check (line_number > 0),
  container_type text not null,
  qty integer not null check (qty > 0),
  created_at timestamptz not null default now(),
  primary key (workspace_id, rfq_id, shipment_number, line_number),
  constraint rfq_shipment_containers_shipment_fkey
    foreign key (workspace_id, rfq_id, shipment_number)
    references public.rfq_shipments(workspace_id, rfq_id, shipment_number)
    on delete cascade
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rfq_shipment_containers_container_type_check'
      and conrelid = 'public.rfq_shipment_containers'::regclass
  ) then
    alter table public.rfq_shipment_containers
      add constraint rfq_shipment_containers_container_type_check
      check (
        upper(container_type) in ('20FT', '20GP', '40FT', '40GP', '40HC', '40HQ', '45FT', '20OT', '40OT')
      );
  end if;
end $$;

create table if not exists public.agent_quotes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rfq_id text not null,
  shipment_number integer not null check (shipment_number > 0),
  match text not null,
  agent_name text not null,
  agent_email text not null,
  carrier text not null,
  price numeric,
  currency text not null default 'USD',
  etd date,
  transit_time integer,
  free_time integer,
  validity date,
  status quote_status not null default 'Requested',
  sent_at text,
  received_at text,
  raw_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_quotes_workspace_match_unique unique (workspace_id, match),
  constraint agent_quotes_shipment_fkey
    foreign key (workspace_id, rfq_id, shipment_number)
    references public.rfq_shipments(workspace_id, rfq_id, shipment_number)
    on delete cascade
);

create table if not exists public.do_charge_profiles (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  carrier text not null,
  document numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint do_charge_profiles_workspace_carrier_unique unique (workspace_id, carrier)
);

create table if not exists public.do_charge_rates (
  id bigserial primary key,
  profile_id bigint not null references public.do_charge_profiles(id) on delete cascade,
  container_type text not null,
  rate numeric not null,
  created_at timestamptz not null default now(),
  constraint do_charge_rates_profile_container_unique unique (profile_id, container_type)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'do_charge_rates_container_type_check'
      and conrelid = 'public.do_charge_rates'::regclass
  ) then
    alter table public.do_charge_rates
      add constraint do_charge_rates_container_type_check
      check (container_type in ('20FT', '40FT', '40HQ'));
  end if;
end $$;

create table if not exists public.destination_charge_items (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  charge_type text not null,
  basis text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint destination_charge_items_workspace_key unique (workspace_id, charge_type, basis)
);

create table if not exists public.destination_charge_rates (
  id bigserial primary key,
  item_id bigint not null references public.destination_charge_items(id) on delete cascade,
  container_type text not null,
  rate numeric not null,
  created_at timestamptz not null default now(),
  constraint destination_charge_rates_item_container_unique unique (item_id, container_type)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'destination_charge_rates_container_type_check'
      and conrelid = 'public.destination_charge_rates'::regclass
  ) then
    alter table public.destination_charge_rates
      add constraint destination_charge_rates_container_type_check
      check (container_type in ('20FT', '40FT'));
  end if;
end $$;

create index if not exists idx_rfq_shipments_workspace_rfq
  on public.rfq_shipments (workspace_id, rfq_id);

create index if not exists idx_rfq_shipments_workspace_ready_date
  on public.rfq_shipments (workspace_id, ready_date);

create index if not exists idx_rfq_shipment_containers_workspace_rfq_shipment
  on public.rfq_shipment_containers (workspace_id, rfq_id, shipment_number);

create index if not exists idx_agent_quotes_workspace_rfq_status
  on public.agent_quotes (workspace_id, rfq_id, status);

create index if not exists idx_agent_quotes_workspace_agent_email
  on public.agent_quotes (workspace_id, agent_email);

create index if not exists idx_do_charge_rates_profile_container
  on public.do_charge_rates (profile_id, container_type);

create index if not exists idx_destination_charge_rates_item_container
  on public.destination_charge_rates (item_id, container_type);

create or replace view public.v_do_charges_legacy as
select
  p.id,
  p.workspace_id,
  p.carrier,
  p.document,
  max(case when r.container_type = '20FT' then r.rate end) as "20FT",
  max(case when r.container_type = '40FT' then r.rate end) as "40FT",
  max(case when r.container_type = '40HQ' then r.rate end) as "40HQ"
from public.do_charge_profiles p
left join public.do_charge_rates r on r.profile_id = p.id
group by p.id, p.workspace_id, p.carrier, p.document;

create or replace view public.v_destination_charges_legacy as
select
  i.id,
  i.workspace_id,
  i.charge_type,
  i.basis,
  max(case when r.container_type = '20FT' then r.rate end) as "20FT",
  max(case when r.container_type = '40FT' then r.rate end) as "40FT"
from public.destination_charge_items i
left join public.destination_charge_rates r on r.item_id = i.id
group by i.id, i.workspace_id, i.charge_type, i.basis;

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
    nullif(string_agg(distinct nullif(delivery_address, ''), E'\n'), '') as delivery_address
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
  m.deleted_at
from public.master_rfqs m
left join aggregated a
  on a.workspace_id = m.workspace_id
 and a.rfq_id = m.rfq_id;

alter table public.rfq_shipments enable row level security;
alter table public.rfq_shipments force row level security;
alter table public.rfq_shipment_containers enable row level security;
alter table public.rfq_shipment_containers force row level security;
alter table public.agent_quotes enable row level security;
alter table public.agent_quotes force row level security;
alter table public.do_charge_profiles enable row level security;
alter table public.do_charge_profiles force row level security;
alter table public.do_charge_rates enable row level security;
alter table public.do_charge_rates force row level security;
alter table public.destination_charge_items enable row level security;
alter table public.destination_charge_items force row level security;
alter table public.destination_charge_rates enable row level security;
alter table public.destination_charge_rates force row level security;

drop policy if exists rfq_shipments_select on public.rfq_shipments;
create policy rfq_shipments_select on public.rfq_shipments
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists rfq_shipments_write on public.rfq_shipments;
create policy rfq_shipments_write on public.rfq_shipments
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists rfq_shipment_containers_select on public.rfq_shipment_containers;
create policy rfq_shipment_containers_select on public.rfq_shipment_containers
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists rfq_shipment_containers_write on public.rfq_shipment_containers;
create policy rfq_shipment_containers_write on public.rfq_shipment_containers
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists agent_quotes_select on public.agent_quotes;
create policy agent_quotes_select on public.agent_quotes
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists agent_quotes_write on public.agent_quotes;
create policy agent_quotes_write on public.agent_quotes
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists do_charge_profiles_select on public.do_charge_profiles;
create policy do_charge_profiles_select on public.do_charge_profiles
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists do_charge_profiles_write on public.do_charge_profiles;
create policy do_charge_profiles_write on public.do_charge_profiles
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

drop policy if exists do_charge_rates_select on public.do_charge_rates;
create policy do_charge_rates_select on public.do_charge_rates
  for select to authenticated
  using (
    exists (
      select 1
      from public.do_charge_profiles p
      where p.id = profile_id
        and (select public.has_workspace_role(p.workspace_id, array['owner', 'admin', 'member']))
    )
  );

drop policy if exists do_charge_rates_write on public.do_charge_rates;
create policy do_charge_rates_write on public.do_charge_rates
  for all to authenticated
  using (
    exists (
      select 1
      from public.do_charge_profiles p
      where p.id = profile_id
        and (select public.has_workspace_role(p.workspace_id, array['owner', 'admin']))
    )
  )
  with check (
    exists (
      select 1
      from public.do_charge_profiles p
      where p.id = profile_id
        and (select public.has_workspace_role(p.workspace_id, array['owner', 'admin']))
    )
  );

drop policy if exists destination_charge_items_select on public.destination_charge_items;
create policy destination_charge_items_select on public.destination_charge_items
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists destination_charge_items_write on public.destination_charge_items;
create policy destination_charge_items_write on public.destination_charge_items
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

drop policy if exists destination_charge_rates_select on public.destination_charge_rates;
create policy destination_charge_rates_select on public.destination_charge_rates
  for select to authenticated
  using (
    exists (
      select 1
      from public.destination_charge_items i
      where i.id = item_id
        and (select public.has_workspace_role(i.workspace_id, array['owner', 'admin', 'member']))
    )
  );

drop policy if exists destination_charge_rates_write on public.destination_charge_rates;
create policy destination_charge_rates_write on public.destination_charge_rates
  for all to authenticated
  using (
    exists (
      select 1
      from public.destination_charge_items i
      where i.id = item_id
        and (select public.has_workspace_role(i.workspace_id, array['owner', 'admin']))
    )
  )
  with check (
    exists (
      select 1
      from public.destination_charge_items i
      where i.id = item_id
        and (select public.has_workspace_role(i.workspace_id, array['owner', 'admin']))
    )
  );

commit;
