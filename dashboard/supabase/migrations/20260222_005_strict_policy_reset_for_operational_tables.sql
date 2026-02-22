begin;

-- Hard reset policies on tenant-scoped operational tables to remove any
-- unknown legacy/public-read policies that may still exist.
do $$
declare
  tbl text;
  pol record;
begin
  foreach tbl in array array[
    'master_rfqs',
    'agent_outbound_log',
    'agents',
    'do_charges',
    'destination_charges',
    'transportation_charges',
    'app_settings'
  ]
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

create policy master_rfqs_select on public.master_rfqs
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy master_rfqs_write on public.master_rfqs
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy agent_outbound_log_select on public.agent_outbound_log
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy agent_outbound_log_write on public.agent_outbound_log
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy agents_select on public.agents
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy agents_write on public.agents
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

create policy do_charges_select on public.do_charges
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy do_charges_write on public.do_charges
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

create policy destination_charges_select on public.destination_charges
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy destination_charges_write on public.destination_charges
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

create policy transportation_charges_select on public.transportation_charges
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy transportation_charges_write on public.transportation_charges
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

create policy app_settings_select on public.app_settings
  for select to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

create policy app_settings_write on public.app_settings
  for all to authenticated
  using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])))
  with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

commit;
