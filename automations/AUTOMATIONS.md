# AUTOMATIONS.md — Modal Automations (Workspace-Aware)

Updated: 2026-02-22

## 1. Purpose

This directory contains the serverless automation phases that process RFQs, parse agent quotes, and send final pricing actions.

The automations are now workspace-aware and align with the dashboard multi-tenant model.

## 2. Runtime Topology

- Platform: Modal.com shared workers
- Trigger style:
  - Phase 1/2: Gmail Pub/Sub push -> Modal webhook
  - Phase 3: Dashboard API call -> Modal webhook
  - Scheduled: Modal cron
- Database: Supabase PostgreSQL (service-role key)

## 3. Files

- `phase_1_request_analysis.py`
- `phase_2_quote_analysis.py`
- `phase_3_select_and_quote.py`
- `scheduled_tasks.py`
- `tenant_context.py`
- `authenticate_google.py`

## 4. Tenant Context and Isolation

### Resolver module
`automations/tenant_context.py` centralizes:

- mailbox extraction from Pub/Sub payload (`extract_pubsub_mailbox`)
- workspace lookup via `workspace_mailboxes` (`resolve_workspace_id`)
- scoped DB helpers:
  - `scoped_select`
  - `scoped_eq_filter`
  - `scoped_upsert`
  - `scoped_update_by_eq`

### Tenant table scope
The following are treated as tenant-scoped in automation helpers:

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
- `agents` must be keyed per workspace (`workspace_id + agent_name`) with per-workspace email uniqueness (`workspace_id + email`).
- Legacy global constraints are fixed by migration `dashboard/supabase/migrations/20260222_010_fix_agents_workspace_scoping.sql`.

### Unknown mailbox handling
If mailbox->workspace resolution fails, phase webhooks are ignored by default and an audit row is written.

Optional compatibility mode is still available:

- env: `ALLOW_BOOTSTRAP_WORKSPACE_FALLBACK=true`
- fallback workspace env: `BOOTSTRAP_WORKSPACE_ID` (default `00000000-0000-0000-0000-000000000001`)

Use compatibility mode only during transitional cutover.

## 5. Phase Behavior (Current)

### Phase 1 (`phase_1_request_analysis.py`)

- Resolves workspace from incoming Pub/Sub mailbox metadata.
- Reads `agents` scoped by workspace.
- Writes `master_rfqs` and `agent_outbound_log` with workspace context.
- Avoids cross-workspace thread collisions by querying known threads per workspace.
- Builds structured prompt input with `EMAIL_METADATA` + `email_received_at` + raw `EMAIL_BODY` for RFQ extraction.
- Uses hardened extraction rules for door/port detection, date anchoring to email-received date, origin-option splitting (e.g. `NANSHA,YANTIAN`), and duplicate container-mention aggregation.
- Uses deterministic LLM extraction settings for Phase 1 (`temperature=0`) and normalizes output through existing schema validators.

### Phase 2 (`phase_2_quote_analysis.py`)

- Resolves workspace from incoming Pub/Sub mailbox metadata.
- Reads/writes quote and RFQ rows in workspace scope.
- Loads canonical RFQ context (`master_rfqs`) before parsing each agent reply.
- Trims quoted email history (`Original Message`, `On ... wrote`, `From:`, `Sent:`) and parses only current reply content.
- Sends structured `RFQ_CONTEXT` (shipment_number/routes/container mix/service type + `email_received_at`) to the LLM prompt.
- Uses conservative extraction rules:
  - only explicit ocean-freight rates are accepted
  - non-ocean extras (EXW/THC/DOC/CUS/ENS/NOC/inspection/TLX/CO/local handling) are excluded from `price`
  - ambiguous multi-shipment replies are rejected as `Invalid_Quote`
- Normalizes carrier/date fields and deduplicates identical quote options before persistence.
- Builds unique quote `match` keys using a short hash over option fields to preserve same-carrier multi-option quotes.
- Threshold checks run against workspace-scoped quote rows.

### Phase 3 (`phase_3_select_and_quote.py`)

