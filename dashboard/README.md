# Evo Logistics Dashboard

Updated: 2026-02-22

Workspace-centric Next.js control plane for RFQ operations, pricing, and automation handoff.

## What Is Implemented

- Supabase auth with dedicated `/login` and `/signup` experiences.
- Post-auth workspace bootstrap (personal workspace + owner membership).
- Workspace switcher persisted with secure `workspace_id` cookie.
- Role-aware API guards for `owner`, `admin`, and `member`.
- Workspace-scoped RFQ/pricing/settings APIs.
- Invite links that carry token through auth callback and auto-accept membership.
- Account settings (`/settings/account`) with profile update, session revoke, MFA flag toggle, and soft-delete request.
- Workspace member/invite management (`/settings/members`).
- Workspace settings (`/settings/workspace`).

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
2. Fill required keys.
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
- `src/app/api/workspaces/**` — workspace/member/invite APIs.
- `src/app/api/rfqs/[rfqId]/select/route.ts` — workspace-aware Modal handoff.

## Related Docs

- `../ACTION_PLAN.md`
- `../DASHBOARD.md`
- `../automations/AUTOMATIONS.md`
