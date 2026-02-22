begin;

-- Fix invite acceptance predicate on workspace_members INSERT policy.
-- Previous policy versions compared invite fields to themselves because of
-- unqualified column references, which could allow cross-workspace invite reuse.
drop policy if exists workspace_members_insert on public.workspace_members;

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
      -- Invite acceptance path (must be pending and unexpired for this workspace/role).
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
      (select public.has_workspace_role(workspace_members.workspace_id, array['owner', 'admin']))
    )
  );

commit;
