begin;

-- Fix bootstrap flow:
-- workspace_members_insert checks workspaces.created_by during first owner insert.
-- If workspace creators cannot SELECT their own new workspace row, that EXISTS check
-- is blocked by RLS and owner membership bootstrap fails.
drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
  for select to authenticated
  using (
    created_by = (select auth.uid())
    or (select public.has_workspace_role(id, array['owner', 'admin', 'member']))
  );

commit;
