begin;

-- Legacy databases can still have global constraints from the pre-workspace schema:
--   agents_pkey(agent_name) and agents_email_key(email).
-- Those make agent records effectively shared across workspaces.
alter table public.agents
  drop constraint if exists agents_pkey;

alter table public.agents
  drop constraint if exists agents_email_key;

alter table public.agents
  drop constraint if exists agents_agent_name_key;

alter table public.agents
  drop constraint if exists agents_workspace_id_email_key;

alter table public.agents
  add constraint agents_pkey primary key (workspace_id, agent_name);

alter table public.agents
  add constraint agents_workspace_id_email_key unique (workspace_id, email);

create index if not exists idx_agents_workspace_id
  on public.agents (workspace_id);

commit;
