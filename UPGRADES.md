# UPGRADES.md
Updated: February 23, 2026

## Title
Freight Scope Interpreter Upgrade Roadmap (Non-Breaking, Dashboard-Compatible)

## Summary
This document defines how to evolve the current Evo Logistics system into a full Freight Scope Interpreter aligned with the provided target logic, without breaking existing automations, pricing, or dashboard workflows.

The rollout priority is:

1. Freight Scope Interpreter first.
2. Dashboard read-only scope insights first.
3. Enquiry-category classifier deferred to a later track.

---

## Current Objective Alignment
Current product objective (`ACTION_PLAN.md`) is already strongly aligned with workspace-scoped logistics operations:

- Multi-tenant workspace model is implemented.
- Gmail OAuth mailbox per workspace is implemented.
- Phase 1/2/3 automations are workspace-isolated and operational.
- RFQ + pricing normalization is deployed with compatibility views.
- Dashboard API and UI consume normalized data safely.

---

## Verified Baseline (Before Future Upgrades)

### Automation tests
- Command: `python3 -m pytest automations/tests -q`
- Result: `45 passed`

### Dashboard tests
- Command: `cd dashboard && npm run test`
- Result: `75 passed, 2 failed`
- Failures are test-mock drift caused by new audit `.insert()` calls, not core runtime logic regressions:
  - `dashboard/src/app/api/__tests__/workspaces-current-mailbox-oauth-callback.route.test.ts`
  - `dashboard/src/app/api/__tests__/workspaces-current-mailbox-disconnect.route.test.ts`

---

## Gap Analysis vs Target Logic

## 1) Freight Scope Interpreter flow
Status: partially implemented.

### Already covered
- Shipment type inference (via `service_type`):
  - `port-to-port`, `door-to-port`, `port-to-door`, `door-to-door`
- Container normalization and multi-shipment grouping.
- Route extraction with controlled destination mapping in Phase 1 prompt.
- Missing information handling through RFQ statuses (`Missing_Port_Data`, `Missing_Door_Data`, `Parse_Error`).
- Workspace-safe persistence and downstream pricing selection flow.

### Missing or incomplete
- Explicit persisted fields:
  - `originScope`
  - `destinationScope`
  - `transportIncluded`
  - `pricingStructureTrigger`
  - `incotermResponsibility`
  - `deliveryOrderCharges`
  - `destinationCharges` (interpreter output object)
  - `specialHandlingFlags`
  - `estimatedDeliveryDateInfo`
  - `ambiguityFlags` array
  - `confidenceScore`
- Full incoterm matrix behavior (FOB/CIF/EXW/DDP as structured outputs).
- Explicit special handling flags for `DG`, `Reefer`, `OOG`, `Heavy Cargo`.
- Deterministic ambiguity-count to confidence scoring pipeline.

## 2) Shipping enquiry category classifier flow
Status: not implemented as requested taxonomy.

### Current
- Email classifier exists for workflow routing:
  - `customer_rfq`, `agent_rate_reply`, `customer_followup`, etc.

### Missing
- Requested categories:
  - Delivery Status, Shipping Cost, Delivery Timeframe, Lost Package, Damaged Package, Address Change, Other Shipping Issue
- Confidence score tied to that taxonomy.

---

## Design Principles for Future Work (Non-Breaking)
1. Additive schema only in first release.
2. No behavior change to current Phase 1 routing actions in v1.
3. Feature-flag all new logic.
4. Shadow-mode first, active-mode later.
5. Keep existing dashboard routes and payload contracts backward-compatible.
6. Workspace isolation and RLS parity are mandatory for every new table.

---

## Future Implementation Plan (Step-by-Step)

## Phase 0: Stabilize baseline
1. Fix the two dashboard test mocks to support `audit_events` `.insert()`.
2. Re-run:
- `python3 -m pytest automations/tests -q`
- `cd dashboard && npm run test`
3. Capture baseline in this document.

## Phase 1: Canonicalize interpreter spec
1. Convert pseudocode into deterministic executable spec.
2. Resolve undefined values in pseudocode (`base_score`, `ambiguity_count`, defaults).
3. Lock enum/value mappings for all new interpreter outputs.

## Phase 2: Add schema for interpreted scope
1. Add migration: `dashboard/supabase/migrations/20260223_015_rfq_scope_interpreter.sql`.
2. Create table `rfq_scope_interpretations` with key `(workspace_id, rfq_id)`.
3. Include columns:
- `shipment_type`
- `origin_scope`
- `destination_scope`
- `transport_included`
- `port_of_discharge_out`
- `pricing_structure_trigger`
- `incoterm_responsibility` (jsonb)
- `container_requirements` (jsonb)
- `delivery_order_charges` (jsonb)
- `destination_charges` (jsonb)
- `special_handling_flags` (text[])
- `estimated_delivery_date_info` (jsonb)
- `ambiguity_flags` (text[])
- `confidence_score` (`numeric` with `0..1` check)
- `interpreter_version`
- timestamps
4. Add RLS policies mirroring current workspace role model.

