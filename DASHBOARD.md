# DASHBOARD.md — Evo Logistics Pricing Dashboard

> Frontend dashboard for the FCL Pricing Engine. Replaces email-based manager interaction with a proper UI and adds full pipeline visibility.

---

## 1. Architecture

```text
Browser  ──GET──>  Next.js API Routes  ──>  Supabase PostgreSQL (read, realtime)
Browser  ──POST──> Next.js API Routes  ──>  Modal.com Webhooks (write/actions) / Supabase (write)
```

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router, TypeScript) |
| Styling | Tailwind CSS + shadcn/ui + next-themes (Light/Dark mode) |
| Data Fetching | TanStack Query v5 (polling + caching) |
| Tables | TanStack Table v8 |
| Charts | Recharts |
| Auth | Supabase Auth (`@supabase/ssr`) with Multi-Tenant RLS |
| State | Zustand (UI state only) |
| Deployment | Vercel |

---

## 2. Pages

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — KPIs, pipeline chart, pending actions, activity feed |
| `/rfqs` | RFQ Pipeline — table + kanban, filters, search |
| `/rfqs/[rfqId]` | RFQ Detail — shipment info, quotes, pricing breakdown, timeline |
| `/rfqs/[rfqId]/select` | Agent Selection — quote comparison, select & confirm |
| `/agents` | Agent Directory — performance metrics, response rates |
| `/pricing` | Pricing Tables — DO, destination, transport charges |
| `/settings` | Config — margin %, quote threshold |

---

## 3. API Routes

| Route | Method | Source | Cache |
|-------|--------|--------|-------|
| `/api/rfqs` | GET | `master_rfqs` | None |
| `/api/rfqs/[rfqId]` | GET | `master_rfqs` + `agent_outbound_log` | None |
| `/api/rfqs/[rfqId]/quotes` | GET | `agent_outbound_log` | None |
| `/api/rfqs/[rfqId]/select` | POST | → Modal webhook | None |
| `/api/agents` | GET | `agents` | None |
| `/api/pricing/do-charges` | GET | `do_charges` | None |
| `/api/pricing/dest-charges` | GET | `destination_charges` | None |
| `/api/pricing/transport` | GET | `transportation_charges` | None |
| `/api/pricing/calculate` | POST | All 3 pricing tables | None |
| `/api/analytics` | GET | `master_rfqs` + `agent_outbound_log` | None |

---

## 4. Data Models

### master_rfqs

| Column | Type | Description |
|--------|------|-------------|
| rfq_id | string | `RFQ-YYYYMMDD-XXX` |
| user_id | uuid | References `auth.users(id)` for Row Level Security |
| thread_id | string | Gmail thread ID |
| customer_email | string | |
| status | enum | Processing, Missing_Port_Data, Missing_Door_Data, Parse_Error, Selected, Quoted, Reminded, Followed_Up, Customer_Replied |
| pol | string | Port of Loading (newline-separated, repeated per container entry) |
| pod | string | Port of Discharge (newline-separated, same format as pol) |
| container_type | string | Newline-separated container types, e.g. `"40FT\n20FT"` |
| qty | string | Newline-separated quantities, index-aligned with container_type, e.g. `"2\n1"` |
| ready_date | string | YYYY-MM-DD |
| delivery_deadline | string? | Required delivery date YYYY-MM-DD |
| service_type | string | port-to-port, door-to-port, port-to-door, door-to-door |
| pickup_address | string? | For door-to-* services |
| delivery_address | string? | For *-to-door services |
| received_at | string | YYYY-MM-DD hh:mm a |
| selected_agent | string? | Agent name after manager selection |
| final_price_usd | string? | After pricing calculation |
| final_price_aed | string? | After pricing calculation |
| quoted_at | string? | Timestamp |

### agent_outbound_log

| Column | Type | Description |
|--------|------|-------------|
| rfq_id | string | Links to master_rfqs |
| user_id | uuid | References `auth.users(id)` for Row Level Security |
| match | string | `rfq_id_agentEmail_shipmentNumber` (upsert key — one row per agent per container entry) |
| agent_name | string | |
| agent_email | string | |
| shipment_number | string | For multi-shipment RFQs |
| carrier | string | COSCO, MAERSK, MSC, etc. |
| price | string | USD ocean freight |
| currency | string | USD |
| etd | string | YYYY-MM-DD |
| transit_time | string | Days |
| free_time | string | Days at destination |
| validity | string | Quote expiry date |
| status | enum | Requested, Received, Invalid_Quote |
| sent_at | string | |
| received_at | string | |

### Status Lifecycle

