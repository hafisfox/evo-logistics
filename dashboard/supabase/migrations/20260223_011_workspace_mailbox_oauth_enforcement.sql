-- Enforce OAuth-backed mailbox connectivity for workspace automations.

update public.workspace_mailboxes
set
  status = 'disconnected',
  last_error = 'Reconnect mailbox via OAuth',
  updated_at = now()
where
  status = 'connected'
  and (
    gmail_refresh_token_encrypted is null
    or btrim(gmail_refresh_token_encrypted) = ''
  );

create index if not exists idx_workspace_mailboxes_status
  on public.workspace_mailboxes (status);

alter table public.workspace_mailboxes
  drop constraint if exists workspace_mailboxes_connected_requires_refresh_token;

alter table public.workspace_mailboxes
  add constraint workspace_mailboxes_connected_requires_refresh_token
  check (
    status <> 'connected'
    or (
      gmail_refresh_token_encrypted is not null
      and btrim(gmail_refresh_token_encrypted) <> ''
    )
  );
