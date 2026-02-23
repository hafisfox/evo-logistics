begin;

create index if not exists idx_agent_quotes_workspace_rfq_received
  on public.agent_quotes (workspace_id, rfq_id)
  where status = 'Received';

create index if not exists idx_agent_outbound_log_workspace_rfq_received
  on public.agent_outbound_log (workspace_id, rfq_id)
  where status = 'Received';

commit;
