begin;

create table if not exists public.processed_email_events (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source text not null,
  gmail_message_id text not null,
  thread_id text,
  subject text,
  sender text,
  claimed_at timestamptz not null default now(),
  primary key (workspace_id, source, gmail_message_id)
);

create index if not exists idx_processed_email_events_workspace_thread
  on public.processed_email_events (workspace_id, thread_id);

create table if not exists public.rfq_id_aliases (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  duplicate_rfq_id text not null,
  canonical_rfq_id text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, duplicate_rfq_id),
  constraint rfq_id_aliases_not_self check (duplicate_rfq_id <> canonical_rfq_id),
  constraint rfq_id_aliases_workspace_canonical_fkey
    foreign key (workspace_id, canonical_rfq_id)
    references public.master_rfqs(workspace_id, rfq_id)
    on delete cascade
);

create index if not exists idx_rfq_id_aliases_workspace_canonical
  on public.rfq_id_aliases (workspace_id, canonical_rfq_id);

create temporary table _rfq_thread_dedup_map on commit drop as
with ranked as (
  select
    r.workspace_id,
    r.thread_id,
    r.rfq_id,
    first_value(r.rfq_id) over (
      partition by r.workspace_id, r.thread_id
      order by
        case r.status
          when 'Quoted' then 1
          when 'Followed_Up' then 2
          when 'Customer_Replied' then 3
          when 'Selected' then 4
          when 'Reminded' then 5
          when 'Processing' then 6
          when 'Missing_Door_Data' then 7
          when 'Missing_Port_Data' then 8
          when 'Parse_Error' then 9
          else 999
        end,
        r.received_at asc,
        r.rfq_id asc
    ) as canonical_rfq_id
  from public.master_rfqs r
)
select
  workspace_id,
  thread_id,
  rfq_id as duplicate_rfq_id,
  canonical_rfq_id
from ranked
where rfq_id <> canonical_rfq_id;

insert into public.rfq_id_aliases (
  workspace_id,
  duplicate_rfq_id,
  canonical_rfq_id
)
select
  workspace_id,
  duplicate_rfq_id,
  canonical_rfq_id
from _rfq_thread_dedup_map
on conflict (workspace_id, duplicate_rfq_id) do update
set canonical_rfq_id = excluded.canonical_rfq_id;

update public.agent_outbound_log a
set rfq_id = m.canonical_rfq_id
from _rfq_thread_dedup_map m
where a.workspace_id = m.workspace_id
  and a.rfq_id = m.duplicate_rfq_id;

delete from public.master_rfqs r
using _rfq_thread_dedup_map m
where r.workspace_id = m.workspace_id
  and r.rfq_id = m.duplicate_rfq_id;

alter table public.master_rfqs
  drop constraint if exists master_rfqs_workspace_thread_unique;
alter table public.master_rfqs
  add constraint master_rfqs_workspace_thread_unique
  unique (workspace_id, thread_id);

alter table public.processed_email_events enable row level security;
alter table public.processed_email_events force row level security;
alter table public.rfq_id_aliases enable row level security;
alter table public.rfq_id_aliases force row level security;

drop policy if exists processed_email_events_select on public.processed_email_events;
create policy processed_email_events_select on public.processed_email_events
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists processed_email_events_write on public.processed_email_events;
create policy processed_email_events_write on public.processed_email_events
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

drop policy if exists rfq_id_aliases_select on public.rfq_id_aliases;
create policy rfq_id_aliases_select on public.rfq_id_aliases
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists rfq_id_aliases_write on public.rfq_id_aliases;
create policy rfq_id_aliases_write on public.rfq_id_aliases
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

commit;
