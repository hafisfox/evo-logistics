begin;

-- The Supabase Performance Advisor flags standard uses of `(select auth.uid())` and `(select auth.jwt() ->> 'email')`
-- as `auth_rls_initplan` warnings when they are nested deep inside EXISTS() subqueries on complex OR-heavy policies.
-- By restructuring the workspace_members_insert policy to evaluate the static auth checks at the top-level AND block,
-- and isolating the EXISTS lookups, the query planner can accurately identify the deterministic auth conditions
-- before evaluating the costlier subqueries, silencing the false-positive warning and slightly improving insertion cost.

drop policy if exists workspace_members_insert on public.workspace_members;

create policy workspace_members_insert on public.workspace_members
  for insert to authenticated
  with check (
    -- Group 1: The current user MUST be the one accepting the invite OR bootstrapping their own ownership.
    (
      user_id = (select auth.uid())
      and (
        -- Path A: Bootstrap initial owner
        (
          role = 'owner'
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
        -- Path B: Invite Acceptance
        (
          exists (
            select 1
            from public.workspace_invites wi
            where wi.workspace_id = workspace_members.workspace_id
              and lower(wi.email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
              and wi.status = 'pending'
              and wi.role = workspace_members.role
              and wi.expires_at > now()
          )
        )
      )
    )
    or
    -- Group 2: Existing owners/admins can insert anyone directly.
    (
      (select public.has_workspace_role(workspace_members.workspace_id, array['owner', 'admin']))
    )
  );

commit;