- Requires `workspace_id` in request payload.
- Reads RFQ/quote/pricing tables only in that workspace.
- Refuses selection if RFQ is not found in the provided workspace.
- Supports exact quote selection via `selected_match`; falls back to legacy agent+carrier+shipment matching if missing.

### Scheduled Tasks (`scheduled_tasks.py`)

- Reminder/follow-up updates include workspace scoping.
- Prevents status updates leaking across workspace boundaries.

## 6. Gmail Watch Renewal

Both phase 1 and phase 2 include `renew_gmail_watch` that:

- loops connected mailbox rows from `workspace_mailboxes`
- renews watches per mailbox
- skips renewal if no connected mailbox rows exist

This supports one mailbox per workspace model.

## 7. OAuth Credential Model

### Current state

- Existing token-based Gmail access path remains available for compatibility.
- Workspace mailbox mapping (`workspace_mailboxes`) is used for routing and watch targeting.

### Hardening backlog

- finalize per-workspace OAuth token lifecycle (connect/rotate/revoke) in dashboard UX
- enforce encrypted token format shared by dashboard + automations
- emit audit events for mailbox disconnect/error transitions

## 8. Required Environment Variables

### Common
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_PUBSUB_TOPIC`
- `OWN_EMAIL`

### Optional / compatibility
- `MODAL_LLM_API_KEY`
- `BOOTSTRAP_WORKSPACE_ID`
- `ALLOW_BOOTSTRAP_WORKSPACE_FALLBACK`

## 9. Deployment

```bash
modal deploy automations/phase_1_request_analysis.py
modal deploy automations/phase_2_quote_analysis.py
modal deploy automations/phase_3_select_and_quote.py
modal deploy automations/scheduled_tasks.py
```

## 10. Current Live Endpoints

- Phase 1 webhook:
  - `https://hafisjavad--rfq-analyzer-phase-1-gmail-push-phase1.modal.run`
- Phase 2 webhook:
  - `https://hafisjavad--quote-analysis-phase-2-gmail-push-phase2.modal.run`
- Phase 3 select endpoint:
  - `https://hafisjavad--select-and-quote-phase-3-select-agent.modal.run`

## 11. Post-Deploy Operations

- Renew phase 1 watch:
  - `python3 -m modal run automations/phase_1_request_analysis.py::renew_gmail_watch`
- Renew phase 2 watch:
  - `python3 -m modal run automations/phase_2_quote_analysis.py::renew_gmail_watch`

## 12. Verification

From repo root:

```bash
PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile automations/*.py
python3 -m pytest automations/tests -q
```

Operational note:
- keep `ALLOW_BOOTSTRAP_WORKSPACE_FALLBACK=false` in production.

## 13. Prompt Evaluation Harness

Synthetic prompt-eval assets are included for both intake and quote parsing:

### Phase 1 RFQ intake eval

- evaluator script: `automations/tests/eval_phase1_prompt_fixtures.py`
- fixtures: `automations/tests/fixtures/phase1_prompt_eval_cases.txt`

Run:

```bash
OPENAI_API_KEY=... python3 automations/tests/eval_phase1_prompt_fixtures.py
```

Reported metrics include:

- schema-valid rate
- shipment count accuracy
- route accuracy (`pol`/`pod`/`pod_hint`)
- container accuracy
- service-type accuracy
- date accuracy
- routing-action accuracy
- `complete_expected_but_missing_predicted`

Current strict acceptance gates:

- `schema_invalid_count == 0`
- `route_accuracy >= 0.95`
- `container_accuracy >= 0.95`
- `service_type_accuracy >= 0.95`
- `date_accuracy >= 0.95`
- `action_accuracy >= 0.95`
- `complete_expected_but_missing_predicted == 0`

### Phase 2 quote eval

- evaluator script: `automations/tests/eval_phase2_prompt_fixtures.py`
- fixtures: `automations/tests/fixtures/phase2_prompt_eval_cases.txt`

Run:

```bash
OPENAI_API_KEY=... python3 automations/tests/eval_phase2_prompt_fixtures.py
```

Reported metrics include:

- quote presence precision/recall
- exact price accuracy
- shipment mapping accuracy
- ETD/TT/free-time extraction accuracy
- same-carrier multi-option preservation rate
