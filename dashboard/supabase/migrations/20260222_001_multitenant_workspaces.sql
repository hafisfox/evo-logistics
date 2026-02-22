begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'workspace_role') then
    create type workspace_role as enum ('owner', 'admin', 'member');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'workspace_member_status') then
    create type workspace_member_status as enum ('active', 'invited', 'suspended');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'workspace_invite_status') then
    create type workspace_invite_status as enum ('pending', 'accepted', 'revoked', 'expired');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'mailbox_status') then
    create type mailbox_status as enum ('connected', 'disconnected', 'error');
  end if;
end $$;

create table if not exists public.workspaces (
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

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  default_workspace_id uuid references public.workspaces(id) on delete set null,
  mfa_enabled boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role workspace_role not null default 'member',
  status workspace_member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role workspace_role not null default 'member',
  invited_by uuid references auth.users(id) on delete set null,
  invite_token uuid not null default gen_random_uuid() unique,
  status workspace_invite_status not null default 'pending',
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_mailboxes (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
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

create table if not exists public.audit_events (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.workspaces (id, name, slug, kind, is_bootstrap)
values ('00000000-0000-0000-0000-000000000001', 'Bootstrap Workspace', 'bootstrap', 'team', true)
on conflict (id) do nothing;

create table if not exists public.app_settings (
  key text not null,
  value numeric not null,
  updated_at timestamptz,
  workspace_id uuid
);

alter table public.master_rfqs add column if not exists workspace_id uuid;
alter table public.agent_outbound_log add column if not exists workspace_id uuid;
alter table public.agents add column if not exists workspace_id uuid;
alter table public.do_charges add column if not exists workspace_id uuid;
alter table public.destination_charges add column if not exists workspace_id uuid;
alter table public.transportation_charges add column if not exists workspace_id uuid;
alter table public.app_settings add column if not exists workspace_id uuid;

update public.master_rfqs
set workspace_id = '00000000-0000-0000-0000-000000000001'
where workspace_id is null;

update public.agent_outbound_log
set workspace_id = '00000000-0000-0000-0000-000000000001'
where workspace_id is null;

update public.agents
set workspace_id = '00000000-0000-0000-0000-000000000001'
where workspace_id is null;

update public.do_charges
set workspace_id = '00000000-0000-0000-0000-000000000001'
where workspace_id is null;

update public.destination_charges
set workspace_id = '00000000-0000-0000-0000-000000000001'
where workspace_id is null;

update public.transportation_charges
set workspace_id = '00000000-0000-0000-0000-000000000001'
where workspace_id is null;

update public.app_settings
set workspace_id = '00000000-0000-0000-0000-000000000001'
where workspace_id is null;

alter table public.master_rfqs alter column workspace_id set not null;
alter table public.agent_outbound_log alter column workspace_id set not null;
alter table public.agents alter column workspace_id set not null;
alter table public.do_charges alter column workspace_id set not null;
alter table public.destination_charges alter column workspace_id set not null;
alter table public.transportation_charges alter column workspace_id set not null;
alter table public.app_settings alter column workspace_id set not null;

alter table public.agent_outbound_log drop constraint if exists agent_outbound_log_rfq_id_fkey;
alter table public.agent_outbound_log drop constraint if exists agent_outbound_log_workspace_rfq_id_fkey;
alter table public.master_rfqs drop constraint if exists master_rfqs_pkey;
alter table public.master_rfqs add constraint master_rfqs_pkey primary key (workspace_id, rfq_id);
alter table public.agent_outbound_log drop constraint if exists agent_outbound_log_pkey;
alter table public.agent_outbound_log add constraint agent_outbound_log_pkey primary key (workspace_id, match);
alter table public.agent_outbound_log
  add constraint agent_outbound_log_workspace_rfq_id_fkey
  foreign key (workspace_id, rfq_id)
  references public.master_rfqs(workspace_id, rfq_id)
  on delete cascade;

alter table public.app_settings drop constraint if exists app_settings_pkey;
alter table public.app_settings add constraint app_settings_pkey primary key (workspace_id, key);

alter table public.app_settings drop constraint if exists app_settings_workspace_id_fkey;
alter table public.app_settings
  add constraint app_settings_workspace_id_fkey
  foreign key (workspace_id)
  references public.workspaces(id)
  on delete cascade;

alter table public.master_rfqs drop constraint if exists master_rfqs_workspace_id_fkey;
alter table public.master_rfqs
  add constraint master_rfqs_workspace_id_fkey
  foreign key (workspace_id)
  references public.workspaces(id)
  on delete cascade;

alter table public.agent_outbound_log drop constraint if exists agent_outbound_log_workspace_id_fkey;
alter table public.agent_outbound_log
  add constraint agent_outbound_log_workspace_id_fkey
  foreign key (workspace_id)
  references public.workspaces(id)
  on delete cascade;

alter table public.agents drop constraint if exists agents_workspace_id_fkey;
alter table public.agents
  add constraint agents_workspace_id_fkey
  foreign key (workspace_id)
  references public.workspaces(id)
  on delete cascade;

alter table public.do_charges drop constraint if exists do_charges_workspace_id_fkey;
alter table public.do_charges
  add constraint do_charges_workspace_id_fkey
  foreign key (workspace_id)
  references public.workspaces(id)
  on delete cascade;

alter table public.destination_charges drop constraint if exists destination_charges_workspace_id_fkey;
alter table public.destination_charges
  add constraint destination_charges_workspace_id_fkey
  foreign key (workspace_id)
  references public.workspaces(id)
  on delete cascade;

alter table public.transportation_charges drop constraint if exists transportation_charges_workspace_id_fkey;
alter table public.transportation_charges
  add constraint transportation_charges_workspace_id_fkey
  foreign key (workspace_id)
  references public.workspaces(id)
  on delete cascade;

alter table public.do_charges drop constraint if exists do_charges_carrier_key;
create unique index if not exists do_charges_workspace_carrier_key
  on public.do_charges (workspace_id, carrier);

alter table public.transportation_charges drop constraint if exists transportation_charges_place_key;
create unique index if not exists transportation_charges_workspace_place_key
  on public.transportation_charges (workspace_id, place);

drop index if exists idx_agent_outbound_log_rfq_id;
create index if not exists idx_agent_outbound_log_workspace_rfq
  on public.agent_outbound_log (workspace_id, rfq_id);

create index if not exists idx_master_rfqs_workspace_id
  on public.master_rfqs (workspace_id);
create index if not exists idx_master_rfqs_workspace_status
  on public.master_rfqs (workspace_id, status);
create index if not exists idx_agent_outbound_log_workspace_status
  on public.agent_outbound_log (workspace_id, status);
create index if not exists idx_agents_workspace_id
  on public.agents (workspace_id);
create index if not exists idx_app_settings_workspace_key
  on public.app_settings (workspace_id, key);
create index if not exists idx_workspace_members_user_workspace
  on public.workspace_members (user_id, workspace_id);
create index if not exists idx_workspace_members_workspace_role
  on public.workspace_members (workspace_id, role);
create index if not exists idx_workspace_invites_workspace_status
  on public.workspace_invites (workspace_id, status);
create index if not exists idx_audit_events_workspace_created
  on public.audit_events (workspace_id, created_at desc);

create or replace function public.has_workspace_role(
  target_workspace_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
      and wm.role::text = any(allowed_roles)
  );
$$;

revoke all on function public.has_workspace_role(uuid, text[]) from public;
grant execute on function public.has_workspace_role(uuid, text[]) to authenticated;

alter table public.workspaces enable row level security;
alter table public.user_profiles enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.workspace_mailboxes enable row level security;
alter table public.audit_events enable row level security;
alter table public.master_rfqs enable row level security;
alter table public.agent_outbound_log enable row level security;
alter table public.agents enable row level security;
alter table public.do_charges enable row level security;
alter table public.destination_charges enable row level security;
alter table public.transportation_charges enable row level security;
alter table public.app_settings enable row level security;

alter table public.workspaces force row level security;
alter table public.user_profiles force row level security;
alter table public.workspace_members force row level security;
alter table public.workspace_invites force row level security;
alter table public.workspace_mailboxes force row level security;
alter table public.audit_events force row level security;
alter table public.master_rfqs force row level security;
alter table public.agent_outbound_log force row level security;
alter table public.agents force row level security;
alter table public.do_charges force row level security;
alter table public.destination_charges force row level security;
alter table public.transportation_charges force row level security;
alter table public.app_settings force row level security;

drop policy if exists "Allow public read access" on public.master_rfqs;
drop policy if exists "Allow public read access" on public.agent_outbound_log;
drop policy if exists "Allow public read access" on public.agents;
drop policy if exists "Allow public read access" on public.do_charges;
drop policy if exists "Allow public read access" on public.destination_charges;
drop policy if exists "Allow public read access" on public.transportation_charges;

drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
  for select to authenticated
  using (
    created_by = (select auth.uid())
    or (select public.has_workspace_role(id, array['owner', 'admin', 'member']))
  );

drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces
  for insert to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces
  for update to authenticated
  using ((select public.has_workspace_role(id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(id, array['owner', 'admin'])));

drop policy if exists user_profiles_own on public.user_profiles;
create policy user_profiles_own on public.user_profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists workspace_members_select on public.workspace_members;
create policy workspace_members_select on public.workspace_members
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists workspace_members_write on public.workspace_members;
create policy workspace_members_write on public.workspace_members
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

drop policy if exists workspace_invites_select on public.workspace_invites;
create policy workspace_invites_select on public.workspace_invites
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists workspace_invites_write on public.workspace_invites;
create policy workspace_invites_write on public.workspace_invites
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

drop policy if exists workspace_mailboxes_select on public.workspace_mailboxes;
create policy workspace_mailboxes_select on public.workspace_mailboxes
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists workspace_mailboxes_write on public.workspace_mailboxes;
create policy workspace_mailboxes_write on public.workspace_mailboxes
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

drop policy if exists audit_events_select on public.audit_events;
create policy audit_events_select on public.audit_events
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists audit_events_write on public.audit_events;
create policy audit_events_write on public.audit_events
  for insert to authenticated
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

drop policy if exists master_rfqs_select on public.master_rfqs;
create policy master_rfqs_select on public.master_rfqs
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists master_rfqs_write on public.master_rfqs;
create policy master_rfqs_write on public.master_rfqs
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists agent_outbound_log_select on public.agent_outbound_log;
create policy agent_outbound_log_select on public.agent_outbound_log
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists agent_outbound_log_write on public.agent_outbound_log;
create policy agent_outbound_log_write on public.agent_outbound_log
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists agents_select on public.agents;
create policy agents_select on public.agents
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists agents_write on public.agents;
create policy agents_write on public.agents
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

drop policy if exists do_charges_select on public.do_charges;
create policy do_charges_select on public.do_charges
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists do_charges_write on public.do_charges;
create policy do_charges_write on public.do_charges
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

drop policy if exists destination_charges_select on public.destination_charges;
create policy destination_charges_select on public.destination_charges
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists destination_charges_write on public.destination_charges;
create policy destination_charges_write on public.destination_charges
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

drop policy if exists transportation_charges_select on public.transportation_charges;
create policy transportation_charges_select on public.transportation_charges
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists transportation_charges_write on public.transportation_charges;
create policy transportation_charges_write on public.transportation_charges
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

commit;
