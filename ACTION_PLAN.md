# ACTION_PLAN.md — Pricing AI Automation System

> Full business blueprint for the automated FCL pricing engine.
> Source: `action_plan/action_plan.html` + Modal workflow definitions.

---

## 1. Business Problem

- Manual RFQ handling is slow and inefficient
- Agent emails are unstructured and inconsistent
- Rate comparison is error-prone and time-consuming
- Carrier DO charges vary significantly across providers
- ETD decisions directly impact customer trust
- Pricing managers are overloaded with routine tasks

## 2. System Objectives

1. Fully automate FCL pricing
2. AI reads and processes customer RFQs automatically
3. AI validates enquiry completeness in real-time
4. System sends RFQs to 10 fixed China agents simultaneously
5. AI analyzes rates with carrier performance history
6. Pricing manager selects best agent with AI recommendations
7. System calculates final door-to-door price
8. System quotes customer instantly in standardized format

## 3. Tech Stack & Integrations

| Layer | Technology |
|-------|-----------|
| Dashboard | Next.js 16 + React 19, TanStack Query, Zustand, Radix UI, Tailwind CSS v4 |
| Orchestration | Modal.com (serverless Python 3.11) |
| AI/LLM | OpenAI GPT (Python SDK + Pydantic) |
| Email | Gmail API (OAuth 2.0 Web Application flow) |
| Email Trigger | Google Cloud Pub/Sub (Gmail push notifications) |
| Database | Supabase PostgreSQL |
| Hosting | Vercel (dashboard), Modal.com (automations) |
| Analytics | Vercel Analytics + Speed Insights |
| Background Jobs | Modal.com Cron (`scheduled_tasks.py`) |

| Service | Credential | Usage |
|---------|-----------|-------|
| Gmail | `token.json` (OAuth 2.0 via `authenticate_google.py`) | Push notifications (via Pub/Sub) + SMTP send + label management |
| Supabase | `SUPABASE_SERVICE_ROLE_KEY` / RLS Auth | RFQ logging, quote aggregation, pricing tables, status tracking, multi-tenant row-level security |
| Auth | Supabase Auth (Email & Google) | Secure session management (`@supabase/ssr`), magic links, OAuth |
| OpenAI | `OPENAI_API_KEY` | Email classification, data extraction, rate parsing |
| Modal | `evo-logistics-env` (named secret) | All env vars for serverless automation functions |
| System | `OWN_EMAIL` | System's Gmail address — used for self-reply guards and Gmail query filters |

**Supabase Tables (RLS Enabled):**
- **master_rfqs** — enquiry records with status (scoped by `user_id`)
- **agent_outbound_log** — all agent quotes (scoped by `user_id`)
- **agents** — agent directory (scoped by `user_id`)
- **app_settings** — dashboard configuration (profit margin, quote threshold) — key/value JSONB store
- **do_charges** — document and container charges lookup (globally readable)
- **destination_charges** — UAE port fees
- **transportation_charges** — distance-based transport costs

## 4. File Structure

```
evo_logistics/
├── .agents/
├── .claude/
│   └── skills/                                  # Claude environment specialized skills
├── CLAUDE.md                                    # Development guidelines
├── ACTION_PLAN.md                               # This file — full business & technical reference
├── DASHBOARD.md                                 # Dashboard architecture & documentation
├── SKILLS.md                                    # Skill registry — track all custom skills here
├── action_plan/
│   └── action_plan.html                         # 15-slide interactive blueprint
├── automations/                                 # Modal.com Serverless Python Automations
│   ├── AUTOMATIONS.md                           # Guide for running/deploying Modal scripts
│   ├── phase_1_request_analysis.py              # Webhook: RFQ parsing & validation (via Pub/Sub push)
│   ├── phase_2_quote_analysis.py                # Webhook: Quote analysis & pricing (via Pub/Sub push)
│   ├── phase_3_select_and_quote.py              # Webhook: Agent selection, pricing & quotation (via Dashboard)
│   ├── scheduled_tasks.py                       # Cron: 3h Agent Reminders & 24h Customer Follow-ups
│   └── authenticate_google.py                   # Generates OAuth 2.0 token.json
├── dashboard/                                   # Next.js pricing dashboard (frontend)
│   └── src/
│       ├── app/                                 # Pages, API routes, error.tsx, not-found.tsx
│       ├── components/                          # React components (UI, layout, domain)
│       ├── lib/                                 # Supabase client, pricing engine, settings, utils
│       ├── hooks/                               # TanStack Query hooks (analytics, rfqs, settings)
│       ├── store/                               # Zustand UI state
│       └── types/                               # TypeScript interfaces
```

