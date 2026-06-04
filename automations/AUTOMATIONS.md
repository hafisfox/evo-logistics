# AUTOMATIONS.md — Modal Automations (Workspace-Aware)

Updated: 2026-03-04

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
- `phase_4_market_rates.py` (land-freight external rate aggregation endpoint)
- `scheduled_tasks.py`
- `tenant_context.py`
- `detention.py` (D&D fee math used by `scheduled_tasks.check_detention_demurrage`)
- `freight_apis/` (external rate provider package: `base`, `dat`, `smc3`, `uber_freight`, `vucem`, `mocks`)
- `gmail_workspace_auth.py` (workspace Gmail credential resolver + refresh/persist)

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
- `rfq_shipments`
- `rfq_shipment_containers`
- `agent_quotes`
- `agents`
- `do_charges`
- `do_charge_profiles`
- `do_charge_rates`
- `destination_charges`
- `destination_charge_items`
- `destination_charge_rates`
- `transportation_charges`
- `app_settings`
- `workspace_mailboxes`
- `workspace_invites`
- `workspace_members`
- `audit_events`
- `processed_email_events`
- `rfq_id_aliases`
- `external_rate_quotes`
- `detention_demurrage_events`
- `exchange_rates`
- `activity_logs`
- `rfq_notes`
- `rfq_shipment_pieces`
- `rfq_shipment_truck_details`
- `air_carrier_profiles`
- `air_charge_rates`
- `truck_carrier_profiles`
- `truck_lane_rates`
- `ltl_freight_classes`
- `drayage_rates`

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
- Dashboard OAuth callback now initializes Gmail INBOX watch at connect-time and stores `watch_expiration`, so newly connected mailboxes are active immediately.

Enforcement migration:

- `dashboard/supabase/migrations/20260223_011_workspace_mailbox_oauth_enforcement.sql`

## 6. Phase Behavior (Current)

### Phase 1 (`phase_1_request_analysis.py`)

- resolves workspace from Pub/Sub mailbox metadata
- resolves Gmail credentials from workspace mailbox row
- reads `agents` scoped by workspace
- writes `master_rfqs` and `agent_outbound_log` with workspace context
- dual-write mode persists normalized shipments and shipment containers when `RFQ_NORMALIZED_DUAL_WRITE=true`
- preserves workspace-safe thread correlation and deterministic extraction behavior
- unread query intentionally excludes self-sent messages (`-from:<connected mailbox>`) to prevent reply loops; RFQ ingestion tests must use a different sender mailbox.
- **Ocean freight fields (2026-03-04):** extracts `commodity_description`, `hs_code`, `incoterms` (EXW/FOB/CIF/CFR/CPT/CIP/DAP/DPU/DDP/FCA/FAS), `is_dangerous_goods`, `dg_class`, `is_reefer`, `reefer_temperature`, `special_requirements`, `cargo_weight_kg`, `cargo_volume_cbm` from customer emails; writes to `rfq_shipments` new columns; includes all cargo details in agent outreach emails.

### Phase 2 (`phase_2_quote_analysis.py`)

- resolves workspace from Pub/Sub mailbox metadata
- resolves Gmail credentials from workspace mailbox row
- parses/normalizes quote replies with workspace-scoped RFQ context
- writes quote outcomes with workspace scoping and deduplicated `match` identity
- dual-write mode persists normalized quote rows in `agent_quotes` when `RFQ_NORMALIZED_DUAL_WRITE=true`
- **Surcharge extraction (2026-03-04):** extracts surcharges as JSONB (`baf`, `caf`, `thc`, `pss`, `gri`, `isps`, `orc`, `war_risk`, `congestion`); structured `free_time_details` (demurrage_days, detention_days, combined_days); `validity_date` (ISO date parsed from free-text); `conditions` (quoted string). Sanitization: non-negative surcharges, free_time cap at 90 days.

### Phase 3 (`phase_3_select_and_quote.py`)

- requires `workspace_id` in request payload
- resolves Gmail credentials from `workspace_id`
- reads/writes RFQ and quote tables in that workspace only
- reads normalized tables first when `RFQ_NORMALIZED_READ_SOURCE=normalized|shadow`, with legacy fallback retained for safety
- **Surcharge-aware pricing (2026-03-04):** replaced hardcoded `EXCHANGE_RATE = 3.685` with `get_exchange_rate()` DB lookup (fallback to 3.685); `sum_surcharges()` + surcharge-inclusive subtotals in `calculate_port_price`/`calculate_door_price`/`calculate_full_pricing`; quotation email shows USD amounts, surcharge breakdown, free_time_details, conditions, validity_date; sales notification includes margin %, FX rate, per-shipment margin column.

### Phase 4 (`phase_4_market_rates.py`)

- `fetch_market_rates` web endpoint (POST `{workspace_id, origin, destination, ...}`); dashboard triggers it via `MODAL_WEBHOOK_MARKET_RATES`.
- aggregates land rates across providers via `freight_apis.aggregate_land_rates` (DAT, SMC3, Uber Freight, Loadsmart).
- **Mock-first:** providers return synthetic responses unless `FREIGHT_API_MODE=live` **and** the provider's credentials are set; arriving credentials are a config switch, not a code change.
- persists a one-snapshot-per-lane result to `external_rate_quotes` (workspace-scoped, `source='api'`). These are **market-rate intelligence only** — not fed into customer pricing.
- `freight_apis.vucem.VucemCrossBorder` is a P2 cross-border scaffold (USMCA cert / pedimento, mock-only).

