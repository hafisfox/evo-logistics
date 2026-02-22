# Evo Logistics — Pricing Dashboard

This is the Next.js App Router frontend for the Evo Logistics FCL Pricing Engine. It allows pricing managers to monitor RFQ pipeline state, review agent quotes, and execute final selection flows with consistent pricing logic.

## Core Features

- **Supabase Authentication and Session Guarding:** `@supabase/ssr` with route protection.
- **RLS-Aligned Data Access:** Dashboard APIs read/write against Supabase tables under controlled auth flow.
- **Pipeline Visibility:** Real-time RFQ status views with filters, table/kanban modes, and detail drill-down.
- **Pricing and Selection:** Agent selection, pricing calculations, and webhook handoff to automations.
- **Theme Support:** `next-themes` with CSS-variable-based light/dark themes.

## Tech Stack

- **Framework:** Next.js 16+ (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **Data:** Supabase PostgreSQL + `@supabase/ssr`
- **State:** TanStack Query v5 + Zustand (UI state)
- **Testing:** Vitest + Testing Library + Playwright

## Getting Started Locally

1. Copy `.env.example` to `.env.local` and set required values.
2. Install dependencies and start dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality Commands

Run all quality checks from `dashboard/`:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

## Auth and Proxy Behavior

- Request guarding is handled in `src/proxy.ts`.
- Unauthenticated **page** requests redirect to `/login`.
- Unauthenticated **API** requests return JSON `401`:

```json
{ "error": "Unauthorized" }
```

## API Error Contract

Validated mutable routes return `400` for invalid payloads in this shape:

```json
{
  "error": "Invalid ... payload",
  "details": ["field-specific reason"]
}
```

Server failures return `500` with:

```json
{ "error": "..." }
```

## CI

GitHub Actions workflow: `.github/workflows/dashboard-quality.yml`

It runs lint, typecheck, unit/integration tests, Playwright smoke tests, and build for dashboard changes.

## System Architecture

This dashboard is the frontend control plane for the pricing workflow. Backend async ingestion and outbound quote automation are managed in `/automations`. See root docs (`ACTION_PLAN.md`, `DASHBOARD.md`) for full flow and schema context.