## 5. Data Standards

### Port Mappings
| Input Variations | Normalized To |
|------------------|---------------|
| Dubai, DXB, Jebel Ali | JEBEL ALI |
| Qatar, Doha | HAMAD PORT |
| All port names | UPPERCASE |

### Carrier Names (Normalized)
`COSCO` · `MAERSK` · `EVERGREEN` · `MSC` · `ONE` · `HAPAG-LLOYD` · `CMA CGM` · `YANG MING` · `HMM` · `ZIM` · `PIL`

### Container Types
`20FT` · `40FT` · `40HC` · `40HQ` · `45FT` · `20OT` · `40OT`

### Formats
- **Dates:** `YYYY-MM-DD`
- **Currency:** USD (agent quotes), AED (customer quotation)
- **Prices:** No decimals in final quotation

## 6. End-to-End System Flow

```
INBOUND
  Customer sends RFQ email
    → Gmail Push Notification (via Pub/Sub → Modal webhook)
    → Text Classifier (LLM) → Process Email → AI Extractor (OpenAI)
    → Parse & Route
        ├─ complete       → Log → Time Check → Send to 10 agents
        ├─ need_port_data → AI reply requesting port/container info
        ├─ need_door_data → AI reply requesting delivery address
        └─ fallback       → Notify management

AGENT RESPONSE COLLECTION
  Agent replies arrive
    → Gmail Push Notification → Text Classifier → Extract Ref ID
    → AI Rate Parser (OpenAI) → Parse AI Output
    → Valid quote? → Log to Supabase → Aggregate all quotes
    → Threshold check (≥2 quotes)
        ├─ Met     → Notify pricing manager
        └─ Not met → Continue waiting (China time logic)

PRICING & QUOTATION
  Manager selects agent → System locks rate
    → Port or Door?
        ├─ Port → Cost Port calculation
        └─ Door → Cost Door calculation (+ transport + destination charges)
    → Apply 13% margin → Round to nearest 10 AED
    → Send quotation on original email thread
    → Wait 24 hours → Send follow-up if no response
    → Notify sales team
```

## 7. Customer Enquiry Processing (Phase 1 Workflow)

**Trigger:** Gmail Push Notification via Google Cloud Pub/Sub → Modal webhook (`gmail_push_phase1`)

**AI Extraction Targets:**
- POL (Port of Loading) / POD (Port of Discharge)
- Containers list: array of `{qty, type}` items per shipment (see section 5 for valid types)
- Cargo readiness date and time
- Incoterm requirements
- Pickup address / Delivery address
- Service type: port-to-port, door-to-port, door-to-door

**Validation Routing:**

| Route | Condition | Action |
|-------|-----------|--------|
| `complete` | All required fields present | Log → proceed to agent RFQ |
| `need_port_data` | Missing port or container info | AI reply requesting data |
| `need_door_data` | Missing delivery address | AI reply requesting address |
| `fallback` | Unrecognizable / error | Notify management |

