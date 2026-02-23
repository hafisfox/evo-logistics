# ACTION_PLAN.md — Workspace-Centric Logistics SaaS

Updated: 2026-02-23

## Objective
Ship a workspace-based logistics dashboard + automation system where each authenticated user only sees and mutates data for workspaces they belong to, while still supporting team collaboration with roles.

## Final Product Model

- Tenancy: hybrid personal + team workspaces.
- Signup: open signup with email magic link and Google OAuth.
- Team join: invite-only (Owner/Admin issues invite token).
- Roles:
  - `owner`: full workspace control.
  - `admin`: workspace config + member/invite management.
  - `member`: RFQ operations only.
- Mailbox model: one mailbox mapping per workspace (`workspace_mailboxes`).
- Automation topology: shared multi-tenant Modal workers with workspace scoping.
- Deletion model: soft delete markers (`deleted_at`) with recovery window handled operationally.

## Current Implementation State

### 1. Multi-tenant data model and RLS
Implemented in `dashboard/supabase/migrations/20260222_001_multitenant_workspaces.sql` and reflected in `dashboard/supabase_schema.sql`.
Legacy tenant-hardening patch is in `dashboard/supabase/migrations/20260222_010_fix_agents_workspace_scoping.sql`.

- New tables:
  - `workspaces`
  - `workspace_members`
  - `workspace_invites`
  - `workspace_mailboxes`
  - `audit_events`
  - `user_profiles`
- Tenant key (`workspace_id`) added to:
  - `master_rfqs`
  - `agent_outbound_log`
  - `agents`
  - `do_charges`
  - `destination_charges`
  - `transportation_charges`
  - `app_settings`
- Workspace-scoped constraints/indexes are in place.
- Agents table explicitly re-hardened for workspace isolation:
  - `primary key (workspace_id, agent_name)`
  - `unique (workspace_id, email)`
- Legacy public-read policies removed.
- Force RLS enabled and role-aware policy checks implemented via `public.has_workspace_role(...)`.

### 2. Dashboard auth + workspace context

- Auth pages:
  - `dashboard/src/app/login/page.tsx`
  - `dashboard/src/app/signup/page.tsx`
- Hash-fragment session fallback handler (for provider/site-url edge cases):
  - `dashboard/src/app/login/hash-session-handler.tsx`
  - reused by login and signup pages
- Post-auth bootstrap (personal workspace + owner membership + profile default workspace):
  - `dashboard/src/app/auth/callback/route.ts`
  - `dashboard/src/app/auth/confirm/route.ts`
  - `dashboard/src/lib/workspaces.ts`
- Workspace context enforcement:
  - `dashboard/src/lib/workspace-context.ts`
- Onboarding guard:
  - `dashboard/src/lib/supabase/middleware.ts`
  - `dashboard/src/app/onboarding/page.tsx`

### 3. Dashboard account/workspace/team UX

- Account settings:
  - `dashboard/src/app/settings/account/page.tsx`
  - profile updates, MFA flag toggle, global session revoke, soft-delete request.
- Workspace settings:
  - `dashboard/src/app/settings/workspace/page.tsx`
  - pricing constants + workspace mailbox OAuth connect/reconnect/disconnect UI.
- Members/invites UI:
  - `dashboard/src/app/settings/members/page.tsx`
- Layout & Header workspace switcher + user menu + sign out:
  - Unified native full-screen `AppShell` removing duplicate sub-page headers.
  - `dashboard/src/components/layout/header.tsx`
  - `ThemeToggle` correctly bounds between Light/Dark/System.
  - includes in-app workspace creation modal and auto-switch to new workspace.
  - clears client query cache on workspace switch/create to avoid stale cross-workspace table data.
- Logout API:
  - `dashboard/src/app/api/auth/logout/route.ts`

### 4. Workspace APIs

Implemented routes:

- `GET/POST /api/workspaces`
- `GET/POST /api/workspaces/current`
- `GET/POST /api/workspaces/current/mailbox`
- `GET /api/workspaces/current/mailbox/oauth/start`
- `GET /api/workspaces/current/mailbox/oauth/callback`
- `POST /api/workspaces/current/mailbox/disconnect`
- `GET/PATCH /api/workspaces/[workspaceId]/members`
- `GET/POST /api/workspaces/[workspaceId]/invites`
- `POST /api/workspaces/invites/accept`

All operational API routes are now workspace-scoped and role-gated through context helpers.

Mailbox hardening:

- manual mailbox writes cannot set `status='connected'`.
- connected state is established only through OAuth callback token exchange.

### 5. Modal selection payload hardening

`dashboard/src/lib/modal-client.ts` and `dashboard/src/app/api/rfqs/[rfqId]/select/route.ts` now include:

- `workspace_id`
- `selected_by_user_id`
- `selected_match` (exact quote identity key)

These are derived server-side to prevent client-side tenant spoofing.

### 6. Automations tenancy

Implemented workspace scoping helper:

- `automations/tenant_context.py`

