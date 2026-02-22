begin;

-- Ensure membership helper exists and is executable by authenticated users.
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

-- Enforce RLS across tenant-scoped tables.
alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_members force row level security;
alter table public.workspace_invites enable row level security;
alter table public.workspace_invites force row level security;
alter table public.workspace_mailboxes enable row level security;
alter table public.workspace_mailboxes force row level security;
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;
alter table public.master_rfqs enable row level security;
alter table public.master_rfqs force row level security;
alter table public.agent_outbound_log enable row level security;
alter table public.agent_outbound_log force row level security;
alter table public.agents enable row level security;
alter table public.agents force row level security;
alter table public.do_charges enable row level security;
alter table public.do_charges force row level security;
alter table public.destination_charges enable row level security;
alter table public.destination_charges force row level security;
alter table public.transportation_charges enable row level security;
alter table public.transportation_charges force row level security;
alter table public.app_settings enable row level security;
alter table public.app_settings force row level security;

-- Remove any legacy public read policies from pre-tenant schema.
drop policy if exists "Allow public read access" on public.master_rfqs;
drop policy if exists "Allow public read access" on public.agent_outbound_log;
drop policy if exists "Allow public read access" on public.agents;
drop policy if exists "Allow public read access" on public.do_charges;
drop policy if exists "Allow public read access" on public.destination_charges;
drop policy if exists "Allow public read access" on public.transportation_charges;

-- Workspace policies.
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

-- Workspace members policies (bootstrap + invite acceptance).
drop policy if exists workspace_members_write on public.workspace_members;
drop policy if exists workspace_members_insert on public.workspace_members;
drop policy if exists workspace_members_update on public.workspace_members;
drop policy if exists workspace_members_delete on public.workspace_members;
drop policy if exists workspace_members_select on public.workspace_members;

create policy workspace_members_select on public.workspace_members
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy workspace_members_insert on public.workspace_members
  for insert to authenticated
  with check (
    (
      user_id = (select auth.uid())
      and role = 'owner'
      and status = 'active'
      and exists (
        select 1
        from public.workspaces w
        where w.id = workspace_id
          and w.created_by = (select auth.uid())
          and w.deleted_at is null
      )
    )
    or
    (
      user_id = (select auth.uid())
      and exists (
        select 1
        from public.workspace_invites wi
        where wi.workspace_id = workspace_members.workspace_id
          and lower(wi.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
          and wi.status = 'pending'
          and wi.role = workspace_members.role
          and wi.expires_at > now()
      )
    )
    or
    (
      (select public.has_workspace_role(workspace_id, array['owner', 'admin']))
    )
  );

create policy workspace_members_update on public.workspace_members
  for update to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

create policy workspace_members_delete on public.workspace_members
  for delete to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

-- Workspace invites: allow invitee to read their pending invite row.
drop policy if exists workspace_invites_select on public.workspace_invites;
create policy workspace_invites_select on public.workspace_invites
  for select to authenticated
  using (
    (select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']))
    or (
      lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
      and status = 'pending'
      and expires_at > now()
    )
  );

drop policy if exists workspace_invites_write on public.workspace_invites;
create policy workspace_invites_write on public.workspace_invites
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

-- Tenant-scoped operational policies.
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
