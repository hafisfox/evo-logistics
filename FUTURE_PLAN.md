# FUTURE_PLAN.md — Multimodal Freight Expansion

> Expand Evo Logistics from ocean-only to **ocean + air + land (trucking/rail)** freight automation

---

## Quick Status

| Phase | Weeks | Status | Blocker |
|-------|-------|--------|---------|
| Phase 1: Air Foundation | 1–10 | **Complete** | All P0/P1/P2 air tasks done; final blocker closed — 52 synthetic air RFQ fixtures + mode-classification/extraction eval harness (`automations/tests/eval_phase1_air_fixtures.py`) + offline CI rules test (`test_phase1_air_prompt_parsing_rules.py`) shipped |
| Phase 2: Air API Integration | 11–18 | Not started | Depends on Phase 1; start enterprise sales in Phase 1 |
| Phase 3: Land Foundation | 19–26 | **Complete** | Land DB tables (migration 020), Phase 1/2 land prompts + extraction, FTL/LTL pricing engines, dashboard land mode + pricing tabs (Truckers/Lane Rates/LTL Classes), 52 synthetic land RFQ fixtures + eval harness (`automations/tests/eval_phase1_land_fixtures.py`) + offline CI rules test (`test_phase1_land_prompt_parsing_rules.py`) all shipped, flag-gated on `NEXT_PUBLIC_FEATURE_LAND_FREIGHT` |
| Phase 4: Land API Integration | 27–34 | Not started | Depends on Phase 3 |
| Phase 5: Multimodal/Intermodal | 35–44 | Not started | Depends on Phases 2 + 4 |
| Phase 6: Intelligence/Optimization | 45–58 | Not started | Depends on Phase 5 |

> **Timeline note:** Original estimate was 44 weeks. Revised to ~58 weeks to account for prompt engineering complexity (2-3 weeks per mode), enterprise API sales cycles (4-8 weeks), and inter-phase buffers. Assumes 1-2 engineers; adjust if team grows.

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

> Full current implementation details in [ACTION_PLAN.md](ACTION_PLAN.md). Key multimodal-relevant facts below.

| Item | Status | Multimodal Relevance |
|------|--------|---------------------|
| Schema: `freight_mode` column | Live (migration 017) | `CHECK ('ocean','air','land')` on `rfq_shipments` + `agent_quotes`, default `'ocean'` — **needs `'intermodal'` added** |
| TypeScript: `FreightMode` type | Done | `"ocean" \| "air" \| "land"` in `dashboard/src/types/rfq.ts` — needs `"intermodal"` |
| Container types | 9 validated | ~~Three-way mismatch~~ **FIXED** — all 3 locations now consistent: 20FT, 40FT, 40HC, 40HQ, 45FT, 20OT, 40OT, 20RF, 40RF |
| Dual-write pattern | Active | `RFQ_NORMALIZED_DUAL_WRITE=true` — new modes should be normalized-only |

**Key files for extension:**
- `automations/phase_1_request_analysis.py` — RFQ parsing template (ocean-specific prompts; needs air/land variants)
- `automations/phase_2_quote_analysis.py` — Quote extraction template (ocean-specific; needs per-kg and per-mile parsing)
- `dashboard/src/lib/pricing-engine.ts` — Pricing calculation logic (ocean only; needs DIM weight, FTL/LTL engines)
- `dashboard/supabase/migrations/` — Schema templates
- `dashboard/src/types/rfq.ts` — `FreightMode`, `RFQShipment`, `AgentQuote` types (multimodal-ready)