```text
master_rfqs:
  Processing → Missing_Port_Data / Missing_Door_Data / Parse_Error
  Processing → Selected → Quoted

agent_outbound_log:
  Requested → Received / Invalid_Quote
```

---

## 5. Pricing Engine

### Constants
- **USD_TO_AED:** 3.685 (hardcoded in code — requires redeploy to change)
- **MARGIN:** 13% default (dynamic — configurable via `/settings` page, passed to Modal at selection time)
- **QUOTE_THRESHOLD:** 2 default (dynamic — configurable via `/settings` page)
- **Rounding:** `Math.ceil(total / 10) * 10` (nearest 10 AED up)

### Port-to-Port

```
Ocean Freight (AED) = price_usd × 3.685
With Margin         = Ocean Freight × 1.13
Final Price (AED)   = ceil(With Margin / 10) × 10
```

### Door Service (adds to port-to-port)

```
DO Charges       = document_fee + (per_container_fee × qty)
Dest Charges     = Σ(charge: fixed → amount, per-container → amount × qty)
Transport        = transport_per_container × qty
Subtotal (AED)   = Ocean Freight + DO + Dest + Transport
With Margin      = Subtotal × 1.13
Final Price      = ceil(With Margin / 10) × 10
```

### DO Charges Column Mapping
- 20FT/20GP → `20FT` column
- 40FT/40GP → `40FT` column
- 40HC/40HQ/45FT → `40HQ` column

### Destination Charges Column Mapping
- 20FT/20GP → `20FT` column
- Everything else → `40FT` column

### Destination Charges Basis
- `"Fixed (per shipment)"` → charge once
- All others → charge × qty

### Transport Charges
- Match delivery address against `Place` column (case-insensitive, substring match)
- Apply per container × qty

### Multi-Container / Multi-Shipment
- All fields are newline-separated and **index-aligned** (e.g., `container_type: "40FT\n20FT"`, `qty: "2\n1"`, `pol: "SHENZHEN\nSHENZHEN"`)
- Route fields (pol, pod, ready_date) are repeated per container entry so all fields have the same line count
- A "shipment" = one route. Mixed container types on the same route produce multiple lines with the same pol/pod
- Parse with `value.split('\n').map(v => v.trim())` — see `parseMultiValue()` in `lib/utils.ts`
- Calculate each container entry independently, sum for grand total

---

## 6. Modal Integration

### Select Agent Endpoint (POST)

Modal function `select_agent` in `automations/phase_3_select_and_quote.py` handles agent selection, pricing calculation, and quotation email.

**Payload:**
```json
{
  "rfq_id": "RFQ-20260220-ABC",
  "selected_agent": "Agent Name",
  "selected_carrier": "COSCO",
  "shipment_number": "1",
  "selected_by": "manager@company.com",
  "margin": 0.13,
  "quote_threshold": 2
}
```

**Flow:** Receive → Update master_rfqs (status=Selected) → Get Selected Quote → Read Pricing Tables → Port or Door? → Cost calculation (using dynamic `margin` from dashboard settings) → Update master_rfqs (status=Quoted, prices) → Send Quotation Email → Notify Sales → Return pricing breakdown

**Response:**
```json
{
  "success": true,
  "rfq_id": "RFQ-20260220-ABC",
  "final_price_aed": 15230,
  "final_price_usd": 4133.51
}
```

### Deployment
```bash
modal deploy automations/phase_3_select_and_quote.py
```
The deployed URL (e.g. `https://user--select-and-quote-phase-3-select-agent.modal.run`) is set as `MODAL_WEBHOOK_SELECT_AGENT` in the dashboard `.env.local`.

---

## 7. Supabase Database

The backend and frontend both interact natively with Supabase PostgreSQL. 

| Table | Purpose |
|-------|---------|
| `master_rfqs` | RFQ tracking and customer interactions |
| `agent_outbound_log` | Agent quotes and reminders |
| `agents` | Agent directory |
| `do_charges` | DO charges by carrier |
| `destination_charges` | Terminal/handling fees |
| `transportation_charges` | Trucking by location |

---

## 8. Environment Variables

```env
# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Modal Webhooks
MODAL_WEBHOOK_SELECT_AGENT=
MODAL_WEBHOOK_SECRET=

# NextAuth (Legacy - Removed)
# NEXTAUTH_SECRET=
# NEXTAUTH_URL=
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
```

---

## 9. Data Standards (from ACTION_PLAN.md §5)

### Carriers
`COSCO` · `MAERSK` · `EVERGREEN` · `MSC` · `ONE` · `HAPAG-LLOYD` · `CMA CGM` · `YANG MING` · `HMM` · `ZIM` · `PIL`

