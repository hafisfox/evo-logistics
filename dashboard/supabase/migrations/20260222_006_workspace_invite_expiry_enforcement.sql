begin;

-- Hard reset policies on membership/invite tables so invite acceptance rules
-- are deterministic and enforce expiration checks.
do $$
declare
  tbl text;
  pol record;
begin
  foreach tbl in array array['workspace_members', 'workspace_invites']
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('alter table public.%I force row level security', tbl);

    for pol in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = tbl
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
    end loop;
  end loop;
end $$;

create policy workspace_members_select on public.workspace_members
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy workspace_members_insert on public.workspace_members
  for insert to authenticated
  with check (
    (
      -- Workspace creator can bootstrap initial owner membership.
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
      -- Invite acceptance path (must be pending and unexpired).
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
      -- Existing owner/admin can add members directly.
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

create policy workspace_invites_write on public.workspace_invites
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

commit;
