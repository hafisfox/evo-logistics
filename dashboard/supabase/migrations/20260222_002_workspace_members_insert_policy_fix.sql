begin;

-- Fix bootstrap + invite acceptance inserts on workspace_members.
-- v1 policy only allowed users who were already owner/admin, which blocks
-- first owner membership creation for newly created workspaces.

drop policy if exists workspace_members_write on public.workspace_members;
drop policy if exists workspace_members_insert on public.workspace_members;
drop policy if exists workspace_members_update on public.workspace_members;
drop policy if exists workspace_members_delete on public.workspace_members;

create policy workspace_members_insert on public.workspace_members
  for insert to authenticated
  with check (
    (
      -- Workspace creator can bootstrap own owner membership.
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
      -- User can accept a pending invite for their own email.
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
      -- Existing owner/admin can insert memberships directly.
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

commit;
