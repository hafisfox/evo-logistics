# FUTURE_PLAN.md — Multimodal Freight Expansion

> Expand Evo Logistics from ocean-only to **ocean + air + land (trucking/rail)** freight automation

---

## Quick Status

| Phase | Status | Blocker |
|-------|--------|---------|
| Phase 1: Air Foundation | Not started | Automation `freight_mode` gap (P0) |
| Phase 2: Air API Integration | Not started | Depends on Phase 1 |
| Phase 3: Land Foundation | Not started | Depends on Phase 1 schema patterns |
| Phase 4: Land API Integration | Not started | Depends on Phase 3 |
| Phase 5: Multimodal/Intermodal | Not started | Depends on Phases 2 + 4 |
| Phase 6: Intelligence/Optimization | Not started | Depends on Phase 5 |

---

## Executive Summary

| Metric | Current (Ocean Only) | Target (Multimodal) |
|--------|---------------------|---------------------|
| Freight modes | Ocean FCL/LCL | Ocean + Air + FTL/LTL + Rail/Intermodal |
| Carrier coverage | 11 ocean lines | 11 ocean + 300+ airlines + 259K+ trucking carriers |
| Quote automation | Email-driven, agent-mediated | Email + API-driven, semi-autonomous |
| Addressable market | ~$200B ocean freight | ~$4T total freight (ocean $200B + air $160B + US trucking $988B + rail) |

**Why now:**
- Only **2% penetration** of digital freight in trucking ($19.94B of $988B) — massive whitespace
- Air cargo platforms (cargo.one, WebCargo) launched multimodal in 2025–2026 — industry moving fast
- IATA ONE Record became the standard Jan 2026 — build compliant from the start
- Existing architecture (workspace isolation, Modal serverless, LLM parsing) is **mode-agnostic** and ready to extend

---

## Current State — Ocean Freight Automation (Updated 2026-03-04)

| Component | Status | Key Details |
|-----------|--------|-------------|
| Phase 1: RFQ Ingestion | Live | Gmail Pub/Sub → GPT-4o extraction → `rfq_shipments` + `rfq_shipment_containers`; extracts commodity, HS code, incoterms, DG/reefer, weight/volume |
| Phase 2: Quote Analysis | Live | Agent email replies → LLM parsing → `agent_quotes` with dedup; extracts surcharges (BAF/CAF/THC/etc), free_time_details, validity_date, conditions |
| Phase 3: Quote Selection | Live | Dashboard selection → surcharge-aware pricing → dynamic exchange rate → AED/USD pricing |
| Scheduled Tasks | Live | Multi-step agent escalation (0→3hrs→6hrs→12hrs→auto-close); quote expiry checks; stale RFQ detection |
| Carriers | 11 | COSCO, EVERGREEN, MSC, ONE, MAERSK, HAPAG-LLOYD, CMA CGM, YANG MING, HMM, PIL, ZIM |
| Container types | 8 | 20FT, 40FT, 40HC, 40HQ, 20OT, 40OT, 45FT, 20RF/40RF (reefer) |
| Service types | 4 | port-to-port, door-to-port, port-to-door, door-to-door |
| Pricing tables | 4 | DO charges, destination charges, transportation charges, exchange rates |
| Dashboard | Live | Next.js 16 + React 19 + Supabase + multi-tenant RLS; sortable/paginated RFQ table; CSV export; conversion funnel + revenue KPIs; exchange rate management; manual RFQ creation; notes + activity log |
| Schema | `freight_mode` ready | `rfq_shipments.freight_mode` and `agent_quotes.freight_mode` columns live with `CHECK ('ocean','air','land')` default `'ocean'` (migration 017) |
| TypeScript types | Done | `FreightMode`, `QuoteSurcharges`, `FreeTimeDetails`, `ExchangeRate`, `ActivityLog`, `RFQNote` in `dashboard/src/types/rfq.ts` |
| Extra tables | Live | `exchange_rates` (USD→AED history), `activity_logs`, `rfq_notes` |

**Key files for extension:**
- `automations/phase_1_request_analysis.py` — RFQ parsing template (ocean-specific prompts; needs air/land variants)
- `automations/phase_2_quote_analysis.py` — Quote extraction template (ocean-specific; needs per-kg and per-mile parsing)
- `dashboard/src/lib/pricing-engine.ts` — Pricing calculation logic (ocean only; needs DIM weight, FTL/LTL engines)
- `dashboard/supabase/migrations/` — Schema templates
- `dashboard/src/types/rfq.ts` — `FreightMode`, `RFQShipment`, `AgentQuote` types (multimodal-ready)