~~**Critical gap for multimodal:** Phase 1 automation (`ShipmentData` Pydantic model) has **no `freight_mode` field`** — the column defaults to `'ocean'` silently.~~ **FIXED** — `freight_mode` field added to `ShipmentData`, mode detection wired into main flow, mode-specific prompts + agent outreach + validation all implemented.

**Ocean hardcoding audit** — these locations must be updated for multimodal:
| Location | What's Hardcoded |
|----------|-----------------|
| ~~`automations/phase_1_request_analysis.py`~~ | ~~`ShipmentData` model missing `freight_mode`; GPT-4o prompt ocean-only; email says "Ocean Freight rates"~~ **FIXED** |
| ~~`automations/phase_2_quote_analysis.py`~~ | ~~Quote parsing prompt ocean-only~~ **FIXED** — mode-specific prompts, carrier normalization, surcharge fields, DB writes |
| ~~`dashboard/src/app/api/rfqs/route.ts` ~line 293~~ | ~~`freight_mode: "ocean"` on manual RFQ creation~~ **FIXED** — reads `freight_mode` from request body; inserts pieces for air freight |
| ~~`dashboard/src/lib/constants.ts`~~ | ~~`CARRIERS` = 11 ocean lines only; `CONTAINER_TYPES` = ocean only~~ **FIXED** — `CARRIERS_BY_MODE`, `EQUIPMENT_BY_MODE`, `SERVICE_TYPES_BY_MODE` added; feature flags added |
| ~~`dashboard/src/app/rfqs/new/page.tsx`~~ | ~~New RFQ form only shows ocean fields (containers, POL/POD)~~ **FIXED** — freight mode selector, conditional ocean/air/land sections, pieces form for air |
| `dashboard/src/lib/pricing-engine.ts` | Entirely ocean-specific (DO/dest/transport charges, container-based) |
| ~~`dashboard/src/lib/dashboard-summary.ts`~~ | ~~KPIs, revenue, pipeline counts don't segment by freight mode~~ **FIXED** — route labels use generic origin/destination |
| `dashboard/src/types/analytics.ts` | No per-mode KPI breakdown |
| ~~`dashboard/src/lib/rfq-normalization.ts` ~line 12~~ | ~~`DEFAULT_OCEAN_FIELDS` hardcodes `freight_mode: "ocean"`~~ **FIXED** — renamed to `DEFAULT_SHIPMENT_FIELDS` + `defaultFieldsForMode()` helper; VALID_SERVICE_TYPES expanded |
| ~~`automations/phase_1_request_analysis.py` ~line 56~~ | ~~`VALID_TYPES` = ocean container types only~~ **FIXED** — mode-aware `normalize_type()` bypasses for air/land |
| ~~`automations/phase_1_request_analysis.py` ~lines 62-73~~ | ~~`PORT_FIELD_INFO` / `DOOR_FIELD_INFO` dicts — ocean-specific~~ **FIXED** — `AIRPORT_FIELD_INFO` + `TRUCK_FIELD_INFO` added |
| ~~`automations/phase_1_request_analysis.py` ~line 158~~ | ~~`classify_email()` prompt misclassifies air/land~~ **FIXED** — air/land signal words added |
| `automations/phase_3_select_and_quote.py` | `SelectAgentRequest` model has no `freight_mode`; entire pricing logic is ocean-only (DO charges, dest charges, transport) |
| `dashboard/src/types/pricing.ts` | `ShipmentCost` has ocean-specific field names: `oceanFreightUSD`, `oceanFreightAED`, `doDocument`, `doPerContainer`, `doTotal`, `destTotal`, `transpPerContainer`, `transpTotal` |
| Sidebar icon (`app-shell.tsx`) | Ship icon, no air/land nav |
| `STATUS_CONFIG` in `constants.ts` | No air/land-specific statuses; ~~missing `Cancelled`, `On_Hold`, `Expired`~~ **FIXED** |

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
| **Flexport** | Air + ocean + trucking | REST (public API launched 2025) | Instant quoting, booking, tracking across modes | Enterprise pricing |

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
air_carrier_profiles        -- airline master data (iata_code, name, cargo_types, active)
air_charge_profiles         -- per-airline charge structure
air_charge_rates            -- weight-tier rates per lane per airline
air_surcharge_types         -- FSC, SSC, TSA, handling, DG
awb_documents               -- AWB/HAWB tracking

-- rfq_shipment_pieces — piece-level cargo for air shipments
--   rfq_id, shipment_number, piece_number, piece_count,
--   length_cm, width_cm, height_cm, gross_weight_kg,
--   volume_weight_kg (computed: L×W×H/6000 × count),
--   chargeable_weight_kg (computed: max of gross, volume),
--   packaging_type ('pallet'|'box'|'skid'|'loose'),
--   stackable (boolean), dg_class, un_number
rfq_shipment_pieces
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
truck_carrier_profiles      -- carrier master data (MC#, DOT#, equipment types, active)
truck_lane_rates            -- origin-dest ZIP pair rates
truck_accessorial_types     -- detention, liftgate, residential, etc.
ltl_freight_classes         -- NMFC classification table
ltl_rate_tariffs            -- class-based rate tables
rail_intermodal_rates       -- rail lane rates
drayage_rates               -- port drayage by terminal/distance

-- rfq_shipment_truck_details — truck-specific shipment data
--   rfq_id, shipment_number,
--   equipment_type ('dry_van'|'flatbed'|'reefer'|'tanker'|'step_deck'|'lowboy'),
--   load_type ('FTL'|'LTL'|'PTL'),
--   weight_lbs, nmfc_class (for LTL), commodity_description,
--   hazmat (boolean), accessorials (jsonb array),
--   origin_zip, destination_zip
rfq_shipment_truck_details
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
  ├── Ocean-specific: carrier (shipping line), container type, transit days (existing columns)
  ├── Air-specific (nullable columns to add): airline_iata, chargeable_weight_kg, flight_number
  └── Land-specific (nullable columns to add): equipment_type, per_mile_rate, load_type
```