## Phase 3: Implement interpreter module (automation layer)
1. Add file: `automations/freight_scope_interpreter.py`.
2. Implement deterministic post-extraction interpreter from Phase 1 normalized shipment payload.
3. Add rule blocks:
- Shipment/scope derivation
- Incoterm responsibility and pricing trigger
- POD defaulting/override logic
- Container normalization output
- Special handling flags
- Ambiguity flags + confidence scoring
4. Keep existing `master_rfqs` status logic untouched.

## Phase 4: Wire interpreter into Phase 1 safely
1. Integrate interpreter call in `automations/phase_1_request_analysis.py` after shipment validation.
2. Persist output into `rfq_scope_interpretations`.
3. Guard with env flags:
- `RFQ_SCOPE_INTERPRETER_ENABLED=false` (default)
- `RFQ_SCOPE_WRITE_MODE=shadow|active`
4. In `shadow`, do write-only observation with no downstream behavior change.

## Phase 5: Dashboard read-only incorporation
1. Extend RFQ detail API:
- `dashboard/src/app/api/rfqs/[rfqId]/route.ts`
- Add optional `scope` payload.
2. Add types:
- `dashboard/src/types/rfq.ts` for scope interpretation object.
3. Add UI component:
- `dashboard/src/components/rfq-detail/scope-insights-card.tsx`
4. Render on detail page:
- `dashboard/src/app/rfqs/[rfqId]/page.tsx`
5. Keep read-only in v1 (no user edits).

## Phase 6: Operational validation
1. Compare current business outcomes vs interpreter outputs in shadow mode.
2. Track:
- Coverage rate
- Ambiguity rate
- Confidence distribution
- Null field frequency
3. Promote to active only after thresholds are met.

## Phase 7: Deferred classifier track
1. Build separate enquiry-category classifier module and storage.
2. Keep isolated from RFQ critical path.
3. Add only after Freight Scope Interpreter is stable in production.

---

## Public Interface Changes (Planned)
Additive only.

### Database
- New table: `rfq_scope_interpretations`
- No breaking changes to:
  - `master_rfqs`
  - `agent_outbound_log`
  - `rfq_shipments`
  - `agent_quotes`
  - pricing legacy/compat views

### API
- `GET /api/rfqs/[rfqId]` returns `{ rfq, quotes, scope? }` (optional field).
- No required payload changes to existing mutate endpoints in v1.

### UI
- New read-only scope card on RFQ detail page.
- No workflow changes for select/quote actions in v1.

---

## Test Plan

## Automation tests
1. Unit tests for each interpreter rule branch.
2. Phase 1 integration tests to confirm unchanged routing actions.
3. Tenant-scoping tests for scope table writes.

## Dashboard tests
1. RFQ detail route tests for optional `scope`.
2. Component tests for scope-insights rendering.
3. Existing tests remain green after mock updates.

## Acceptance checks
1. `python3 -m pytest automations/tests -q` passes.
2. `cd dashboard && npm run test` passes.
3. No regression in existing prompt fixture behavior for Phase 1/2.
4. RLS isolation verified for all scope rows.

---

## Rollout Plan
1. Deploy migration first.
2. Deploy interpreter in `shadow` mode.
3. Observe metrics for a full operational cycle.
4. Enable `active` for one workspace.
5. Expand workspace-by-workspace.
6. Rollback path: set `RFQ_SCOPE_INTERPRETER_ENABLED=false`.

---

## Risks and Mitigations
1. Risk: extraction behavior drift.
- Mitigation: interpreter as post-processor, no change to current routing actions initially.

2. Risk: schema/API contract breakage.
- Mitigation: additive optional fields only.

3. Risk: tenant leakage.
- Mitigation: workspace PK + strict RLS + scoped writes.

4. Risk: operator confusion in UI.
- Mitigation: read-only first; no decision-path coupling in initial release.

---

## Definition of Done (for Freight Scope Interpreter v1)
1. Scope outputs persist per RFQ in workspace-safe table.
2. Dashboard shows scope insights read-only on RFQ detail.
3. Existing quote and pricing workflow remains behaviorally unchanged.
4. Full test suite green.
5. Shadow metrics reviewed and accepted before active rollout.

---

## Immediate Next Action (future implementation start)
1. Fix the two dashboard mailbox route test mocks to reestablish full green baseline.
2. Start Phase 1 spec normalization and finalize interpreter field contracts.
3. Create migration `20260223_015_rfq_scope_interpreter.sql` and begin shadow write integration.