**Critical gap for multimodal:** Phase 1 automation (`ShipmentData` Pydantic model) has **no `freight_mode` field** — the column defaults to `'ocean'` silently. The GPT-4o extraction prompt and agent outreach email are 100% ocean-specific.

**Ocean hardcoding audit** — these locations must be updated for multimodal:
| Location | What's Hardcoded |
|----------|-----------------|
| `automations/phase_1_request_analysis.py` | `ShipmentData` model missing `freight_mode`; GPT-4o prompt ocean-only; email says "Ocean Freight rates" |
| `automations/phase_2_quote_analysis.py` | Quote parsing prompt ocean-only |
| `dashboard/src/app/api/rfqs/route.ts` ~line 293 | `freight_mode: "ocean"` on manual RFQ creation |
| `dashboard/src/lib/constants.ts` | `CARRIERS` = 11 ocean lines only; `CONTAINER_TYPES` = ocean only |
| `dashboard/src/app/rfqs/new/page.tsx` | New RFQ form only shows ocean fields (containers, POL/POD) |
| `dashboard/src/lib/pricing-engine.ts` | Entirely ocean-specific (DO/dest/transport charges, container-based) |
| `dashboard/src/lib/dashboard-summary.ts` | KPIs, revenue, pipeline counts don't segment by freight mode |
| `dashboard/src/types/analytics.ts` | No per-mode KPI breakdown |
| Sidebar icon | Ship icon, no air/land nav |
| `STATUS_CONFIG` | No air/land-specific statuses |

---

## Air Freight Expansion

### Market Opportunity

| Metric | Value |
|--------|-------|
| Market size (2025) | $160–282B |
| IATA cargo revenue (2025) | $157B (15.6% of airline total) |
| Growth (CAGR to 2031) | 5.85% |
| Digitized airline capacity | 78%+ on platforms like WebCargo |
| Key digital platforms | cargo.one (28K+ forwarders), WebCargo (5K+ forwarders), CargoAi (680+ airline schedules) |

### Air Freight API Landscape

| Platform | Coverage | API Type | Key Features | Pricing |
|----------|----------|----------|-------------|---------|
| **Freightos/WebCargo** | 300+ air carriers | REST (developers.freightos.com) | Rate estimation, 500M+ rate DB, air+ocean unified | Free tier available |
| **CargoAi CargoCONNECT** | 680+ airlines (schedules), 110+ (rates) | REST via RapidAPI | Route/Schedule, Quote/Book, Track/Trace, Cargo2ZERO | Enterprise pricing |
| **cargo.one** | 75+ airlines direct | Enterprise API | Search, compare, book, track; AI-powered quoting (Oct 2025) | Enterprise pricing |
| **7LFreight** | Air + inland | API | Rate management, quoting, booking | Enterprise pricing |

### Air-Specific Technical Requirements

| Requirement | Details |
|-------------|---------|
| **Document type** | AWB (Air Waybill) / HAWB instead of B/L |
| **Weight calculation** | Chargeable weight = `max(actual_weight, L×W×H / 6000)` per piece |
| **Cargo units** | Pallets, boxes, skids, breakbulk (not containers) |
| **Surcharges** | Fuel surcharge, security surcharge, TSA, handling, war risk |
| **DG handling** | 10–25% surcharge by hazard class; pre-booking IATA DG validation required |
| **Service types** | airport-to-airport, door-to-airport, airport-to-door, door-to-door |
| **Data standard** | IATA ONE Record (effective Jan 2026) — data-centric virtual shipment record |
| **e-AWB** | IATA Resolution 672 — digital AWBs mandatory in China; EU e-freight active |
| **Carrier list** | Emirates SkyCargo, Qatar Airways Cargo, Lufthansa Cargo, Singapore Airlines Cargo, Cathay Cargo, Turkish Cargo, Korean Air Cargo, ANA Cargo, FedEx, DHL, UPS Airlines, etc. |

### Air Freight Pricing Model

