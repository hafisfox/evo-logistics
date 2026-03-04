# ACTION_PLAN.md — Workspace-Centric Logistics SaaS

Updated: 2026-02-23

## Objective
Ship a workspace-based logistics dashboard + automation system where each authenticated user only sees and mutates data for workspaces they belong to, while still supporting team collaboration with roles.

## Final Product Model

- Tenancy: hybrid personal + team workspaces.
- Signup: open signup with email magic link and Google OAuth.
- Team join: invite-only (owner/admin can invite as `admin` or `member`; members can invite as `member` only).
- Roles:
  - `owner`: full workspace control.
  - `admin`: workspace config + member/invite management.
  - `member`: RFQ operations + create member-role invites only.
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
- **Database Optimization Pass (Complete):**
  - RLS Policies optimized to use cached `(SELECT auth.jwt())` wrappers to eliminate `auth_rls_initplan` warnings.
  - Resolved `multiple_permissive_policies` overlaps by splitting `FOR ALL` roles into explicit `INSERT`/`UPDATE`/`DELETE` grants.
  - Added B-Tree indexes on 8 foreign key columns to eliminate sequential scans on `ON DELETE CASCADE` actions.
  - Enforced correct scalar values: `sent_at`/`received_at`/`quoted_at` are stored as `TEXT` to mirror exact UAE-time application strings without timezone coercion. `transit_time`/`free_time` stored as `INTEGER`.
  - Added `Reminded` to the `quote_status` enum.

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

Invite model hardening (2026-02-23):

- `POST /api/workspaces/[workspaceId]/invites` allows `owner`/`admin`/`member`.
- `member` callers are restricted to `role='member'` invites only.
- invite acceptance status updates are now fail-fast (no silent ignore on invite-row update failure).
- RLS split `workspace_invites` permissions by operation (member create-only, owner/admin manage, invitee self-accept update).

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
- `scheduled_tasks.py` handles strict cross-tenant data isolation by looping explicitly and uses idempotent exact updates matching `rfq_id` + `agent_email`.
- `phase_2_quote_analysis.py` triggers exact-match manager notifications without repeating identical thresholds.

### 7. RFQ + Pricing Normalization (Production)

Implemented and deployed:

- Migration: `dashboard/supabase/migrations/20260223_012_rfq_and_pricing_normalization.sql`
- Normalized RFQ tables:
  - `rfq_shipments`
  - `rfq_shipment_containers`
  - `agent_quotes`
- Normalized pricing tables:
  - `do_charge_profiles`
  - `do_charge_rates`
  - `destination_charge_items`
  - `destination_charge_rates`
- Compatibility views:
  - `v_master_rfq_legacy_projection`
  - `v_do_charges_legacy`
  - `v_destination_charges_legacy`
- Historical backfill script:
  - `dashboard/scripts/backfill_rfq_normalized.ts`
- Dashboard APIs and UI are normalization-aware while preserving existing route contracts.

### 8. Dashboard Speed Insights Optimization (Main branch)

Implemented in commit `89eca19` (currently on `main`):

- Added compact summary endpoint:
  - `GET /api/dashboard/summary`
  - route: `dashboard/src/app/api/dashboard/summary/route.ts`
- Added shared summary aggregation/caching:
  - `dashboard/src/lib/dashboard-summary.ts`
  - workspace-keyed 20s cache TTL
- Homepage `/` data path refactor:
  - replaced duplicated initial `/api/analytics` + `/api/rfqs` dependence with `useDashboardSummary`
  - deferred recent RFQ table loading for better above-the-fold paint
- Added targeted DB indexes for received-quote aggregation:
  - `dashboard/supabase/migrations/20260223_016_dashboard_summary_perf_indexes.sql`
- Added regression coverage:
  - `dashboard/src/app/api/__tests__/dashboard-summary.route.test.ts`
  - `dashboard/src/hooks/use-dashboard-summary.test.tsx`
  - `dashboard/src/app/page.test.tsx`

### 9. Ocean Freight Hardening (2026-03-04)

Migration: `dashboard/supabase/migrations/20260304_017_ocean_freight_fields.sql`

**Schema additions:**
- `rfq_shipments` — 11 new columns: `commodity_description`, `hs_code`, `incoterms`, `is_dangerous_goods`, `dg_class`, `is_reefer`, `reefer_temperature`, `special_requirements`, `cargo_weight_kg`, `cargo_volume_cbm`, `freight_mode`
- `agent_quotes` — 5 new columns: `surcharges` (JSONB), `free_time_details` (JSONB), `validity_date`, `conditions`, `freight_mode`
- `agent_outbound_log` — `reminder_count` column for multi-step escalation
- New tables: `exchange_rates`, `activity_logs`, `rfq_notes` (all RLS-enabled, workspace-scoped)
- New indexes: `idx_agent_quotes_rfq_id`, `idx_rfq_shipments_rfq_id`, `idx_agent_quotes_status`, `idx_agent_quotes_validity_date`, `idx_master_rfqs_quoted_at`
- Updated view: `v_master_rfq_legacy_projection` with aggregated ocean freight fields