**Key Logic:**
- Emails marked as read immediately upon fetch to prevent duplicate Pub/Sub processing
- Self-reply guard: emails from the system's own address are silently skipped to prevent infinite processing loops
- Agent rate replies are skipped completely and handled securely by Phase 2 (Inbox Partitioning)
- Thread-level deduplication: known threads from `master_rfqs` are loaded at start of each run; threads in terminal states (Processing, Parse_Error, Quoted, Customer_Replied) are skipped without calling OpenAI; threads needing data (Missing_Port_Data, Missing_Door_Data) are still processed as followups using the existing RFQ ID
- Customer replies to `Quoted` or `Followed_Up` RFQs automatically update status to `Customer_Replied` to prevent duplicate follow-ups
- Recursive MIME tree extraction handles plain text, HTML tables, and nested multipart emails
- AI extraction outputs `containers` array per shipment (each item has `qty` = int, `type` = container code)
- **1 route = 1 shipment**: Mixed container types on the same route are ONE shipment (e.g., "2x40FT + 1x20FT, SHENZEN→JEBEL ALI" = 1 shipment). Container types are display metadata, not separate shipments.
- Different routes → separate shipments (e.g., SHANGHAI→JEBEL ALI + NINGBO→HAMAD PORT = 2 shipments)
- Pydantic validators coerce OpenAI response types (string → list for pod_hint, string → int for container qty)
- Containers are stored as newline-separated `container_type` and `qty` fields in Supabase, with route fields (`pol`, `pod`) repeated per container entry for index alignment. Full multi-line values are preserved in the DB (not truncated to the first entry).
- Port name conversion (see section 5 for mappings)

## 8. Agent RFQ Automation

- Validated RFQ sent to **10 fixed China agents** simultaneously
- Each agent addressed by name (personalized communication)
- Delivery location auto-converted to **Jebel Ali Port** (UAE standard)
- All RFQs sent in **USD** for consistency
- Standardized RFQ format across all agents for easy comparison
- System tracks delivery and read receipts

## 9. China Time Logic & Automated Reminders

| Scenario | Wait Period | Automated Reminder |
|----------|-------------|-------------------|
| **Business hours** (Mon–Fri 09:00–17:00 CST) | 4 hours from RFQ send | At 3 hours mark, if <2 quotes received |
| **After hours** (after 17:00 / weekends) | Until next business day 11:00 CST | At 10:00 next business day |

- System converts all times to Shanghai timezone (UTC+8)
- Calculates next available business day automatically
- Implemented as a 15-minute cron job (`check_agent_reminders` in `scheduled_tasks.py`)
- Sends a quick "Any updates on this?" email mapped back to the original Thread ID, updating status to `Reminded`.

## 10. Agent Rate Analysis (Phase 2 Workflow)

**Trigger:** Gmail Push Notification via Google Cloud Pub/Sub → Modal webhook (`gmail_push_phase2`)

**Reference ID Extraction:** Regex `Ref:\s*\[?([A-Za-z0-9-]+)\]?` from email subject

**AI Rate Parser extracts per quote:**

| Field | Description |
|-------|-------------|
| Price | Ocean freight in USD |
| Carrier | Normalized name (COSCO, MAERSK, MSC, etc.) |
| ETD | Estimated Time of Departure (YYYY-MM-DD) |
| Transit Time | Days port-to-port |
| Free Time | Days free detention at destination port |
| Validity | Quote expiry date |

**Multi-shipment handling:**
- 1 route = 1 shipment: mixed container types on the same route produce ONE quote with a combined total price
- Parses multiple shipments per agent reply (each distinct route = separate shipment)
- Handles multiple carrier options per shipment
- Outputs ONE item per carrier option per shipment for the database
- Distinguishes bundled pricing (one price for all routes) vs per-shipment pricing

**Carrier name normalization:** see section 5 for full list

**Quote validation:** `isValidQuote` flag filters out declined/null/empty quotes

**Threshold:** ≥2 valid quotes required before notifying pricing manager

## 11. Pricing Manager Control