**Service type expansion:** Current `service_type` values (`port-to-port`, `door-to-port`, `port-to-door`, `door-to-door`) are ocean-centric. Expand the enum to include: `airport-to-airport`, `door-to-airport`, `airport-to-door` (air) and `pickup`, `delivery`, `cross-dock` (land). Keep as a single column with all values — mode-specific validation in application code.

**Air surcharge strategy:** Add named optional fields for common air/land surcharges (`FSC`, `SSC`, `TSA`, `handling`, `dg_surcharge`, `awb_fee`) to the `QuoteSurcharges` interface for compile-time safety, alongside the existing `[key: string]` catch-all for uncommon surcharges.

**Intermodal `freight_mode`:** Add `'intermodal'` to the CHECK constraint. Parent `rfq_shipments.freight_mode = 'intermodal'` when shipment has multiple legs; per-leg modes tracked in `rfq_shipment_legs`.

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

### Phase 1: Air Freight Foundation (Weeks 1–10)

| Task | Details | Priority |
|------|---------|----------|
| ~~Add `freight_mode` to `rfq_shipments` + `agent_quotes`~~ | ~~DONE — migration 017, columns live~~ | ~~P0~~ |
| ~~`FreightMode` TypeScript type~~ | ~~DONE — `dashboard/src/types/rfq.ts`~~ | ~~P0~~ |
| ~~**1a.** Add `freight_mode` to `ShipmentData` Pydantic model~~ | ~~DONE — `Literal["ocean","air","land"]` with default "ocean"~~ | ~~P0~~ |
| ~~**1b.** Update `classify_email()` prompt~~ | ~~DONE — air/land signal words added~~ | ~~P0~~ |
| ~~**1c.** Create mode-specific field info dicts~~ | ~~DONE — `AIRPORT_FIELD_INFO` + `TRUCK_FIELD_INFO`~~ | ~~P0~~ |
| ~~**1d.** Make `VALID_TYPES` mode-aware~~ | ~~DONE — bypasses validation for air/land~~ | ~~P0~~ |
| ~~**1e.** Mode-branching in GPT-4o prompt~~ | ~~DONE — two-pass: `detect_freight_mode()` → `_get_system_prompt_for_mode()`~~ | ~~P0~~ |
| ~~**1f.** Add `freight_mode` to `ExtractedRFQs` wrapper model~~ | ~~DONE — `freight_mode` on `ShipmentData`, injected after detection~~ | ~~P0~~ |
| ~~**1g.** Update `_dual_write_normalized_rfq()`~~ | ~~DONE — writes `freight_mode` to `rfq_shipments`~~ | ~~P0~~ |
| ~~**1h.** Mode-conditional agent outreach email~~ | ~~DONE — per-kg (air), per-load (land), per-container (ocean)~~ | ~~P0~~ |
| ~~**1i.** Add `PieceItem` Pydantic model for air~~ | ~~DONE — with string-to-int coercion, validated through pipeline~~ | ~~P0~~ |
| ~~Add `freight_mode` to Phase 2 automation~~ | ~~DONE — `QuoteData` has `freight_mode`, mode-specific prompts, mode-aware carrier normalization, `SurchargeData` extended with air/land fields, DB writes with `freight_mode`, manager notification mode-aware~~ | ~~P0~~ |
| ~~Create `rfq_shipment_pieces` table~~ | ~~DONE — migration 018, RLS policies, pieces persistence in Phase 1 automation~~ | ~~P0~~ |
| ~~Create `air_carrier_profiles`, `air_charge_rates` tables~~ | ~~DONE — migration 019 (RLS, weight-tier rate book in USD/kg); CRUD API + hooks + `/pricing` Airlines/Air Rates tabs (flag-gated)~~ | ~~P0~~ |
| ~~Extend Phase 1 prompt for air~~ | ~~DONE — air-specific GPT-4o system prompt with airline, weight, dims, airport codes~~ | ~~P0~~ |
| ~~Extend Phase 2 prompt for air~~ | ~~DONE — air quote parsing with per-kg rates, FSC, SSC, chargeable weight~~ | ~~P0~~ |
| ~~DIM weight calculator~~ | ~~DONE — `max(actual, L×W×H/6000)` in `automations/dim_weight.py` + `dashboard/src/lib/dim-weight.ts`~~ | ~~P1~~ |
| ~~Dashboard mode selector~~ | ~~DONE — freight mode selector on RFQ form, mode-keyed constants (CARRIERS_BY_MODE, EQUIPMENT_BY_MODE, SERVICE_TYPES_BY_MODE), feature flags~~ | ~~P1~~ |
| ~~Air pricing engine~~ | ~~DONE — `calculate_air_price` (per-kg × chargeable wt + surcharges + margin) wired in phase_3; `get_air_rate_per_kg` weight-tier fallback from `air_charge_rates`; `calculateAirPrice` parity in `pricing-engine.ts`~~ | ~~P1~~ |
| ~~Analytics mode breakdown~~ | ~~DONE — `modeBreakdown` on `DashboardKPIs`, computed in `buildDashboardSummary()`; "RFQs by Freight Mode" dashboard widget (flag-gated)~~ | ~~P2~~ |
| ~~Air fixtures + extraction/classification eval~~ | ~~DONE — 52 air fixtures + 9 ocean/land decoys (`automations/tests/fixtures/phase1_air_prompt_eval_cases.txt`); LLM eval harness `eval_phase1_air_fixtures.py` (mode-detection ≥0.90 gate + air extraction gates); offline CI rules test `test_phase1_air_prompt_parsing_rules.py`~~ | ~~P1~~ |