```
Air Freight Rate (per kg, chargeable weight)
  + Fuel Surcharge (FSC)
  + Security Surcharge (SSC)
  + TSA Fee (if applicable)
  + Handling Charges (origin + destination)
  + DG Surcharge (10-25% if applicable)
  + AWB Fee
  + Customs Clearance
  + Trucking (if door service)
  = Subtotal
  × (1 + Margin)
  → Convert to customer currency
```

### Air Freight DB Schema Extensions

```sql
-- New tables needed
air_carrier_profiles        -- airline master data
air_charge_profiles         -- per-airline charge structure
air_charge_rates            -- weight-tier rates per lane per airline
air_surcharge_types         -- FSC, SSC, TSA, handling, DG
rfq_shipment_pieces         -- piece-level cargo (weight, dims, DG class)
awb_documents               -- AWB/HAWB tracking
```

---

## Land Freight Expansion

### Market Opportunity

| Metric | Value |
|--------|-------|
| US trucking market (2026) | $988.25B |
| Global freight trucking (2025) | $2.67T |
| **Digital freight trucking (2025)** | **$19.94B (only ~2% penetration)** |
| Digital freight CAGR (to 2030) | 15.0% |
| US trucking businesses | 343,000 |
| Spot rate trend (early 2026) | 20%+ YoY increase |
| Intermodal growth | ~5% annually |

### Land Freight API Landscape

| Platform | Coverage | API Type | Key Features | Pricing |
|----------|----------|----------|-------------|---------|
| **DAT** | Largest NA freight marketplace | REST (dat.com/api-integration) | Load board, BookNow, RateView analytics | $50–300/user/mo; $500–1K setup |
| **project44** | 259K+ carriers, 186 countries | REST | Intelligent TMS, AI procurement agent, FTL/LTL/ocean/air | Enterprise SaaS |
| **Uber Freight** | FTL spot market | REST | Instant quoting, booking, tracking | Pricing API active |
| **Loadsmart** | FTL | REST | Quote & Book API, automated carrier matching | Production |
| **SMC3** | LTL industry standard | REST | Quote, rate, book, track, deliver lifecycle | Enterprise pricing |
| **FedEx Freight** | LTL | REST (developer.fedex.com) | Rate estimates, BOL, pickup, tracking | Developer portal |
| **FreightWaves SONAR** | Market intelligence | REST | SONAR TRAC spot pricing, benchmarking, forecasting | Subscription + API |
| **Greenscreens.ai** | Predictive pricing | API | 2–3x accuracy vs. traditional; GS Intuition forecasting | Enterprise (Triumph) |
| **BNSF Railway** | Rail intermodal | REST (bnsf.com) | Shipment tracking, quotes, schedules, waybill | Developer portal |
| **Union Pacific** | Rail intermodal | REST (up.com) | Shipment location, ETAs, equipment release, terminal reservations | Developer portal |
| **Railinc** | Rail data | REST (public.railinc.com) | Freight rail lifecycle operations, real-time data | Developer portal |

### FTL vs LTL vs PTL Quoting Differences

| Factor | FTL | LTL | PTL |
|--------|-----|-----|-----|
| **Pricing basis** | Per-mile or flat rate | NMFC freight class + weight density | Hybrid (space-based) |
| **Complexity** | Simple | High (classification, dimensional, reweigh) | Moderate |
| **Accessorials** | Few (detention, fuel) | Many (liftgate, inside delivery, residential, reclass) | Fewest |
| **API availability** | Widely available | SMC3 standard, FedEx, Estes | Limited |
| **Quote speed** | Near-instant | Near-instant (more data required) | Varies |
| **Typical accessorials** | Detention $50–100/hr, fuel surcharge | Liftgate $100–400, inside delivery, residential fee | Minimal |

### Land-Specific Technical Requirements

| Requirement | Details |
|-------------|---------|
| **Document types** | Bill of Lading (BOL), rate confirmation, POD |
| **Truck types** | Dry van, flatbed, refrigerated (reefer), tanker, step deck, lowboy |
| **Pricing inputs** | Origin/destination ZIP, weight, commodity, class (LTL), equipment type |
| **Detention/Demurrage** | $50–100/hr trucking detention; $75–300/day container demurrage |
| **Cross-border** | VUCEM (Mexico, mandatory Dec 2025), USMCA compliance, customs permits |
| **Service types** | pickup, delivery, cross-dock, transshipment, port drayage |
| **Capacity data** | Load-to-truck ratios, spot vs contract rates, seasonal patterns |

