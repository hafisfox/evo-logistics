# AUTOMATIONS.md — Modal Automations (Workspace-Aware)

Updated: 2026-02-23

## 1. Purpose

This directory contains the Modal automation phases that process RFQs, parse agent quotes, run follow-ups, and execute quote-selection outcomes.

All Gmail access is now workspace-scoped and OAuth-backed through `workspace_mailboxes`.

## 2. Runtime Topology

- Platform: Modal shared workers
- Trigger style:
  - phase 1/2: Gmail Pub/Sub push -> Modal webhook
  - phase 3: dashboard API call -> Modal webhook
  - scheduled tasks: Modal cron
- Database: Supabase Postgres via service-role key

## 3. Files

- `phase_1_request_analysis.py`
- `phase_2_quote_analysis.py`
- `phase_3_select_and_quote.py`
- `scheduled_tasks.py`
- `tenant_context.py`
- `gmail_workspace_auth.py` (workspace Gmail credential resolver + refresh/persist)
- `authenticate_google.py` (legacy local helper; not used by production flow)

## 4. Tenant Context and Isolation

Resolver module `automations/tenant_context.py` centralizes:

- mailbox extraction from Pub/Sub payload (`extract_pubsub_mailbox`)
- workspace lookup via `workspace_mailboxes` (`resolve_workspace_id`)
- scoped DB helpers:
  - `scoped_select`
  - `scoped_eq_filter`
  - `scoped_upsert`
  - `scoped_update_by_eq`

Tenant-scoped tables include:

- `master_rfqs`
- `agent_outbound_log`
- `agents`
- `do_charges`
- `destination_charges`
- `transportation_charges`
- `app_settings`
- `workspace_mailboxes`
- `workspace_invites`
- `workspace_members`
- `audit_events`

Constraint note:

- `agents` is keyed per workspace (`workspace_id + agent_name`) with per-workspace email uniqueness (`workspace_id + email`).
- hardening migration: `dashboard/supabase/migrations/20260222_010_fix_agents_workspace_scoping.sql`.

Unknown mailbox behavior:

- if mailbox -> workspace resolution fails, ingress is ignored and audited.
- fallback mode is optional and should stay disabled in production:
  - `ALLOW_BOOTSTRAP_WORKSPACE_FALLBACK=true`
  - `BOOTSTRAP_WORKSPACE_ID=...`

## 5. Gmail OAuth Model (Current)

- One mailbox row per workspace (`workspace_mailboxes` PK on `workspace_id`).
- `status='connected'` requires encrypted refresh token (DB-enforced).
- Tokens are encrypted with shared key `MAILBOX_TOKEN_ENCRYPTION_KEY`.
- `gmail_workspace_auth.py` decrypts tokens, refreshes access tokens when needed, and persists refreshed values.
- Global `token.json` + global `OWN_EMAIL` runtime dependency is removed from automation phases.
- Sender filtering and outbound mailbox identity are resolved per workspace mailbox row.

Enforcement migration:

- `dashboard/supabase/migrations/20260223_011_workspace_mailbox_oauth_enforcement.sql`

## 6. Phase Behavior (Current)

### Phase 1 (`phase_1_request_analysis.py`)

- resolves workspace from Pub/Sub mailbox metadata
- resolves Gmail credentials from workspace mailbox row
- reads `agents` scoped by workspace
- writes `master_rfqs` and `agent_outbound_log` with workspace context
- preserves workspace-safe thread correlation and deterministic extraction behavior

### Phase 2 (`phase_2_quote_analysis.py`)

- resolves workspace from Pub/Sub mailbox metadata
- resolves Gmail credentials from workspace mailbox row
- parses/normalizes quote replies with workspace-scoped RFQ context
- writes quote outcomes with workspace scoping and deduplicated `match` identity

### Phase 3 (`phase_3_select_and_quote.py`)

- requires `workspace_id` in request payload
- resolves Gmail credentials from `workspace_id`
- reads/writes RFQ and quote tables in that workspace only

### Scheduled Tasks (`scheduled_tasks.py`)

- resolves Gmail credentials per workspace row before sending reminders/follow-ups
- defaults notification targets to the connected workspace mailbox

## 7. Gmail Watch Renewal

Both phase 1 and phase 2 expose `renew_gmail_watch`:

- loops connected workspace mailbox rows
- builds Gmail client from workspace OAuth credentials
- renews Gmail watch per workspace mailbox
- marks mailbox rows with error state/details when renewal fails
- skips when no connected rows exist

## 8. Environment Variables

Required:

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_PUBSUB_TOPIC`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `MAILBOX_TOKEN_ENCRYPTION_KEY`

Optional:

- `MODAL_LLM_API_KEY`
- `BOOTSTRAP_WORKSPACE_ID`
- `ALLOW_BOOTSTRAP_WORKSPACE_FALLBACK`

Reference file:

- `automations/.env.example`

## 9. Deployment

```bash
python3 -m modal deploy automations/phase_1_request_analysis.py
python3 -m modal deploy automations/phase_2_quote_analysis.py
python3 -m modal deploy automations/phase_3_select_and_quote.py
python3 -m modal deploy automations/scheduled_tasks.py
```

## 10. Current Live Endpoints

- phase 1 webhook: `https://hafisjavad--rfq-analyzer-phase-1-gmail-push-phase1.modal.run`
- phase 2 webhook: `https://hafisjavad--quote-analysis-phase-2-gmail-push-phase2.modal.run`
- phase 3 select endpoint: `https://hafisjavad--select-and-quote-phase-3-select-agent.modal.run`

## 11. Post-Deploy Operations

After each workspace mailbox is connected in dashboard settings:

```bash
python3 -m modal run automations/phase_1_request_analysis.py::renew_gmail_watch
python3 -m modal run automations/phase_2_quote_analysis.py::renew_gmail_watch
```

## 12. Verification

From repo root:

```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile automations/*.py
python3 -m pytest automations/tests -q
```