**Phase 1 acceptance criteria:**
- ~~Mode detection correctly classifies 90%+ of 50 synthetic air RFQ email fixtures~~ **DONE** — 52 air fixtures + 9 ocean/land decoys; `eval_phase1_air_fixtures.py` measures mode-detection accuracy with a `>= 0.90` gate. Run: `OPENAI_API_KEY=... python3 automations/tests/eval_phase1_air_fixtures.py`.
- ~~Ocean extraction accuracy does not regress~~ **DONE** — `MODE_DETECTION_SYSTEM_PROMPT` refactor is non-behavioral (90 offline tests green); ocean eval (`eval_phase1_prompt_fixtures.py`) unchanged and decoy confusion breakdown tracks ocean→air leakage.
- ~~Manual RFQ creation supports ocean/air toggle with mode-appropriate fields~~ **DONE** (shipped earlier).
- ~~Air shipment pieces (with DIM weight calc) persist correctly to `rfq_shipment_pieces`~~ **DONE** (migration 018 + Phase 1 persistence).
- ~~Feature flag fully hides air mode from UI~~ **DONE** — `NEXT_PUBLIC_FEATURE_AIR_FREIGHT`.

### Phase 2: Air Freight API Integration (Weeks 11–18)

| Task | Details | Priority |
|------|---------|----------|
| Freightos Rate Estimator API | Integrate free-tier API for instant air rate estimates | P0 |
| CargoAi CargoCONNECT | Route/Schedule API + Track/Trace API with webhooks | P1 |
| AWB document automation | OCR extraction (Veryfi API) + e-AWB generation | P1 |
| Air carrier normalization | Master list of 50+ airlines with IATA codes | P1 |
| IATA ONE Record compliance | Design data model around virtual shipment record standard | P2 |

