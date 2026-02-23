begin;

drop policy if exists workspace_invites_write on public.workspace_invites;
drop policy if exists workspace_invites_insert_manage on public.workspace_invites;
drop policy if exists workspace_invites_insert_member on public.workspace_invites;
drop policy if exists workspace_invites_update_manage on public.workspace_invites;
drop policy if exists workspace_invites_delete_manage on public.workspace_invites;
drop policy if exists workspace_invites_update_invitee_accept on public.workspace_invites;

create policy workspace_invites_insert_manage on public.workspace_invites
  for insert to authenticated
  with check (
    (select public.has_workspace_role(workspace_id, array['owner', 'admin']))
  );

create policy workspace_invites_insert_member on public.workspace_invites
  for insert to authenticated
  with check (
    (select public.has_workspace_role(workspace_id, array['member']))
    and role = 'member'
    and status = 'pending'
    and invited_by = (select auth.uid())
  );

create policy workspace_invites_update_manage on public.workspace_invites
  for update to authenticated
  using (
    (select public.has_workspace_role(workspace_id, array['owner', 'admin']))
  )
  with check (
    (select public.has_workspace_role(workspace_id, array['owner', 'admin']))
  );

create policy workspace_invites_delete_manage on public.workspace_invites
  for delete to authenticated
  using (
    (select public.has_workspace_role(workspace_id, array['owner', 'admin']))
  );

create policy workspace_invites_update_invitee_accept on public.workspace_invites
  for update to authenticated
  using (
    lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    and status = 'pending'
  )
  with check (
    lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    and (
      status = 'expired'
      or (
        status = 'accepted'
        and accepted_by = (select auth.uid())
        and accepted_at is not null
      )
    )
  );

update public.workspace_invites wi
set
  status = 'accepted',
  accepted_at = coalesce(wi.accepted_at, wm.created_at, now()),
  accepted_by = coalesce(wi.accepted_by, wm.user_id),
  updated_at = now()
from public.workspace_members wm
join auth.users au
  on au.id = wm.user_id
where wi.workspace_id = wm.workspace_id
  and wi.status = 'pending'
  and wm.status = 'active'
  and wi.role = wm.role
  and lower(wi.email) = lower(au.email);

commit;