Applied to phase flows:

- `automations/phase_1_request_analysis.py`
- `automations/phase_2_quote_analysis.py`
- `automations/phase_3_select_and_quote.py`
- `automations/scheduled_tasks.py`

Current behavior:

- Gmail Pub/Sub payload mailbox is used to resolve workspace context.
- DB reads/writes are workspace-scoped for tenant tables.
- Phase 1 request parser now sends structured `EMAIL_METADATA` + `email_received_at` + raw body to the LLM intake prompt.
- Phase 1 prompt hardening is in place for: controlled destination mapping, date anchoring, door/port service inference, origin-option splitting, and duplicate container mention aggregation.
- Phase 1 intake extraction now runs deterministically (`temperature=0`) with schema-gated parsing.
- Phase 2 quote parser now uses RFQ-grounded context + trimmed current-reply content before LLM extraction.
- Phase 2 applies conservative sanitization (explicit ocean freight only, ambiguous multi-shipment rejection, date normalization, quote dedupe).
- Quote logging now preserves same-carrier multi-option replies via hashed `match` keys.
- Watch renewal loops through active `workspace_mailboxes` rows.
- Unknown/disconnected mailbox events are ignored by default and logged to `audit_events`.
- Optional fallback can be enabled with `ALLOW_BOOTSTRAP_WORKSPACE_FALLBACK=true` during cutover.
- Phase 3 quote selection now supports exact lookup by `selected_match` with legacy fallback.

## Dual-Mode Cutover (Active)

The system currently runs in a phased dual-mode:

- Existing legacy data is backfilled into bootstrap workspace `00000000-0000-0000-0000-000000000001`.
- Missing workspace context in automation ingress no longer routes by default; strict ignore + audit is active.
- New dashboard paths and APIs are workspace-native.

## Known Hardening Follow-Ups

1. Expand audit event coverage for mailbox disconnect/error transitions and OAuth failures.
2. Keep `ALLOW_BOOTSTRAP_WORKSPACE_FALLBACK` disabled in production except controlled rollback windows.
3. Expand prompt-eval benchmark from synthetic fixtures to production paired RFQ/reply datasets and track drift over time.

## Verification Gate (latest run)

Executed from this workspace branch:

- `cd dashboard && npm run lint` ✅
- `cd dashboard && npm run typecheck` ✅
- `cd dashboard && npm run test` ✅
- `cd dashboard && npm run build` ✅ (webpack mode)
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile automations/*.py` ✅
- `python3 -m pytest automations/tests -q` ✅

## Production Validation (2026-02-23)

- Dashboard deployed and aliased to:
  - `https://evo-logistics.vercel.app`
- Latest production deployment from `main`:
  - commit `b5da915`
- Vercel environment is configured for mailbox OAuth across `production`/`preview`/`development`:
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `GOOGLE_OAUTH_CLIENT_SECRET`
  - `MAILBOX_TOKEN_ENCRYPTION_KEY`
  - `MAILBOX_OAUTH_STATE_SECRET`
- Modal apps deployed:
  - phase 1: `https://hafisjavad--rfq-analyzer-phase-1-gmail-push-phase1.modal.run`
  - phase 2: `https://hafisjavad--quote-analysis-phase-2-gmail-push-phase2.modal.run`
  - phase 3: `https://hafisjavad--select-and-quote-phase-3-select-agent.modal.run`
- scheduled app deployed: `https://modal.com/apps/hafisjavad/main/deployed/scheduled-tasks`
- mailbox OAuth enforcement migration applied:
  - `workspace_mailboxes_connected_requires_refresh_token` check blocks token-less `connected` updates
- manual renew operations currently skip because no workspace mailboxes are connected yet:
  - `python3 -m modal run automations/phase_1_request_analysis.py::renew_gmail_watch`
  - `python3 -m modal run automations/phase_2_quote_analysis.py::renew_gmail_watch`

## Source of Truth Files

- `dashboard/supabase/migrations/20260222_001_multitenant_workspaces.sql`
- `dashboard/supabase/migrations/20260222_010_fix_agents_workspace_scoping.sql`
- `dashboard/supabase/migrations/20260223_011_workspace_mailbox_oauth_enforcement.sql`
- `dashboard/supabase_schema.sql`
- `dashboard/src/lib/workspace-context.ts`
- `dashboard/src/lib/workspaces.ts`
- `dashboard/src/app/api/workspaces/current/mailbox/route.ts`
- `dashboard/src/app/api/workspaces/current/mailbox/oauth/start/route.ts`
- `dashboard/src/app/api/workspaces/current/mailbox/oauth/callback/route.ts`
- `dashboard/src/app/api/workspaces/current/mailbox/disconnect/route.ts`
- `dashboard/src/lib/mailbox-crypto.ts`
- `dashboard/src/lib/google-gmail-oauth.ts`
- `automations/gmail_workspace_auth.py`
- `dashboard/src/hooks/use-workspace-mailbox.ts`
- `automations/tenant_context.py`
