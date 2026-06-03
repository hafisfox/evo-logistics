begin;

-- Air freight piece-level cargo data (mirrors rfq_shipment_containers pattern)
create table if not exists public.rfq_shipment_pieces (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rfq_id text not null,
  shipment_number integer not null,
  piece_number integer not null check (piece_number > 0),
  count integer,
  length_cm numeric,
  width_cm numeric,
  height_cm numeric,
  weight_kg numeric,
  packaging_type text,
  created_at timestamptz not null default now(),
  primary key (workspace_id, rfq_id, shipment_number, piece_number),
  constraint rfq_shipment_pieces_shipment_fkey
    foreign key (workspace_id, rfq_id, shipment_number)
    references public.rfq_shipments(workspace_id, rfq_id, shipment_number)
    on delete cascade
);

create index if not exists idx_rfq_shipment_pieces_workspace_rfq_shipment
  on public.rfq_shipment_pieces (workspace_id, rfq_id, shipment_number);

alter table public.rfq_shipment_pieces enable row level security;
alter table public.rfq_shipment_pieces force row level security;

-- RLS: same pattern as rfq_shipment_containers (migration 012 + 013)
create policy rfq_shipment_pieces_select on public.rfq_shipment_pieces
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy rfq_shipment_pieces_insert on public.rfq_shipment_pieces
  for insert to authenticated
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy rfq_shipment_pieces_update on public.rfq_shipment_pieces
  for update to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy rfq_shipment_pieces_delete on public.rfq_shipment_pieces
  for delete to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

commit;