**Automation changes:**
- Phase 1: extracts commodity, HS code, incoterms, DG/reefer flags, weight/volume from customer emails; writes to new DB columns; includes in agent outreach emails
- Phase 2: extracts surcharges (BAF, CAF, THC, PSS, GRI, ISPS, ORC, war_risk, congestion) as JSONB; structured free_time_details (demurrage/detention/combined); validity_date; conditions
- Phase 3: dynamic exchange rate from `exchange_rates` table (fallback 3.685); surcharge-aware pricing; enhanced quotation email with surcharge/free_time breakdown; enhanced sales notification with margin %
- Scheduled tasks: multi-step escalation (reminder_count 0→3hrs, 1→6hrs, 2→12hrs, 3→auto-close); quote expiry check (marks expired by validity_date); stale RFQ detection (no quotes after 48hrs → activity_logs)

**Dashboard changes:**
- Types: `QuoteSurcharges`, `FreeTimeDetails`, `SurchargeBreakdown`, `RFQNote`, `ActivityLog`, `ExchangeRate`, `FreightMode`, `Incoterms` added; `RFQShipment` and `AgentQuote` extended
- Pricing engine: surcharge-aware calculations, dynamic exchange rate, margin % in results
- RFQ detail page: cargo details section (commodity, HS code, incoterms, DG, reefer, weight, volume); notes section with add/view; activity log timeline
- Quote table: surcharges column with tooltip breakdown; structured free time display; validity_date
- Quote selection cards: surcharge breakdown panel; conditions display; free time details
- New API routes: `GET/POST /api/rfqs/[rfqId]/notes`, `GET /api/rfqs/[rfqId]/activity`, `GET/POST /api/settings/exchange-rates`, `POST /api/rfqs` (manual RFQ creation)
- New pages: `/rfqs/new` — manual RFQ creation form with all ocean freight fields
- Pipeline page: "Create RFQ" button added
- Status badge: added `Cancelled`, `On_Hold`, `Expired` statuses

### 10. Dashboard Polish (2026-03-04)

**RFQ table enhancements:**
- Column sorting: click-to-sort on RFQ ID, Customer, Status, Ready Date, Price (AED) — toggles asc/desc with arrow indicators
- Pagination: 25 items per page, numbered page buttons with previous/next navigation, "Showing X–Y of Z" counter
- CSV export: "Export CSV" button exports all filtered RFQs with 13 columns (ID, customer, route, containers, service, status, dates, prices, agent)

**Exchange rate management UI:**
- New `ExchangeRateCard` component on Workspace Settings page (`/settings/workspace`)
- Shows current active rate (or fallback 3.685), effective date
- Form to submit new rate (owner/admin only)
- History of last 5 rate entries with effective dates
- Hook: `dashboard/src/hooks/use-exchange-rates.ts` (`useExchangeRates`, `useCreateExchangeRate`)

**Home page KPI enhancements:**
- New conversion funnel card: horizontal bar chart showing Total RFQs → Quoted → Selected with win rate %
- New revenue card: total AED/USD from selected quotes, plus completed count, quoted today, avg response time
- Extended `DashboardKPIs` type with: `totalRFQs`, `selectedCount`, `quotedCount`, `conversionRate`, `totalRevenueAED`, `totalRevenueUSD`
- Revenue computed from `final_price_aed`/`final_price_usd` of "Selected" status RFQs in `buildDashboardSummary()`

## Cutover Mode (Current)

The system now runs with normalized reads active and dual-write retained:

- `RFQ_NORMALIZED_DUAL_WRITE=true`
- `RFQ_NORMALIZED_READ_SOURCE=normalized`
- Historical backfill completed.
- Post-backfill and post-deploy quote parity checks are clean (`agent_outbound_log` vs `agent_quotes`: zero unmatched rows).

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
  - commit `0dac2f9`
- Vercel environment is configured for mailbox OAuth across `production`/`preview`/`development`:
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `GOOGLE_OAUTH_CLIENT_SECRET`
  - `GOOGLE_PUBSUB_TOPIC`
  - `MAILBOX_TOKEN_ENCRYPTION_KEY`
  - `MAILBOX_OAUTH_STATE_SECRET`