- Manager has **final approval and override authority**
- Reviews AI recommendations via email notification / dashboard
- Selects which agent to use based on experience + AI ranking
- System **locks selected rate** for all downstream calculation
- All steps after selection are **fully automatic**
- Complete audit trail maintained for every decision

## 12. Cost Calculation Engine

### Cost Components

| Component | Source | Notes |
|-----------|--------|-------|
| Ocean Freight | Agent quote (USD) | Primary cost — converted to AED |
| Currency Conversion | USD × 3.685 | Fixed rate: USD → AED |
| DO Charges | Lookup table | Document fee + per-container charge |
| UAE Destination Charges | Lookup table | All except BOE & DPC are **per container** |
| Transport to Warehouse | Distance-based table | Only for door delivery |
| Customs Clearance | Fixed + handling fees | Standard processing fees |

### Port vs Door Delivery

| Delivery Type | Calculation |
|---------------|-------------|
| **Port (Jebel Ali)** | Ocean freight (AED) + port charges + documentation |
| **Door (customer warehouse)** | Port total + destination charges + transport charges |

## 13. Margin & Rounding Rules

| Rule | Detail |
|------|--------|
| Profit margin | **Configurable** via dashboard Settings page (default **13%**, stored in Supabase `app_settings` table) |
| Rounding | Always round to nearest **10 AED** |
| Decimals | **No decimals** in final quotation — no .01, .05, etc. |
| Margin visibility | Breakdown visible to **management only** |
| Formula | `Final Price = ROUND(Total Cost × (1 + margin), nearest 10)` |
| Quote threshold | **Configurable** via dashboard Settings page (default **2**, stored in Supabase `app_settings`) — minimum quotes before manager notification |

## 14. Customer Quotation

- Reply **only on original RFQ email thread** (no new email loop)
- Standardized quotation format with company branding
- Includes:
  - Carrier name and service details
  - ETD and Transit Time
  - Final price in AED (all-inclusive)
  - All exclusions and special conditions
  - Quotation validity period
- **Automated follow-up** sent after 24 hours if no customer response (executed by `check_customer_followups` cron in `scheduled_tasks.py`, changing status to `Followed_Up`)
- Customer replies stop further follow-ups by setting status to `Customer_Replied`
- Internal sales team notified after quotation sent (enriched with route, containers, agent, service type, and pricing breakdown)

## 15. AI Learning Engine (Phase 6 — Planned)

- Track which agent wins most by specific route
- Monitor carrier complaint and performance history
- Improve ranking automatically based on success rate
- Optimize future RFQ waiting logic and timing
- Learn from manager overrides for better future suggestions
- Predictive analytics for rate fluctuations
- Route-specific pattern recognition for seasonal pricing

## 16. Execution Roadmap

| Phase | Name | Focus | Status |
|-------|------|-------|--------|
| 1 | Workflow Design | Process automation setup | Done (migrated to Modal) |
| 2 | AI Enquiry Parsing | AI email classification, extraction, normalization & routing | Done (`phase_1_request_analysis.py`) |
| 3 | Agent RFQ Automation | Agent outreach, quote collection & threshold notification | Done (`phase_1_request_analysis.py` + `phase_2_quote_analysis.py`) |
| 4 | Pricing Engine | Cost calculation & margin application system | Done (`phase_3_select_and_quote.py`) |
| 5 | Auto Quotation | Automated customer quotation generation | Done (`phase_3_select_and_quote.py`) |
| 6 | Learning Engine | AI optimization & analytics capabilities | Planned |

## 17. Vision & KPIs

| Target | Metric |
|--------|--------|
| Speed | **10x faster** pricing department operations |
| Accuracy | **Near-zero quotation errors** with AI validation |
| Availability | **Instant customer response 24/7** |
| Control | Management oversight with AI-powered insights |
| Scalability | Expandable to other trade routes and regions |
| Competitive edge | Pricing intelligence and market-aware automation |
