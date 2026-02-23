# Evo Logistics Dashboard

Updated: 2026-02-23

Workspace-centric Next.js control plane for RFQ operations, pricing, and automation handoff.

## What Is Implemented

- **Global Premium Glassmorphism UI**: Entire application utilizes a stunning Bento Grid architecture with deep backdrop blurs, floating interactive cards, staggered entrance choreographies, and `oklch`-based fluid themes.
- **Unified AppShell Layout**: Clean single-header layout powered by a root `AppShell`, purging old duplicate page-level headers.
- **Native Data Widgets**: Cleaned out static placeholder charts in favor of dynamic `CircularProgress` and `PipelineChart` widgets fed natively by React Query activity hooks.
- Supabase auth with dedicated `/login` and `/signup` experiences.
- Hash-token session fallback handling on login/signup for redirect edge cases.
- Post-auth workspace bootstrap (personal workspace + owner membership).
- Workspace switcher persisted with secure `workspace_id` cookie.
- In-app workspace creation from header user menu.
- Role-aware API guards for `owner`, `admin`, and `member`.
- Workspace-scoped RFQ/pricing/settings APIs.
- Quote selection uses exact quote `match` key (`selected_match`) to support same-carrier multi-option offers safely.
- Workspace-scoped agent uniqueness (`workspace_id + agent_name`, `workspace_id + email`) via migration `20260222_010_fix_agents_workspace_scoping.sql`.
- Workspace mailbox OAuth connect/reconnect/disconnect in workspace settings.
- Invite links that carry token through auth callback and auto-accept membership.
- Account settings (`/settings/account`) with profile update, session revoke, MFA flag toggle, and soft-delete request.
- Workspace member/invite management (`/settings/members`).
- Workspace settings (`/settings/workspace`).
- Workspace switch/create now clears client query cache before refresh to prevent stale cross-workspace rows in UI tables.

## Main Routes

- `/login`
- `/signup`
- `/onboarding`
- `/rfqs`
- `/agents`
- `/pricing`
- `/settings/workspace`
- `/settings/account`
- `/settings/members`

## Environment Setup

1. Copy `.env.example` to `.env.local`.
2. Fill required keys:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL`
   - `MODAL_WEBHOOK_SELECT_AGENT`
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `MAILBOX_TOKEN_ENCRYPTION_KEY`
3. Install dependencies and run dev server.

```bash
npm install
npm run dev
```

## Commands

From `dashboard/`:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Notes:
- Playwright and build use webpack mode in this branch to avoid Turbopack/worktree symlink crashes.

## Key Files

- `src/lib/workspace-context.ts` — active workspace/role resolution helpers.
- `src/lib/workspaces.ts` — user workspace bootstrap + defaults seeding.
- `src/lib/supabase/middleware.ts` — auth/onboarding gate behavior.
- `src/components/layout/header.tsx` — workspace switch/create flow + query cache reset on workspace change.
- `src/app/api/workspaces/**` — workspace/member/invite APIs.
- `src/app/api/workspaces/current/mailbox/route.ts` — mailbox read + metadata-safe updates (`connected` cannot be set manually).
- `src/app/api/workspaces/current/mailbox/oauth/start/route.ts` — starts Google OAuth for current workspace.
- `src/app/api/workspaces/current/mailbox/oauth/callback/route.ts` — exchanges OAuth code and persists encrypted tokens.
- `src/app/api/workspaces/current/mailbox/disconnect/route.ts` — disconnects and clears workspace mailbox tokens.
- `src/hooks/use-workspace-mailbox.ts` — mailbox query/mutation hooks.
- `src/lib/mailbox-crypto.ts` — shared token encryption/decryption contract.
- `src/lib/google-gmail-oauth.ts` — Google OAuth URL/token/profile helpers.
- `src/app/api/rfqs/[rfqId]/select/route.ts` — workspace-aware Modal handoff.
- `src/lib/validation.ts` — select-agent payload validation (`selected_match` required).

## Migration Notes

- Multi-tenant baseline: `../dashboard/supabase/migrations/20260222_001_multitenant_workspaces.sql`
- RFQ soft delete + index: `../dashboard/supabase/migrations/20260222_009_dashboard_crud_rfq_soft_delete.sql`
- Legacy agent global-constraint fix: `../dashboard/supabase/migrations/20260222_010_fix_agents_workspace_scoping.sql`
- Mailbox OAuth enforcement: `../dashboard/supabase/migrations/20260223_011_workspace_mailbox_oauth_enforcement.sql`

## Related Docs

- `../ACTION_PLAN.md`
- `../DASHBOARD.md`
- `../automations/AUTOMATIONS.md`