### Land Freight Pricing Model

```
FTL: Base Rate (per mile × distance OR flat)
  + Fuel Surcharge (% of linehaul or per-mile)
  + Accessorials (detention, liftgate, etc.)
  = Subtotal × (1 + Margin)

LTL: Base Rate (freight class × weight × distance)
  + Fuel Surcharge
  + Accessorials (liftgate, inside delivery, residential, notify)
  + Minimum charge floor
  = Subtotal × (1 + Margin)
```

### Land Freight DB Schema Extensions

```sql
-- New tables needed
truck_carrier_profiles      -- carrier master data, equipment types
truck_lane_rates            -- origin-dest ZIP pair rates
truck_accessorial_types     -- detention, liftgate, residential, etc.
ltl_freight_classes         -- NMFC classification table
ltl_rate_tariffs            -- class-based rate tables
rail_intermodal_rates       -- rail lane rates
drayage_rates               -- port drayage by terminal/distance
rfq_shipment_truck_details  -- weight, class, equipment, commodity
```

---

## Multimodal Architecture

### Unified Data Model

```
master_rfqs (existing)
  └── rfq_shipments (existing — `freight_mode` column LIVE, CHECK ocean/air/land)
        ├── rfq_shipment_containers (ocean — existing)
        ├── rfq_shipment_pieces (air — NEW)
        ├── rfq_shipment_truck_details (land — NEW)
        └── rfq_shipment_legs (intermodal — NEW, for multi-leg journeys)
              - leg_number, freight_mode, origin, destination, carrier, price, transit_time

agent_quotes (existing — `freight_mode` column LIVE)
  ├── Ocean-specific: carrier (shipping line), container type, transit days
  ├── Air-specific: airline, chargeable weight, flight number
  └── Land-specific: truck carrier, equipment type, per-mile rate
```

**Air surcharge strategy:** Air-specific surcharges (FSC, SSC, TSA, handling, DG surcharge, AWB fee) use the `[key: string]` catch-all on the existing `QuoteSurcharges` interface — no schema change needed.

### Carrier Connectivity Layer

```
┌─────────────────────────────────────────────────┐
│              Evo Rate Aggregator                 │
│  (Unified API gateway — normalize all responses) │
├────────────┬──────────────┬─────────────────────┤
│   Ocean    │     Air      │       Land          │
│ ─────────  │ ───────────  │ ─────────────────── │
│ WebCargo   │ WebCargo Air │ DAT API             │
│ Freightify │ CargoAi      │ Uber Freight API    │
│ Xeneta     │ cargo.one    │ Loadsmart API       │
│            │              │ SMC3 (LTL)          │
│            │              │ BNSF / UP (Rail)    │
├────────────┴──────────────┴─────────────────────┤
│           project44 (Visibility — all modes)     │
└─────────────────────────────────────────────────┘
```

### Intermodal Journey Patterns

| Pattern | Legs | Use Case |
|---------|------|----------|
| **Ocean → Drayage → Truck** | Port → terminal truck → warehouse | Standard import |
| **Ocean → Drayage → Rail → Truck** | Port → rail terminal → rail → last-mile truck | Cost-optimized long haul |
| **Air → Truck** | Airport → pickup truck → warehouse | Urgent shipments |
| **Truck → Rail → Truck** | Origin truck → intermodal rail → destination truck | Domestic long haul |
| **Ocean + Air** | Bulk via ocean, urgent supplements via air | Hybrid supply chain |

---

## Technology Stack Additions

| Layer | Current | Add for Multimodal |
|-------|---------|-------------------|
| **Rate APIs** | (manual agent emails) | Freightos WebCargo (air+ocean), DAT (trucking), SMC3 (LTL), CargoAi (air) |
| **Visibility** | (none) | project44 REST API (all modes) or Terminal49 (ocean) + FourKites |
| **Market Data** | (none) | Xeneta (ocean/air benchmarks), FreightWaves SONAR (trucking spot) |
| **OCR/Documents** | GPT-4o (email parsing) | Add AWB OCR (Veryfi API), BOL extraction, e-AWB generation |
| **LLM Prompts** | Ocean RFQ + quote prompts | New prompt sets for air RFQ, land RFQ, multimodal RFQ |
| **DB Schema** | Ocean tables + pricing | Air/land/intermodal tables (see schema sections above) |
| **Dashboard** | Ocean-focused UI | Mode selector, air/land pricing calculators, intermodal journey view |
| **Compliance** | (none) | IATA ONE Record data model, VUCEM integration, USMCA doc generation |

