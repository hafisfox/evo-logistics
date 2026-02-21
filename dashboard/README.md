# Evo Logistics — Pricing Dashboard

This is the Next.js 14 (App Router) frontend interface for the Evo Logistics FCL Pricing Engine. It allows pricing managers to monitor the automated RFQ pipeline, review China agent marine freight quotes, manage multi-tenant logistics processes, and execute final customer quotations to generate profit.

## Core Features

- **Supabase Native Authentication:** Secure `@supabase/ssr` session management leveraging Google OAuth and Email Magic Links.
- **Row Level Security (RLS):** True multi-tenant data siloing. Logisticians can only view, manage, and quote on RFQs and Agent interactions tied to their specific `user_id`.
- **Dynamic Aesthetic Theming:** Seamless `next-themes` integration featuring a dual CSS variable architecture. Supports both a pristine Light Corporate mode and a Cyberpunk Dark aesthetic.
- **Pipeline Visibility:** Real-time TanStack queries presenting live RFQ statuses (Processing, Quoted, Reminded, etc.) driven by backend Python serverless functions.
- **Automated Quotation Generation:** One-click rate lock-in and margin calculation (calculating DO, terminal fees, and transport) that dispatches email quotations directly to customers.

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS + shadcn/ui + next-themes
- **Data & Auth:** Supabase PostgreSQL + `@supabase/ssr` 
- **State Management:** TanStack Query v5 (Data Fetching) + Zustand (UI State)
- **Components:** TanStack Table v8, Recharts, Lucide Icons

## Getting Started Locally

First, ensure you have copied the `.env.example` to `.env.local` and filled in your Supabase variables.

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application. Standard log-in requires an active Supabase user session.

## System Architecture

This Next.js dashboard acts as the unified frontend reading from the Supabase database. All backend asynchronous email ingestion, parsing, and automated agent outreach are handled via standalone Python Modal.com instances (`/automations`). See the repository root `ACTION_PLAN.md` and `DASHBOARD.md` for high-level system workflows and database schema relationships.
