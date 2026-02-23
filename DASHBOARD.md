# DASHBOARD.md — Evo Logistics Dashboard (Workspace Multi-Tenant)

Updated: 2026-02-23

## 1. Architecture

```text
Browser -> Next.js App Router/API -> Supabase (RLS)
                            -> Modal select endpoint (Phase 3)
```

- Framework: Next.js 16 + React 19
- Auth/session: Supabase Auth + `@supabase/ssr`
- Access control: workspace membership + role checks in server APIs
- Multi-tenancy boundary: `workspace_id` on operational tables + enforced RLS

## 2. Auth and Onboarding

### Public auth routes
- `/login` (sign-in focused)
- `/signup` (new account creation)
- `/auth/callback` and `/auth/confirm` handle auth returns
- login/signup include hash-token session fallback handling for provider redirect edge cases

### Post-auth bootstrap
After first successful auth, backend ensures:
- `user_profiles` row exists
- personal workspace is created if user has none
- owner membership is created
- `workspace_id` cookie is set
- if `invite` token is present, invite acceptance is attempted during callback/confirm

Implementation: `dashboard/src/lib/workspaces.ts`

### Middleware behavior
File: `dashboard/src/lib/supabase/middleware.ts`

- Unauthenticated page requests -> redirect `/login`
- Unauthenticated API requests -> `401` JSON
- Authenticated users with no active workspace memberships -> redirect `/onboarding`
- Authenticated users on `/login` or `/signup` -> redirect to callback/default app page

### Dashboard performance path (Speed Insights hardening)
- Homepage now reads a compact server endpoint: `GET /api/dashboard/summary`.
- Summary aggregation is centralized in `dashboard/src/lib/dashboard-summary.ts`.
- Summary responses are cached per workspace for 20 seconds to reduce repeated expensive reads.
- Recent RFQ table on `/` is deferred so KPI/action content paints first.
- Above-the-fold blur/animation intensity was reduced on `/`, `/onboarding`, and `/settings/workspace`.

## 3. Pages

### Core operations
- `/`
- `/rfqs`
- `/rfqs/[rfqId]`
- `/rfqs/[rfqId]/select`
- `/agents`
- `/pricing`

### Settings and account
- `/settings` -> redirects to `/settings/workspace`
- `/settings/workspace` (workspace-level pricing/settings + mailbox OAuth connection)
- `/settings/account` (profile, session revoke, MFA flag, soft delete request)
- `/settings/members` (members + invites)

### Onboarding
- `/onboarding` with setup checklist for workspace/mailbox OAuth/config prep

## 4. Workspace UX Model

### AppShell & Layout Framework
- All authenticated routes are wrapped in a unified `AppShell`.
- `AppShell` natively controls the full viewport (`h-screen w-full`) without internal constrained padding, enabling fluid glass backgrounds.
- State-aware dynamic `Sidebar` respects dark/light theme natively.
- Global `<Header>` component rendered exactly once at the top layout level; no sub-page imports to avoid double-rendering headers.

### Header workspace context
File: `dashboard/src/components/layout/header.tsx`

- Workspace switcher (`/api/workspaces/current`)
- Create workspace action (modal -> `/api/workspaces` -> auto-switch)
- Clears React Query cache before refresh on workspace switch/create to avoid stale data from previous workspace context.
- Account/workspace/members shortcuts
- Sign out action via `/api/auth/logout`

### Workspace selection persistence
- Selected workspace is stored in secure HTTP-only `workspace_id` cookie.
- APIs resolve active context from membership + cookie + user default workspace.

Context resolver: `dashboard/src/lib/workspace-context.ts`

## 5. API Surface

### Auth
- `POST /api/auth/logout`