---

## Phased Roadmap

### Phase 1: Air Freight Foundation (Weeks 1–6)

| Task | Details | Priority |
|------|---------|----------|
| ~~Add `freight_mode` to `rfq_shipments` + `agent_quotes`~~ | ~~DONE — migration 017, columns live~~ | ~~P0~~ |
| ~~`FreightMode` TypeScript type~~ | ~~DONE — `dashboard/src/types/rfq.ts`~~ | ~~P0~~ |
| Add `freight_mode` to Phase 1 automation | Add to `ShipmentData` Pydantic model; update GPT-4o prompt to detect mode from email; update `_dual_write_normalized_rfq()` to write mode; update agent outreach email template | **P0** |
| Add `freight_mode` to Phase 2 automation | Update quote parsing prompt for mode-aware extraction | **P0** |
| Create air DB tables | `air_carrier_profiles`, `air_charge_rates`, `rfq_shipment_pieces` | P0 |
| Extend Phase 1 prompt for air | New GPT-4o system prompt for air RFQ extraction (airline, weight, dims, airport codes) | P0 |
| Extend Phase 2 prompt for air | Air quote parsing (per-kg rates, FSC, SSC, chargeable weight) | P0 |
| DIM weight calculator | `max(actual, L×W×H/6000)` utility in both Python + TypeScript | P1 |
| Dashboard mode selector | Toggle ocean/air on RFQ creation + display; update constants (carriers, container types) | P1 |
| Air pricing engine | Weight-tier based pricing with surcharge stacking | P1 |
| Analytics mode breakdown | Extend `DashboardKPIs` and `buildDashboardSummary()` to support per-mode filtering | P2 |

### Phase 2: Air Freight API Integration (Weeks 7–12)

| Task | Details | Priority |
|------|---------|----------|
| Freightos Rate Estimator API | Integrate free-tier API for instant air rate estimates | P0 |
| CargoAi CargoCONNECT | Route/Schedule API + Track/Trace API with webhooks | P1 |
| AWB document automation | OCR extraction (Veryfi API) + e-AWB generation | P1 |
| Air carrier normalization | Master list of 50+ airlines with IATA codes | P1 |
| IATA ONE Record compliance | Design data model around virtual shipment record standard | P2 |

### Phase 3: Land Freight Foundation (Weeks 13–18)

| Task | Details | Priority |
|------|---------|----------|
| Create land DB tables | `truck_carrier_profiles`, `truck_lane_rates`, `ltl_freight_classes`, `drayage_rates` | P0 |
| Extend Phase 1 for land RFQs | Extract: origin/dest ZIP, weight, commodity, equipment type, FTL/LTL | P0 |
| Extend Phase 2 for land quotes | Parse: per-mile rates, accessorials, fuel surcharge, transit days | P0 |
| FTL pricing engine | Per-mile + fuel surcharge + accessorial stacking | P0 |
| LTL pricing engine | Class-based rating with NMFC lookup | P1 |
| Dashboard land mode | FTL/LTL toggle, truck type selector, weight/class inputs | P1 |

### Phase 4: Land Freight API Integration (Weeks 19–24)

| Task | Details | Priority |
|------|---------|----------|
| DAT API integration | Rate intelligence, load board access, BookNow | P0 |
| SMC3 LTL API | Standard LTL rating, booking, tracking | P1 |
| Uber Freight / Loadsmart API | FTL instant quoting and booking | P1 |
| Detention/demurrage tracking | Automated D&D fee calculation and alerts | P2 |
| Cross-border module | VUCEM integration for Mexico, USMCA doc generation | P2 |

### Phase 5: Multimodal & Intermodal (Weeks 25–32)

| Task | Details | Priority |
|------|---------|----------|
| Unified rate aggregator | Single API gateway normalizing responses across all modes | P0 |
| project44 visibility integration | Multi-modal tracking (ocean + air + truck + rail) | P0 |
| Intermodal journey builder | Multi-leg shipment creation (ocean → drayage → rail → truck) | P1 |
| Rail API integration | BNSF + Union Pacific for intermodal routing | P1 |
| Multimodal RFQ parsing | Single email → auto-detect mode or parse multi-leg requests | P1 |

