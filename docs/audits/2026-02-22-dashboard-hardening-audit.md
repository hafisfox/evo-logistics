# Dashboard Hardening Audit

Date: 2026-02-22
Scope: `dashboard/`
Auditor: Codex

## Methodology

The audit combined static inspection and command-based verification:

1. Reviewed application architecture, routes, hooks, API handlers, auth/session logic, and shared UI components.
2. Ran baseline quality commands.
3. Collected line-specific findings with severity and proposed remediations.

## Baseline Commands

### Lint

Command:

```bash
cd dashboard && npm run lint
```

Result summary:

- 4 errors
- 3 warnings

Key output excerpts:

- `dashboard/src/app/settings/page.tsx:23` `react-hooks/set-state-in-effect` (error)
- `dashboard/src/types/google.d.ts:4` `no-explicit-any` (error)
- `dashboard/src/types/google.d.ts:5` `no-explicit-any` (error)
- `dashboard/src/types/google.d.ts:8` `no-explicit-any` (error)
- `dashboard/src/app/auth/callback/route.ts:5` unused `origin` (warning)
- `dashboard/src/app/login/page.tsx:70` unused `error` (warning)
- `dashboard/src/lib/supabase/middleware.ts:18` unused `options` (warning)

### Typecheck

Command:

```bash
cd dashboard && npx tsc --noEmit
```

Result summary:

- Exit code 0

### Build

Command:

```bash
cd dashboard && npm run build
```

Result summary:

- Fails in restricted/no-egress environment due `next/font/google` fetching Inter and Inter Tight.
- Warns that middleware convention is deprecated and `proxy` should be used.

## Findings (Severity Ordered)

### High

1. Lint-blocking React anti-pattern in settings state sync
- File: `dashboard/src/app/settings/page.tsx:21`
- Issue: Synchronous state updates inside `useEffect` trigger cascading render risk.
- Impact: React best-practice violation and lint failure.
- Planned remediation: move to derived draft-state pattern without setState-in-effect.

2. Untyped request bodies in mutable API routes
- Files:
  - `dashboard/src/app/api/settings/route.ts:10`
  - `dashboard/src/app/api/rfqs/[rfqId]/select/route.ts:13`
  - `dashboard/src/app/api/pricing/calculate/route.ts:11`
- Issue: Route handlers trust arbitrary JSON shape.
- Impact: runtime errors, undefined behavior, weak API contract.
- Planned remediation: centralized validation and structured `400` errors.

3. Auth middleware convention deprecation
- File: `dashboard/src/middleware.ts:4`
- Issue: Next.js 16 deprecates `middleware` file convention in favor of `proxy`.
- Impact: forward-compatibility risk and warning noise.
- Planned remediation: migrate to `src/proxy.ts` and preserve matcher/behavior.

### Medium

4. API unauthenticated behavior uses redirect-style flow
- File: `dashboard/src/lib/supabase/middleware.ts:35`
- Issue: unauthenticated handling is page-first; APIs are not explicitly JSON `401`.
- Impact: API consumers can receive non-API style auth responses.
- Planned remediation: return JSON `401` for `/api/*` while preserving page redirects.

5. Broad `any` typing in Supabase and Google ambient types
- Files:
  - `dashboard/src/types/google.d.ts:4`
  - `dashboard/src/types/supabase.ts:12`
  - `dashboard/src/lib/settings.ts:54`
- Issue: explicit `any` masks type errors and weakens editor/compiler guarantees.
- Impact: reduced reliability and maintainability.
- Planned remediation: concrete type interfaces and explicit table map.

6. Non-deterministic build dependency on Google Fonts
- File: `dashboard/src/app/layout.tsx:2`
- Issue: external fetch at build-time.
- Impact: build instability in offline/restricted environments.
- Planned remediation: local/system font stack while preserving current look.

7. Accessibility gaps in interactive controls
- Files:
  - `dashboard/src/components/selection/quote-card.tsx:22`
  - `dashboard/src/components/rfqs/rfq-table.tsx:83`
  - `dashboard/src/components/layout/header.tsx:26`
- Issue: clickable card relies on non-semantic interaction; icon-only buttons/links lack explicit accessible names.
- Impact: keyboard and screen-reader usability degradation.
- Planned remediation: explicit button semantics, labels, and ARIA names.

### Low

8. Analytics endpoint computes quote counts with repeated filtering
- File: `dashboard/src/app/api/analytics/route.ts:28`
- Issue: O(n^2)-like repeated scans for each RFQ.
- Impact: unnecessary CPU overhead as dataset grows.
- Planned remediation: precomputed quote-count map for O(n) aggregation.

9. External webhook call has no timeout/abort guard
- File: `dashboard/src/lib/modal-client.ts:22`
- Issue: fetch may hang until platform timeout.
- Impact: poor resilience and request starvation risk.
- Planned remediation: `AbortController` with configurable timeout and typed timeout errors.

10. No project tests under `dashboard/src`
- Issue: no in-repo unit/integration/component regression suite.
- Impact: low confidence for refactors and hardening changes.
- Planned remediation: add Vitest + RTL + Playwright smoke + CI workflow.

## Target Remediation Map

- Framework/auth: proxy migration + API auth response hardening.
- Type/lint: eliminate all current lint errors/warnings and explicit unsafe casts.
- Reliability: request validation with consistent error contract.
- Accessibility: semantic interaction and icon control labels.
- Performance: analytics aggregation optimization.
- Robustness: webhook timeout/abort behavior.
- Testability: unit/integration/component/e2e coverage and CI quality gates.

## Success Criteria

1. `cd dashboard && npm run lint` passes with zero errors/warnings.
2. `cd dashboard && npx tsc --noEmit` passes.
3. `cd dashboard && npm run test` passes.
4. `cd dashboard && npm run test:e2e` passes.
5. `cd dashboard && npm run build` passes without remote font fetch failures.