### Container Types
`20FT` · `40FT` · `40HC` · `40HQ` · `45FT` · `20OT` · `40OT`

### Status Colors

| Status | Color | Hex |
|--------|-------|-----|
| Processing | Blue | `#3B82F6` |
| Missing_Port_Data | Orange | `#F97316` |
| Missing_Door_Data | Orange | `#F97316` |
| Parse_Error | Red | `#EF4444` |
| Selected | Purple | `#8B5CF6` |
| Quoted | Green | `#22C55E` |
| Reminded | Yellow | `#EAB308` |
| Followed_Up | Teal | `#14B8A6` |
| Customer_Replied | Indigo | `#6366F1` |
| Requested | Slate | `#64748B` |
| Received | Emerald | `#10B981` |
| Invalid_Quote | Red | `#EF4444` |

---

## 10. Component Map

### Layout
- `app-shell.tsx` — root layout: sidebar + header + main
- `sidebar.tsx` — navigation with route links
- `header.tsx` — page title, notification bell, user avatar

### Dashboard (`/`)
- `kpi-card.tsx` — single metric (value, label, trend)
- `kpi-grid.tsx` — row of 5 KPIs: Active RFQs, Awaiting Quotes, Pending Selection, Quoted Today, Avg Response Time
- `pipeline-chart.tsx` — stacked bar of RFQ status counts
- `activity-feed.tsx` — recent status changes
- `pending-actions.tsx` — RFQs needing manager action

### RFQ Pipeline (`/rfqs`)
- `rfq-table.tsx` — sortable/filterable table (TanStack Table)
- `rfq-kanban.tsx` — status column board
- `status-badge.tsx` — color-coded status pill
- `rfq-filters.tsx` — status, date range, service type
- `view-toggle.tsx` — table/kanban switch

### RFQ Detail (`/rfqs/[rfqId]`)
- `shipment-card.tsx` — POL/POD, containers, service type
- `quote-table.tsx` — all agent quotes sorted by price
- `quote-chart.tsx` — bar chart price comparison
- `pricing-breakdown.tsx` — line-item cost table
- `timeline.tsx` — chronological event log
- `action-bar.tsx` — Select Agent, Recalculate, View Thread

### Agent Selection (`/rfqs/[rfqId]/select`)
- `quote-card.tsx` — rich card per agent/carrier quote
- `quote-grid.tsx` — grid layout of cards
- `comparison-table.tsx` — side-by-side for 2-3 quotes
- `confirm-dialog.tsx` — modal confirming choice → POST to Modal webhook

### Shared
- `currency-display.tsx` — format USD/AED
- `route-display.tsx` — POL → POD with arrow
- `container-badge.tsx` — "3×40HC" styled badge

---

## 11. Folder Structure

```
dashboard/
├── .env.local
├── .env.example
├── next.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── rfqs/
│   │   │   ├── page.tsx
│   │   │   └── [rfqId]/
│   │   │       ├── page.tsx
│   │   │       └── select/page.tsx
│   │   ├── agents/page.tsx
│   │   ├── pricing/page.tsx
│   │   ├── settings/page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── rfqs/
│   │       │   ├── route.ts
│   │       │   └── [rfqId]/
│   │       │       ├── route.ts
│   │       │       ├── quotes/route.ts
│   │       │       └── select/route.ts
│   │       ├── agents/route.ts
│   │       ├── pricing/
│   │       │   ├── do-charges/route.ts
│   │       │   ├── dest-charges/route.ts
│   │       │   ├── transport/route.ts
│   │       │   └── calculate/route.ts
│   │       └── analytics/route.ts
│   ├── components/
│   │   ├── layout/
│   │   ├── dashboard/
│   │   ├── rfqs/
│   │   ├── rfq-detail/
│   │   ├── selection/
│   │   ├── agents/
│   │   ├── pricing/
│   │   └── ui/
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── modal-client.ts
│   │   ├── pricing-engine.ts
│   │   ├── constants.ts
│   │   ├── utils.ts
│   │   └── auth.ts
│   ├── hooks/
│   │   ├── use-rfqs.ts
│   │   ├── use-rfq-detail.ts
│   │   ├── use-agents.ts
│   │   ├── use-pricing-tables.ts
│   │   ├── use-analytics.ts
│   │   └── use-select-agent.ts
│   ├── types/
│   │   ├── rfq.ts
│   │   ├── agent.ts
│   │   ├── pricing.ts
│   │   └── analytics.ts
│   └── store/
│       └── ui-store.ts
```