### Phase 6: Intelligence & Optimization (Weeks 33–44)

| Task | Details | Priority |
|------|---------|----------|
| Historical rate database | Time-series storage for all modes (TimescaleDB) | P0 |
| Xeneta + SONAR integration | Ocean/air benchmarks + trucking spot market data | P1 |
| Predictive pricing models | XGBoost/LightGBM per mode, trained on accumulated data | P1 |
| Mode comparison engine | Auto-recommend ocean vs air vs land based on cost/time/reliability | P2 |
| Carbon footprint tracking | CargoAi Cargo2ZERO API + mode-specific emission factors | P2 |

---

## API Integration Priority

| Priority | API | Mode | Why This Order | Effort |
|----------|-----|------|----------------|--------|
| 1 | Freightos Rate Estimator | Air+Ocean | Free tier, REST, covers 2 modes at once | Low |
| 2 | FedEx Freight LTL | Land (LTL) | Free developer portal, standard LTL API | Low |
| 3 | DAT | Land (FTL) | Largest NA trucking marketplace, spot market | Medium ($50–300/mo) |
| 4 | CargoAi CargoCONNECT | Air | 680+ airline schedules, requires IATA/CASS | High (enterprise) |
| 5 | SMC3 | Land (LTL) | Industry-standard LTL rating | High (enterprise) |
| 6 | project44 | All modes | Visibility layer, do last after rate APIs | High (enterprise) |

---

## API Reference Quick-Access

### Air Freight APIs

| API | Endpoint / Portal | Auth | Free Tier |
|-----|-------------------|------|-----------|
| Freightos Rate Estimator | `freightos-prod.apigee.net/estimator/shippingCalculator` | API key | Yes |
| Freightos Developer Portal | `developers.freightos.com` | OAuth | Yes (limited) |
| CargoAi Route/Schedule | RapidAPI (`cargoai.readme.io`) | API key | No |
| CargoAi Quote/Book | RapidAPI (requires IATA/CASS) | API key + IATA | No |
| CargoAi Track/Trace | RapidAPI (webhook callbacks) | API key | No |
| cargo.one Enterprise | Contact sales | Enterprise | No |
| Veryfi AWB OCR | `veryfi.com/api` | API key | Limited |

### Land Freight APIs

| API | Endpoint / Portal | Auth | Free Tier |
|-----|-------------------|------|-----------|
| DAT | `dat.com/api-integration` | API key | No ($50–300/mo) |
| SMC3 | `smc3.com/ltl-api` | Enterprise | No |
| FedEx Freight LTL | `developer.fedex.com` | Developer key | Yes (limited) |
| Uber Freight | Contact sales | Enterprise | No |
| Loadsmart Quote & Book | Contact sales | Enterprise | No |
| FreightWaves SONAR | `gosonar.com` | Subscription | No |
| BNSF Railway | `bnsf.com/ship-with-bnsf/support-services/customer-api/` | Developer portal | Yes |
| Union Pacific | `up.com/shipping/resources/api-developer` | Developer portal | Yes |
| Railinc | `public.railinc.com/developers` | Developer portal | Yes |

### Multimodal / Visibility APIs

| API | Endpoint / Portal | Auth | Free Tier |
|-----|-------------------|------|-----------|
| project44 | Contact sales | Enterprise | No |
| Terminal49 | `terminal49.com` | API key | Limited |
| FourKites | Contact sales | Enterprise | No |
| Xeneta | Contact sales | Enterprise | No |

---

## Key Market Data Summary

| Mode | Market Size | Digital Penetration | Growth (CAGR) | Top Opportunity |
|------|-------------|--------------------:|---------------|-----------------|
| **Ocean** | ~$200B | 10–15% digital forwarders | 20% (digital segment) | LCL automation, ILC pricing |
| **Air** | $160–282B | 78% capacity digitized | 5.85% | ONE Record compliance, DIM weight automation |
| **Trucking** | $988B (US) | ~2% digital | 15% (digital) | FTL/LTL instant quoting, spot market access |
| **Rail/Intermodal** | Growing 5%/yr | 71% terminals prioritize digital | ~5% | API-driven intermodal booking |

---

## Sources

Full source list extracted to [FUTURE_PLAN_SOURCES.md](FUTURE_PLAN_SOURCES.md) to keep this document focused on actionable items.