### Phase 3: Land Freight Foundation (Weeks 19–26) — **Complete**

| Task | Details | Priority |
|------|---------|----------|
| ~~Create land DB tables~~ | ~~DONE — migration 020: `truck_carrier_profiles`, `truck_lane_rates`, `ltl_freight_classes`, `drayage_rates`, `rfq_shipment_truck_details` (RLS, workspace-scoped)~~ | ~~P0~~ |
| ~~Extend Phase 1 for land RFQs~~ | ~~DONE — land system prompt extracts origin/dest ZIP, weight (kg/lbs), commodity, equipment type, load type, NMFC class, accessorials; `_build_truck_detail` persists to `rfq_shipment_truck_details`~~ | ~~P0~~ |
| ~~Extend Phase 2 for land quotes~~ | ~~DONE — land quote prompt parses per-mile/flat rate, fuel surcharge, accessorials, transit days~~ | ~~P0~~ |
| ~~FTL pricing engine~~ | ~~DONE — `calculate_ftl_price` (per-mile×distance or flat + fuel% + accessorials, min-charge floor, margin) in phase_3; `get_truck_lane_rate` lane lookup; `calculateFtlPrice` parity in `pricing-engine.ts`~~ | ~~P0~~ |
| ~~LTL pricing engine~~ | ~~DONE — `calculate_ltl_price` (class rate × weight/100 + fuel + accessorials) + `get_ltl_class_rate` NMFC lookup; `calculateLtlPrice` parity~~ | ~~P1~~ |
| ~~Dashboard land mode~~ | ~~DONE — new-RFQ FTL/LTL toggle, truck-type selector, weight-lbs/NMFC/ZIP inputs; `/pricing` Truckers + Lane Rates + LTL Classes tabs (flag-gated); shipment-card land Truck Details section~~ | ~~P1~~ |

**Phase 3 acceptance:** land mode detection + extraction covered by `eval_phase1_land_fixtures.py` (52 land fixtures + 9 ocean/air decoys, mode-detection ≥0.90 gate) and offline CI rules test `test_phase1_land_prompt_parsing_rules.py`. FTL/LTL pricing unit-tested in `pricing-engine.test.ts`; land pricing-table routes tested in `pricing-land-*.route.test.ts`. All gated behind `NEXT_PUBLIC_FEATURE_LAND_FREIGHT`.

### Phase 4: Land Freight API Integration (Weeks 27–34)

| Task | Details | Priority |
|------|---------|----------|
| DAT API integration | Rate intelligence, load board access, BookNow | P0 |
| SMC3 LTL API | Standard LTL rating, booking, tracking | P1 |
| Uber Freight / Loadsmart API | FTL instant quoting and booking | P1 |
| Detention/demurrage tracking | Automated D&D fee calculation and alerts | P2 |
| Cross-border module | VUCEM integration for Mexico, USMCA doc generation | P2 |

