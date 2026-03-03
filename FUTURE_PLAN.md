# FUTURE_PLAN.md — Multimodal Freight Expansion

> Expand Evo Logistics from ocean-only to **ocean + air + land (trucking/rail)** freight automation

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

## Current State — Ocean Freight Automation

| Component | Status | Key Details |
|-----------|--------|-------------|
| Phase 1: RFQ Ingestion | Live | Gmail Pub/Sub → GPT-4o extraction → `rfq_shipments` + `rfq_shipment_containers` |
| Phase 2: Quote Analysis | Live | Agent email replies → LLM parsing → `agent_quotes` with dedup |
| Phase 3: Quote Selection | Live | Dashboard selection → 13% margin → AED/USD pricing |
| Carriers | 11 | COSCO, EVERGREEN, MSC, ONE, MAERSK, HAPAG-LLOYD, CMA CGM, YANG MING, HMM, PIL, ZIM |
| Container types | 7 | 20FT, 40FT, 40HC, 40HQ, 20OT, 40OT, 45FT |
| Service types | 4 | port-to-port, door-to-port, port-to-door, door-to-door |
| Pricing tables | 3 | DO charges (per carrier/container), destination charges, transportation charges |
| Dashboard | Live | Next.js 16 + React 19 + Supabase + multi-tenant RLS |

**Key files for extension:**
- `automations/phase_1_request_analysis.py` — RFQ parsing template
- `automations/phase_2_quote_analysis.py` — Quote extraction template
- `dashboard/src/lib/pricing-engine.ts` — Pricing calculation logic
- `dashboard/supabase/migrations/` — Schema templates

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
  └── rfq_shipments (existing, add `freight_mode` column)
        ├── rfq_shipment_containers (ocean — existing)
        ├── rfq_shipment_pieces (air — new)
        └── rfq_shipment_truck_details (land — new)

agent_quotes (existing, add `freight_mode` column)
  ├── Ocean-specific: carrier (shipping line), container type, transit days
  ├── Air-specific: airline, chargeable weight, flight number
  └── Land-specific: truck carrier, equipment type, per-mile rate
```

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
| Add `freight_mode` to `rfq_shipments` + `agent_quotes` | `ENUM('ocean', 'air', 'land')` — backward-compatible, default `ocean` | P0 |
| Create air DB tables | `air_carrier_profiles`, `air_charge_rates`, `rfq_shipment_pieces` | P0 |
| Extend Phase 1 prompt | New GPT-4o system prompt for air RFQ extraction (airline, weight, dims, airport codes) | P0 |
| Extend Phase 2 prompt | Air quote parsing (per-kg rates, FSC, SSC, chargeable weight) | P0 |
| DIM weight calculator | `max(actual, L×W×H/6000)` utility in both Python + TypeScript | P1 |
| Dashboard mode selector | Toggle ocean/air on RFQ creation + display | P1 |
| Air pricing engine | Weight-tier based pricing with surcharge stacking | P1 |

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

### Air Freight
- [Freightos Developer Portal](https://developers.freightos.com)
- [Freightos Rate Estimator API](https://developers.freightos.com/docs/freightos---freight-estimator/1/overview)
- [WebCargo Air Cargo Rate Management](https://www.webcargo.co/air-cargo-rate-management-software/)
- [Freightos Ocean Expansion (Nov 2025)](https://www.prnewswire.com/il/news-releases/freightos-eliminates-modal-divide-302605382.html)
- [CargoAi CargoCONNECT](https://www.cargoai.co/products/cargoconnect/)
- [CargoAi API Docs](https://cargoai.readme.io/reference/introduction)
- [cargo.one Enterprise](https://www.cargo.one/enterprise)
- [cargo.one AI Quoting (Oct 2025)](https://www.cargo.one/press/ai-powered-quoting)
- [cargo.one Multimodal OS (Mar 2026)](https://www.aircargonews.net/technology/2026/03/cargo-one-launches-multimodal-ai-native-operating-system/)
- [IATA ONE Record](https://www.iata.org/en/iata-repository/pressroom/fact-sheets/fact-sheet-one-record/)
- [Air Freight Market — Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/global-air-freight-market)
- [Veryfi AWB OCR API](https://www.veryfi.com/airway-bill-awb-ocr-api/)

### Land Freight
- [DAT API Integration](https://www.dat.com/api-integration)
- [project44 AI Freight Agent (Mar 2026)](https://www.freightwaves.com/news/project44-launches-ai-agent-to-automate-freight-procurement-cut-costs)
- [Uber Freight API](https://www.uberfreight.com/en-US/blog/uber-freight-api-benefits)
- [SMC3 LTL APIs](https://www.smc3.com/ltl-api.htm)
- [FedEx Freight LTL API](https://developer.fedex.com/api/en-us/catalog/ltl-freight.html)
- [Greenscreens.ai / Triumph](https://triumph.io/solutions/rates/)
- [Turvo + SMC3 LTL Partnership](https://turvo.com/news/turvo-and-smc3-partner-ltl-freight-management/)
- [BNSF API Center](https://www.bnsf.com/ship-with-bnsf/support-services/customer-api/)
- [Union Pacific API Developer](https://www.up.com/shipping/resources/api-developer)
- [Railinc API Portal](https://public.railinc.com/developers)
- [Digital Freight Trucking Market — Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/digital-freight-trucking-market)
- [US Trucking Market — GM Insights](https://www.gminsights.com/industry-analysis/freight-trucking-market)
- [FreightWaves SONAR](https://gosonar.com/)
- [Digital LTL Council API Standard](https://www.truckinginfo.com/news/new-ltl-api-standard-offers-freight-charge-visibility)
- [Scheduling Standards Consortium](https://www.truckinginfo.com/news/consortium-publishes-api-freight-scheduling-standards)
- [Windward D&D Automation](https://www.prnewswire.com/news-releases/windward-launches-detention--demurrage-automation-solution-302385814.html)

### Multimodal / General
- [project44 LTL Updates](https://www.project44.com/blog/project44s-ltl-updates-announcements-carrier-spotlights-and-new-apis-in-2024/)
- [OneRail Last Mile](https://www.onerail.com/)
- [Locus Dispatch Management](https://locus.sh/)
- [Rail-Flow Digital Platform](https://www.rail-flow.com/en/)
- [research_data.md](research_data.md) — internal research document
