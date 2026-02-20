# ACTION_PLAN.md — Pricing AI Automation System

> Full business blueprint for the automated FCL pricing engine.
> Source: `action_plan/action_plan.html` + n8n workflow definitions.

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
| Orchestration | Modal.com (serverless Python) |
| AI/LLM | OpenAI GPT (Python SDK + Pydantic) |
| Email | Gmail API (OAuth 2.0 Web Application flow) |
| Email Trigger | Google Cloud Pub/Sub (Gmail push notifications) |
| Database | Supabase PostgreSQL |

| Service | Credential | Usage |
|---------|-----------|-------|
| Gmail | `token.json` (OAuth 2.0 via `authenticate_google.py`, account: `yunapink05@gmail.com`) | Push notifications (via Pub/Sub) + SMTP send + label management |
| Supabase | `SUPABASE_SERVICE_ROLE_KEY` | RFQ logging, quote aggregation, pricing tables, status tracking |
| OpenAI | `.env` (`OPENAI_API_KEY`) | Email classification, data extraction, rate parsing |

**Supabase Tables:**
- **master_rfqs** — enquiry records with status
- **agent_outbound_log** — all agent quotes (refId, agent, carrier, price, ETD, transit, validity)
- **do_charges** — document and container charges lookup
- **destination_charges** — UAE port fees
- **transportation_charges** — distance-based transport costs

## 4. File Structure

```
evo_logistics/
├── .agents/
│   └── skills/                                  # AI agent specialized skills (n8n, prompt engg)
├── .claude/
│   └── skills/                                  # Claude environment specialized skills
├── AGENTS.md                                    # Antigravity n8n-MCP system instructions
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
│   └── authenticate_google.py                   # Generates OAuth 2.0 token.json
├── dashboard/                                   # Next.js pricing dashboard (frontend)
│   └── src/
│       ├── app/                                 # Pages & API routes
│       ├── components/                          # React components
│       ├── lib/                                 # Supabase client, pricing engine, utils
│       ├── hooks/                               # TanStack Query hooks
│       └── types/                               # TypeScript interfaces
└── workflows/
    ├── Phase 1 - Request Analysis.json          # (Legacy) n8n RFQ parsing & validation
    └── Phase 2 - Quote Analysis.json            # (Legacy) n8n Quote analysis & pricing
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
- Container type & quantity (see section 5 for valid types)
- Cargo type and special requirements
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
- Agent rate replies are re-marked as UNREAD after classification so Phase 2 can pick them up
- Thread-level deduplication: known threads from `master_rfqs` are loaded at start of each run; threads in terminal states (Processing, Parse_Error, Quoted) are skipped without calling OpenAI; threads needing data (Missing_Port_Data, Missing_Door_Data) are still processed as followups using the existing RFQ ID
- Recursive MIME tree extraction handles plain text, HTML tables, and nested multipart emails
- AI extraction uses strict field definitions (qty = container count, type = container code only, service_type = one of 4 valid values)
- Pydantic validators coerce OpenAI response types (string → list for pod_hint, string → int for qty)
- Handles multi-shipment requests (different container types, same route)
- Port name conversion (see section 5 for mappings)

## 8. Agent RFQ Automation

- Validated RFQ sent to **10 fixed China agents** simultaneously
- Each agent addressed by name (personalized communication)
- Delivery location auto-converted to **Jebel Ali Port** (UAE standard)
- All RFQs sent in **USD** for consistency
- Standardized RFQ format across all agents for easy comparison
- System tracks delivery and read receipts

## 9. China Time Logic (UTC+8)

| Scenario | Wait Period | Automated Reminder |
|----------|-------------|-------------------|
| **Business hours** (Mon–Fri 09:00–17:00 CST) | 4 hours from RFQ send | At 3 hours mark, if <4 quotes received |
| **After hours** (after 17:00 / weekends) | Until next business day 11:00 CST | At 10:00 next business day |

- System converts all times to Shanghai timezone (UTC+8)
- Calculates next available business day automatically
- Handles public holidays awareness (planned)

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
- Parses multiple shipments per agent reply
- Handles multiple carrier options per shipment
- Outputs ONE item per carrier option per shipment for the database
- Distinguishes bundled pricing (one price for all) vs per-shipment pricing

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
| Profit margin | **13%** applied to total cost |
| Rounding | Always round to nearest **10 AED** |
| Decimals | **No decimals** in final quotation — no .01, .05, etc. |
| Margin visibility | Breakdown visible to **management only** |
| Formula | `Final Price = ROUND(Total Cost × 1.13, nearest 10)` |

## 14. Customer Quotation

- Reply **only on original RFQ email thread** (no new email loop)
- Standardized quotation format with company branding
- Includes:
  - Carrier name and service details
  - ETD and Transit Time
  - Final price in AED (all-inclusive)
  - All exclusions and special conditions
  - Quotation validity period
- **Automated follow-up** sent after 24 hours if no customer response
- Customer response tracked and routed (acceptance / rejection / counter)
- Internal sales team notified after quotation sent

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
| 1 | Workflow Design | n8n workflow mapping & process automation setup | Done (migrated to Modal) |
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