### Workspace APIs
- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/workspaces/current`
- `POST /api/workspaces/current`
- `GET /api/workspaces/current/mailbox`
- `POST /api/workspaces/current/mailbox`
- `GET /api/workspaces/current/mailbox/oauth/start`
- `GET /api/workspaces/current/mailbox/oauth/callback`
- `POST /api/workspaces/current/mailbox/disconnect`
- `GET /api/workspaces/[workspaceId]/members`
- `PATCH /api/workspaces/[workspaceId]/members`
- `GET /api/workspaces/[workspaceId]/invites`
- `POST /api/workspaces/[workspaceId]/invites`
- `POST /api/workspaces/invites/accept`

### Operational APIs (workspace-scoped)
- `/api/rfqs`
- `/api/rfqs/[rfqId]`
- `/api/rfqs/[rfqId]/quotes`
- `/api/rfqs/[rfqId]/select`
- `/api/agents`
- `/api/pricing/*`
- `/api/settings`
- `/api/analytics`
- `/api/dashboard/summary`

All routes now require workspace context and filter by `workspace_id`.

Mailbox endpoint behavior:

- `POST /api/workspaces/current/mailbox` cannot set `status="connected"` manually.
- connected state is established only by OAuth callback token exchange.
- OAuth callback initializes Gmail INBOX watch immediately and persists `watch_expiration` on `workspace_mailboxes`.
- OAuth callback resolves cross-workspace mailbox collisions by transferring ownership when the caller is `owner/admin` on both workspaces, otherwise returning a friendly conflict error.

Invite endpoint behavior:

- `POST /api/workspaces/[workspaceId]/invites` allows `owner`, `admin`, and `member`.
- `member` callers can only create `role="member"` invites.
- invite acceptance path now fails fast if invite-row status update fails after membership upsert.

## 6. Role Enforcement

- `owner` and `admin`:
  - workspace settings mutation
  - member/invite management
  - pricing table/settings writes
- `member`:
  - RFQ operational reads/actions
  - can create invites with `member` role only
  - cannot invite admins
  - cannot update roles or manage workspace settings

Primary helpers:
- `requireWorkspaceApiContext(...)`
- `requireWorkspaceMembership(...)`
- `canManageWorkspace(...)`

## 7. Data Model (dashboard-facing)

Tenant-scoped operational tables:
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

Workspace/meta tables:
- `workspaces`
- `workspace_members`
- `workspace_invites`
- `workspace_mailboxes`
- `audit_events`
- `user_profiles`

Migration: `dashboard/supabase/migrations/20260222_001_multitenant_workspaces.sql`

Legacy-constraint hardening:
- `dashboard/supabase/migrations/20260222_010_fix_agents_workspace_scoping.sql`
- `dashboard/supabase/migrations/20260223_011_workspace_mailbox_oauth_enforcement.sql`
- `dashboard/supabase/migrations/20260223_012_rfq_and_pricing_normalization.sql`
- `dashboard/supabase/migrations/20260223_013_supabase_advisors_fixes.sql`
- `dashboard/supabase/migrations/20260223_015_workspace_invites_member_create_and_accept_hardening.sql`
- `dashboard/supabase/migrations/20260223_016_dashboard_summary_perf_indexes.sql`
- Drops old global agent constraints and enforces:
  - `primary key (workspace_id, agent_name)`
  - `unique (workspace_id, email)`
This prevents "Agent already exists" conflicts across different workspaces.

Compatibility views for stable API contracts:
- `v_master_rfq_legacy_projection`
- `v_do_charges_legacy`
- `v_destination_charges_legacy`

Cutover status:
- normalized read source is live in automations (`RFQ_NORMALIZED_READ_SOURCE=normalized`)
- dual-write remains enabled (`RFQ_NORMALIZED_DUAL_WRITE=true`) for rollback safety
- historical backfill completed with quote parity (`agent_outbound_log` vs `agent_quotes`) at zero unmatched rows

Postgres Performance Tuning (via Supabase Best Practices):
- **RLS Query Plan Fixing**: `auth.uid()` and `auth.jwt()` logic wrapped in `(SELECT ...)` caching subqueries.
- **Multiple Permissive Policies**: Dropped all `FOR ALL` roles and split them into mapped `FOR INSERT`/`FOR UPDATE`/`FOR DELETE` grants to prevent overlaps with `FOR SELECT` roles during table reads.
- **Unindexed Foreign Keys**: Indexed 8 missing composite and workspace foreign keys to avoid sequence scanning.
- **Scalar Adjustments**: Upgraded automation-layer scalars for `sent_at`/`received_at`/`quoted_at` to use `TEXT` (safely storing UAE string outputs) and bound `transit_time`/`free_time` as explicit `INTEGER` types to avoid frontend casting mismatches. Added `Reminded` to the `quote_status` enum.

## 8. Modal Integration

Selection route: `POST /api/rfqs/[rfqId]/select`

Payload now includes server-derived tenancy keys:

```json
{
  "rfq_id": "RFQ-...",
  "workspace_id": "uuid",
  "selected_by_user_id": "uuid",
  "selected_agent": "...",
  "selected_match": "RFQ-..._agent@email_1_CARRIER_ab12cd34",
  "selected_carrier": "...",
  "shipment_number": "1",
  "selected_by": "...",
  "margin": 0.13,
  "quote_threshold": 2
}
```

Selection behavior:
- UI and API now select by exact quote `match` key to avoid ambiguity when one agent sends multiple options for the same carrier/shipment.
- Legacy `selected_carrier` + `shipment_number` fields are still forwarded for backward-compatible fallback in Phase 3.

## 9. Environment Variables

See `dashboard/.env.example` for full local template.

Required for dashboard runtime:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `MODAL_WEBHOOK_SELECT_AGENT`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_PUBSUB_TOPIC`
- `MAILBOX_TOKEN_ENCRYPTION_KEY`

Optional hardening:
- `MODAL_WEBHOOK_SECRET`
- `MODAL_WEBHOOK_TIMEOUT_MS`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `MAILBOX_OAUTH_STATE_SECRET`

## 10. Quality Gates

From `dashboard/`:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Notes:
- E2E and build are configured to run in webpack mode in this workspace to avoid Turbopack + worktree symlink failures.
