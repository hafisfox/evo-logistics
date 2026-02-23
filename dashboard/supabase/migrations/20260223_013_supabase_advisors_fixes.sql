begin;

-- 1. Security Definer Views (change to security invoker)
alter view public.v_master_rfq_legacy_projection set (security_invoker = true);
alter view public.v_do_charges_legacy set (security_invoker = true);
alter view public.v_destination_charges_legacy set (security_invoker = true);

-- 2. Permissive RLS Policy for workspace_members
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

-- 3. Unindexed Foreign Keys
create index if not exists idx_agent_quotes_shipment on public.agent_quotes (workspace_id, rfq_id, shipment_number);

-- 4. Multiple Permissive Policies (split FOR ALL into INSERT/UPDATE/DELETE)

-- rfq_shipments
drop policy if exists rfq_shipments_write on public.rfq_shipments;
create policy rfq_shipments_insert on public.rfq_shipments for insert to authenticated with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy rfq_shipments_update on public.rfq_shipments for update to authenticated using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']))) with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy rfq_shipments_delete on public.rfq_shipments for delete to authenticated using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

-- rfq_shipment_containers
drop policy if exists rfq_shipment_containers_write on public.rfq_shipment_containers;
create policy rfq_shipment_containers_insert on public.rfq_shipment_containers for insert to authenticated with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy rfq_shipment_containers_update on public.rfq_shipment_containers for update to authenticated using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']))) with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy rfq_shipment_containers_delete on public.rfq_shipment_containers for delete to authenticated using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

-- agent_quotes
drop policy if exists agent_quotes_write on public.agent_quotes;
create policy agent_quotes_insert on public.agent_quotes for insert to authenticated with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy agent_quotes_update on public.agent_quotes for update to authenticated using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member']))) with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));
create policy agent_quotes_delete on public.agent_quotes for delete to authenticated using ((select public.has_workspace_role(workspace_id, array['owner', 'admin', 'member'])));

-- do_charge_profiles
drop policy if exists do_charge_profiles_write on public.do_charge_profiles;
create policy do_charge_profiles_insert on public.do_charge_profiles for insert to authenticated with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));
create policy do_charge_profiles_update on public.do_charge_profiles for update to authenticated using ((select public.has_workspace_role(workspace_id, array['owner', 'admin']))) with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));
create policy do_charge_profiles_delete on public.do_charge_profiles for delete to authenticated using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

-- do_charge_rates
drop policy if exists do_charge_rates_write on public.do_charge_rates;
create policy do_charge_rates_insert on public.do_charge_rates for insert to authenticated with check (exists (select 1 from public.do_charge_profiles p where p.id = profile_id and (select public.has_workspace_role(p.workspace_id, array['owner', 'admin']))));
create policy do_charge_rates_update on public.do_charge_rates for update to authenticated using (exists (select 1 from public.do_charge_profiles p where p.id = profile_id and (select public.has_workspace_role(p.workspace_id, array['owner', 'admin'])))) with check (exists (select 1 from public.do_charge_profiles p where p.id = profile_id and (select public.has_workspace_role(p.workspace_id, array['owner', 'admin']))));
create policy do_charge_rates_delete on public.do_charge_rates for delete to authenticated using (exists (select 1 from public.do_charge_profiles p where p.id = profile_id and (select public.has_workspace_role(p.workspace_id, array['owner', 'admin']))));

-- destination_charge_items
drop policy if exists destination_charge_items_write on public.destination_charge_items;
create policy destination_charge_items_insert on public.destination_charge_items for insert to authenticated with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));
create policy destination_charge_items_update on public.destination_charge_items for update to authenticated using ((select public.has_workspace_role(workspace_id, array['owner', 'admin']))) with check ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));
create policy destination_charge_items_delete on public.destination_charge_items for delete to authenticated using ((select public.has_workspace_role(workspace_id, array['owner', 'admin'])));

-- destination_charge_rates
drop policy if exists destination_charge_rates_write on public.destination_charge_rates;
create policy destination_charge_rates_insert on public.destination_charge_rates for insert to authenticated with check (exists (select 1 from public.destination_charge_items i where i.id = item_id and (select public.has_workspace_role(i.workspace_id, array['owner', 'admin']))));
create policy destination_charge_rates_update on public.destination_charge_rates for update to authenticated using (exists (select 1 from public.destination_charge_items i where i.id = item_id and (select public.has_workspace_role(i.workspace_id, array['owner', 'admin'])))) with check (exists (select 1 from public.destination_charge_items i where i.id = item_id and (select public.has_workspace_role(i.workspace_id, array['owner', 'admin']))));
create policy destination_charge_rates_delete on public.destination_charge_rates for delete to authenticated using (exists (select 1 from public.destination_charge_items i where i.id = item_id and (select public.has_workspace_role(i.workspace_id, array['owner', 'admin']))));

commit;