### Phase 5: Multimodal & Intermodal (Weeks 35–44)

| Task | Details | Priority |
|------|---------|----------|
| Unified rate aggregator | Single API gateway normalizing responses across all modes | P0 |
| project44 visibility integration | Multi-modal tracking (ocean + air + truck + rail) | P0 |
| Intermodal journey builder | Multi-leg shipment creation (ocean → drayage → rail → truck) | P1 |
| Rail API integration | BNSF + Union Pacific for intermodal routing | P1 |
| Multimodal RFQ parsing | Single email → auto-detect mode or parse multi-leg requests | P1 |

### Phase 6: Intelligence & Optimization (Weeks 45–58)

| Task | Details | Priority |
|------|---------|----------|
| Historical rate database | Time-series storage for all modes (TimescaleDB) | P0 |
| Xeneta + SONAR integration | Ocean/air benchmarks + trucking spot market data | P1 |
| Predictive pricing models | XGBoost/LightGBM per mode, trained on accumulated data | P1 |
| Mode comparison engine | Auto-recommend ocean vs air vs land based on cost/time/reliability | P2 |
| Carbon footprint tracking | CargoAi Cargo2ZERO API + mode-specific emission factors | P2 |

---

## Operational Requirements

### Feature Flags (implement in Phase 1)

```
FEATURE_AIR_FREIGHT_ENABLED=false    # per-workspace toggle
FEATURE_LAND_FREIGHT_ENABLED=false   # per-workspace toggle
```

Gradual rollout + instant killswitch per workspace. Gate mode selector UI + prompt branching behind these flags.

### Testing Strategy (per phase)

| Phase | Tests Required |
|-------|---------------|
| Phase 1 | Unit tests for DIM weight calc; synthetic air RFQ email fixtures (50+) for prompt regression; ocean extraction regression suite to ensure mode detection doesn't degrade accuracy; E2E test for mode selector on new RFQ form |
| Phase 2 | Integration tests for API response normalization; rate accuracy benchmarks vs manual quotes |
| Phase 3 | Unit tests for FTL per-mile + LTL class-based pricing; synthetic land RFQ fixtures (50+) |
| Phase 4 | API integration tests with sandbox endpoints; load tests for rate aggregator |
| Phase 5 | Multi-leg journey E2E tests; intermodal pricing accuracy tests |

### Rollback Plan

- Mode detection causes ocean regression → disable via feature flag, revert to hardcoded `freight_mode="ocean"`
- DB columns are additive (nullable) — no destructive migration risk
- Prompt versions tracked (e.g., `ocean_v1`, `air_v1`) with logging for A/B comparison and rollback

### Monitoring (Phase 2+)

- Mode-specific parse success rate (% of emails correctly classified per mode)
- Mode misclassification rate (air classified as ocean, etc.)
- Air/land quote extraction accuracy (% of fields correctly extracted)
- Per-mode conversion funnel KPIs

### Prompt Versioning

- Version all prompts: `ocean_extraction_v1`, `air_extraction_v1`, `mode_detection_v1`
- Log prompt version + model version + input/output for every extraction
- Reference ACTION_PLAN.md's planned "prompt-eval benchmark" expansion for regression testing

---

## Architectural Decisions

### 1. Design Rate Aggregator interface in Phase 1 (not Phase 5)

Define a normalized response schema now, even if only ocean populates it initially:
```typescript
interface NormalizedRate {
  carrier: string;
  origin: string;
  destination: string;
  price: number;
  currency: string;
  transit_time_days: number;
  valid_until: string;
  freight_mode: FreightMode;
  surcharges: { type: string; amount: number }[];
  source: 'agent_email' | 'api';
}
```
Retrofitting onto 3-4 different integrations later is 3-5x harder than designing upfront.

