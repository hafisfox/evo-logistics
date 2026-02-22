# DASHBOARD.md — Evo Logistics Dashboard (Workspace Multi-Tenant)

Updated: 2026-02-22

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
- `/settings/workspace` (workspace-level pricing/settings + mailbox configuration)
- `/settings/account` (profile, session revoke, MFA flag, soft delete request)
- `/settings/members` (members + invites)

### Onboarding
- `/onboarding` with setup checklist for workspace/mailbox/config prep

## 4. Workspace UX Model

### Header workspace context
File: `dashboard/src/components/layout/header.tsx`

- Workspace switcher (`/api/workspaces/current`)
- Create workspace action (modal -> `/api/workspaces` -> auto-switch)
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

All routes now require workspace context and filter by `workspace_id`.

## 6. Role Enforcement

- `owner` and `admin`:
  - workspace settings mutation
  - member/invite management
  - pricing table/settings writes
- `member`:
  - RFQ operational reads/actions
  - no workspace/member admin APIs

Primary helpers:
- `requireWorkspaceApiContext(...)`
- `requireWorkspaceMembership(...)`
- `canManageWorkspace(...)`

## 7. Data Model (dashboard-facing)

Tenant-scoped operational tables:
- `master_rfqs`
- `agent_outbound_log`
- `agents`
- `do_charges`
- `destination_charges`
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

## 8. Modal Integration

Selection route: `POST /api/rfqs/[rfqId]/select`

Payload now includes server-derived tenancy keys:

```json
{
  "rfq_id": "RFQ-...",
  "workspace_id": "uuid",
  "selected_by_user_id": "uuid",
  "selected_agent": "...",
  "selected_carrier": "...",
  "shipment_number": "1",
  "selected_by": "...",
  "margin": 0.13,
  "quote_threshold": 2
}
```

## 9. Environment Variables

See `dashboard/.env.example` for full local template.

Required for dashboard runtime:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `MODAL_WEBHOOK_SELECT_AGENT`

Optional hardening:
- `MODAL_WEBHOOK_SECRET`
- `MODAL_WEBHOOK_TIMEOUT_MS`

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