- dashboard OAuth callback now initializes Gmail watch immediately on mailbox connect/reconnect and persists `watch_expiration`.
- Modal apps deployed:
  - phase 1: `https://hafisjavad--rfq-analyzer-phase-1-gmail-push-phase1.modal.run`
  - phase 2: `https://hafisjavad--quote-analysis-phase-2-gmail-push-phase2.modal.run`
  - phase 3: `https://hafisjavad--select-and-quote-phase-3-select-agent.modal.run`
- scheduled app deployed: `https://modal.com/apps/hafisjavad/main/deployed/scheduled-tasks`
- mailbox OAuth enforcement migration applied:
  - `workspace_mailboxes_connected_requires_refresh_token` check blocks token-less `connected` updates
- RFQ/pricing normalization migration applied:
  - `dashboard/supabase/migrations/20260223_012_rfq_and_pricing_normalization.sql`
- Supabase advisors fixes migration applied:
  - `dashboard/supabase/migrations/20260223_013_supabase_advisors_fixes.sql`
  - `dashboard/supabase/migrations/20260223_014_workspace_members_rls_optimization.sql`
  - `dashboard/supabase/migrations/20260223_015_workspace_invites_member_create_and_accept_hardening.sql`
- backfill completed:
  - `rfqsRead=2`
  - `shipmentsUpserted=7`
  - `containersUpserted=7`
  - `quotesRead=2`
  - `quotesUpserted=2`
  - `doProfilesUpserted=3`
  - `doRatesUpserted=9`
  - `destinationItemsUpserted=2`
  - `destinationRatesUpserted=4`
- Modal secret `evo-logistics-env` updated with:
  - `RFQ_NORMALIZED_DUAL_WRITE=true`
  - `RFQ_NORMALIZED_READ_SOURCE=normalized`
- Modal apps redeployed (phase 1/2/3 + scheduled tasks).
- **Hotfix deployed (2026-02-23):** Fixed DATE/NUMERIC column handling in both phases:
  - Phase 1: added `carrier='Pending'` default for outreach rows (was NULL → NOT NULL violation).
  - Phase 2: replaced `'N/A'` string fallbacks with `None` for `etd`, `validity` (DATE cols) and `price` (NUMERIC col) in all code paths.
  - Phase 2: fixed `_normalize_iso_date` regex (`\\d` → `\d`) so `agent_quotes` dual-write preserves valid ISO dates.
- Gmail watches currently active for connected mailboxes:
  - `hafisjavad@gmail.com`
  - `yunapink05@gmail.com`
- webhook endpoint smoke probes (`GET`) return `405` as expected for POST-only handlers.

## Source of Truth Files

- `dashboard/supabase/migrations/20260222_001_multitenant_workspaces.sql`
- `dashboard/supabase/migrations/20260222_010_fix_agents_workspace_scoping.sql`
- `dashboard/supabase/migrations/20260223_011_workspace_mailbox_oauth_enforcement.sql`
- `dashboard/supabase/migrations/20260223_012_rfq_and_pricing_normalization.sql`
- `dashboard/supabase/migrations/20260223_013_supabase_advisors_fixes.sql`
- `dashboard/supabase/migrations/20260223_014_workspace_members_rls_optimization.sql`
- `dashboard/supabase/migrations/20260223_015_workspace_invites_member_create_and_accept_hardening.sql`
- `dashboard/supabase/migrations/20260223_016_dashboard_summary_perf_indexes.sql`
- `dashboard/supabase/migrations/20260304_017_ocean_freight_fields.sql`
- `dashboard/supabase_schema.sql`
- `dashboard/scripts/backfill_rfq_normalized.ts`
- `dashboard/src/lib/rfq-normalization.ts`
- `dashboard/src/lib/workspace-context.ts`
- `dashboard/src/lib/workspaces.ts`
- `dashboard/src/app/api/workspaces/current/mailbox/route.ts`
- `dashboard/src/app/api/workspaces/current/mailbox/oauth/start/route.ts`
- `dashboard/src/app/api/workspaces/current/mailbox/oauth/callback/route.ts`
- `dashboard/src/app/api/workspaces/current/mailbox/disconnect/route.ts`
- `dashboard/src/app/api/dashboard/summary/route.ts`
- `dashboard/src/lib/mailbox-crypto.ts`
- `dashboard/src/lib/google-gmail-oauth.ts`
- `dashboard/src/lib/dashboard-summary.ts`
- `automations/gmail_workspace_auth.py`
- `dashboard/src/hooks/use-workspace-mailbox.ts`
- `dashboard/src/hooks/use-dashboard-summary.ts`
- `dashboard/src/hooks/use-exchange-rates.ts`
- `dashboard/src/components/rfqs/rfq-table.tsx`
- `dashboard/src/types/analytics.ts`
- `automations/tenant_context.py`
