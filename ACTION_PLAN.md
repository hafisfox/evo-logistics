# ACTION_PLAN.md — Workspace-Centric Logistics SaaS

Updated: 2026-02-22

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
- Legacy public-read policies removed.
- Force RLS enabled and role-aware policy checks implemented via `public.has_workspace_role(...)`.

### 2. Dashboard auth + workspace context

- Auth pages:
  - `dashboard/src/app/login/page.tsx`
  - `dashboard/src/app/signup/page.tsx`
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
- Members/invites UI:
  - `dashboard/src/app/settings/members/page.tsx`
- Header workspace switcher + user menu + sign out:
  - `dashboard/src/components/layout/header.tsx`
- Logout API:
  - `dashboard/src/app/api/auth/logout/route.ts`

### 4. Workspace APIs

Implemented routes:

- `GET/POST /api/workspaces`
- `GET/POST /api/workspaces/current`
- `GET/PATCH /api/workspaces/[workspaceId]/members`
- `GET/POST /api/workspaces/[workspaceId]/invites`
- `POST /api/workspaces/invites/accept`

All operational API routes are now workspace-scoped and role-gated through context helpers.

### 5. Modal selection payload hardening

`dashboard/src/lib/modal-client.ts` and `dashboard/src/app/api/rfqs/[rfqId]/select/route.ts` now include:

- `workspace_id`
- `selected_by_user_id`

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
- Watch renewal loops through active `workspace_mailboxes` rows.
- Unknown/disconnected mailbox events are ignored by default and logged to `audit_events`.
- Optional fallback can be enabled with `ALLOW_BOOTSTRAP_WORKSPACE_FALLBACK=true` during cutover.

## Dual-Mode Cutover (Active)

The system currently runs in a phased dual-mode:

- Existing legacy data is backfilled into bootstrap workspace `00000000-0000-0000-0000-000000000001`.
- Missing workspace context in automation ingress no longer routes by default; strict ignore + audit is active.
- New dashboard paths and APIs are workspace-native.

## Known Hardening Follow-Ups

1. Per-workspace Gmail OAuth credential lifecycle is not fully closed-loop in dashboard UX yet.
2. Audit events are schema-ready but not yet emitted comprehensively in all mutation paths.
3. Keep `ALLOW_BOOTSTRAP_WORKSPACE_FALLBACK` disabled in production except controlled emergency rollback windows.
4. Add comprehensive automation pytest suite under `automations/tests` for cross-workspace regression coverage.

## Verification Gate (latest run)

Executed from this workspace branch:

- `cd dashboard && npm run lint` ✅
- `cd dashboard && npm run typecheck` ✅
- `cd dashboard && npm run test` ✅
- `cd dashboard && npm run test:e2e` ✅
- `cd dashboard && npm run build` ✅ (webpack mode)
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m py_compile automations/*.py` ✅
- `pytest automations/tests -q` ⚠️ `pytest` not installed in current environment

## Source of Truth Files

- `dashboard/supabase/migrations/20260222_001_multitenant_workspaces.sql`
- `dashboard/supabase_schema.sql`
- `dashboard/src/lib/workspace-context.ts`
- `dashboard/src/lib/workspaces.ts`
- `automations/tenant_context.py`
