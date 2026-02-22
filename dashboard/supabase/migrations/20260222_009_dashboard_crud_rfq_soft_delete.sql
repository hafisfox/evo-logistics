begin;

alter table public.master_rfqs
  add column if not exists deleted_at timestamptz;

create index if not exists idx_master_rfqs_workspace_deleted_received
  on public.master_rfqs (workspace_id, deleted_at, received_at desc);

commit;