### 2. Dual-write strategy for new modes

New modes (air/land) should be **normalized-only from the start** — no legacy table writes. The dual-write pattern exists only for ocean backward compatibility during migration.

### 3. `ShipmentCost` interface refactoring

Rename ocean-specific fields in `dashboard/src/types/pricing.ts` to mode-generic names:
- `oceanFreightUSD` → `baseFreightUSD`
- `oceanFreightAED` → `baseFreightAED`
- `doDocument`/`doPerContainer`/`doTotal` → keep for ocean, add mode-specific cost line items via discriminated union or nullable fields

---

## Dashboard UX Gaps

These UI changes are missing from the phased roadmap and should be added:

| Missing Item | Phase | Priority | Details |
|-------------|-------|----------|---------|
| ~~RFQ detail page mode-awareness~~ | 1/3 | P1 | ~~DONE~~ — `shipment-card` renders air Pieces & Dimensions + chargeable weight and the land Truck Details section (load type, equipment, weight, NMFC class, ZIP lane, accessorials); detail route now loads pieces + truck details for air and land |
| ~~Pipeline filter by freight mode~~ | 1 | P1 | ~~DONE~~ — mode filter chips (Ocean/Air/Land, flag-gated) on the RFQ list |
| ~~Mode-specific icons on RFQ rows~~ | 1 | P1 | ~~DONE~~ — Ship/Plane/Truck `ModeIcon` on table rows + kanban cards |
| ~~Pricing tables page update~~ | 3 | P1 | ~~DONE~~ — `/pricing` has Airlines + Air Rates tabs and Truckers + Lane Rates + LTL Classes tabs (all flag-gated) |
| Agents page mode tagging | 1 | P2 | Tag agents by mode specialization; filter agents by mode on the agents page |
| Cross-mode quote comparison UI | 6 | P2 | Phase 6 mentions "Mode comparison engine" but provides no UI spec — add comparison table/chart design |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| LLM prompt accuracy degrades for ocean when adding mode detection | High | Medium | Ocean regression test suite (50+ fixtures); feature flags for instant rollback |
| Enterprise API sales cycles delay Phase 2/4 | Medium | High | Start sales conversations in Phase 1; use free-tier APIs first |
| Schema migration breaks existing queries | High | Low | Additive-only columns (nullable); no destructive changes; test with production data copy |
| Air/land prompt quality insufficient for production | High | Medium | Start with manual review of all air/land extractions; graduate to auto-processing at 90%+ accuracy |
| Intermodal complexity exceeds timeline | Medium | Medium | Phase 5 has 2-week buffer; intermodal is P1 not P0 — can defer |

---

## API Integration Priority

| Priority | API | Mode | Why This Order | Effort | Note |
|----------|-----|------|----------------|--------|------|
| 1 | Freightos Rate Estimator | Air+Ocean | Free tier, REST, covers 2 modes at once | Low | Provides **estimates** only, not bookable rates — useful for benchmarking, not direct quoting |
| 2 | DAT | Land (FTL) | Largest NA trucking marketplace, multi-carrier spot market access | Medium ($50–300/mo) | Swapped from #3 — higher impact than single-carrier FedEx |
| 3 | FedEx Freight LTL | Land (LTL) | Free developer portal, standard LTL API | Low | Single carrier — good for validation, limited for production coverage |
| 4 | Flexport | Air+Ocean+Truck | Public API (launched 2025), instant quoting across modes | Medium | **NEW** — notable omission from original plan |
| 5 | CargoAi CargoCONNECT | Air | 680+ airline schedules, requires IATA/CASS | High (enterprise) | **Start sales conversation in Phase 1** — 4-8 week contract cycle |
| 6 | SMC3 | Land (LTL) | Industry-standard LTL rating | High (enterprise) | **Start sales conversation in Phase 1** |
| 7 | project44 | All modes | Visibility layer, do last after rate APIs | High (enterprise) | — |

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