### Scheduled Tasks (`scheduled_tasks.py`)

- resolves Gmail credentials per workspace row before sending reminders/follow-ups
- ensures strict cross-tenant data isolation (queries explicitly loop through active `workspace_id`s instead of leaking across tenants)
- implements idempotent agent reminder updates using compound keys (`workspace_id`, `rfq_id`, `agent_email`)
- updates `agent_outbound_log` with the new `'Reminded'` enum status
- **Multi-step escalation (2026-03-04):** `reminder_count` column tracks escalation level; timing: 0→3hrs, 1→6hrs, 2→12hrs, 3→auto-close (MAX_REMINDER_COUNT=3); escalating tone (gentle → 2nd follow-up → urgent).
- **Quote expiry check (2026-03-04):** runs every 6 hours; marks quotes past `validity_date` as `Expired`; logs to `activity_logs`.
- **Stale RFQ detection (2026-03-04):** runs every 4 hours; flags RFQs with no quotes after 48 hours; logs to `activity_logs`.
- **Detention/demurrage accrual (Phase 4):** `check_detention_demurrage` runs every 6 hours; for each `accruing` `detention_demurrage_events` row past its `free_until`, computes `fee_usd = detention.calculate_dd_fee(...)`, updates the row, and logs to `activity_logs`. Internal alert email is opt-in via `DD_ALERT_EMAILS=true`.

### Data Types & Schema Additions

A robust optimization pass was applied to the Supabase schema:
- **Timestamp strings:** `sent_at`, `received_at`, and `quoted_at` are stored as `TEXT` (format: `YYYY-MM-DD HH:MI AM`) to exactly match the UAE local-time strings produced by the automations without risking Postgres timezone coercion bugs.
- **Date columns:** `etd` and `validity` in both `agent_outbound_log` and `agent_quotes` are `DATE` type — automation code must write `None`/`NULL` (not `'N/A'` strings) when no date is available.
- **Numeric columns:** `price` in `agent_outbound_log` is `NUMERIC` — write `None`/`NULL` for invalid quotes, not `'N/A'`.
- **NOT NULL text columns:** `carrier` in `agent_outbound_log` is `NOT NULL` — outreach rows must supply a default (e.g. `'Pending'`).
- **Durations:** `transit_time` and `free_time` are stored as `TEXT` in `agent_outbound_log` and `INTEGER` in `agent_quotes`.
- **Deduplication:** Manager threshold notifications fire exactly once when `quote_count == QUOTE_THRESHOLD`, preventing duplicate emails on subsequent quotes.

## 7. Gmail Watch Lifecycle

Initial watch setup:

- dashboard OAuth callback initializes Gmail watch when mailbox connect/reconnect succeeds.
- callback persists `workspace_mailboxes.watch_expiration` and logs watch metadata in `audit_events`.
- dashboard runtime requires `GOOGLE_PUBSUB_TOPIC` for this step.

Renewal path:

Both phase 1 and phase 2 expose `renew_gmail_watch` for periodic maintenance:

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
- `RFQ_NORMALIZED_DUAL_WRITE` (default: `true`)
- `RFQ_NORMALIZED_READ_SOURCE` (`legacy` | `shadow` | `normalized`; production now uses `normalized`)
- `FREIGHT_API_MODE` (`mock` | `live`; default `mock`) — Phase 4 freight APIs
- `DAT_API_KEY`, `SMC3_USERNAME`, `SMC3_PASSWORD`, `UBER_FREIGHT_API_KEY`, `LOADSMART_API_KEY` — per-provider creds (live mode only)
- `VUCEM_RFC`, `VUCEM_API_KEY` — cross-border scaffold (live mode only)
- `DD_ALERT_EMAILS` (default: `false`) — internal detention/demurrage alert emails

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

Optional recovery operation (only if `watch_expiration` is null/stale or watch setup failed):

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

LLM prompt-eval harnesses (manual, require `OPENAI_API_KEY`, incur OpenAI cost — not part of the CI gate):

```bash
OPENAI_API_KEY=... python3 automations/tests/eval_phase1_prompt_fixtures.py   # ocean extraction
OPENAI_API_KEY=... python3 automations/tests/eval_phase1_air_fixtures.py       # air mode-detection (>=0.90) + air extraction
OPENAI_API_KEY=... python3 automations/tests/eval_phase2_prompt_fixtures.py    # quote parsing
```

## 13. Normalization Cutover Status

- Migration `dashboard/supabase/migrations/20260223_012_rfq_and_pricing_normalization.sql` applied.
- Historical backfill completed via `dashboard/scripts/backfill_rfq_normalized.ts`.
- Current runtime mode:
  - `RFQ_NORMALIZED_DUAL_WRITE=true`
  - `RFQ_NORMALIZED_READ_SOURCE=normalized`
- Post-cutover parity check is clean (`agent_outbound_log` and `agent_quotes` have zero unmatched `match` rows).
