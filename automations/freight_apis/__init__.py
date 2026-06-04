"""External freight-rate API integration (Phase 4 — Land Freight API Integration).

This package provides a single normalized rate schema (:class:`NormalizedRate`)
and a provider abstraction (:class:`RateProvider`) so that DAT, SMC3,
Uber Freight / Loadsmart, etc. can all be queried through one interface and
their responses merged into one shape.

Providers run in **mock mode by default** — no credentials required. To enable
real HTTP calls, set ``FREIGHT_API_MODE=live`` *and* the per-provider
credentials (see ``automations/.env.example``). Without both, every provider
falls back to deterministic synthetic responses so the full pipeline is
exercisable and testable offline.

Defining this aggregator interface now (rather than in the Phase 5 unified
aggregator) is a deliberate architectural choice — see FUTURE_PLAN.md
"Design Rate Aggregator interface in Phase 1 (not Phase 5)".
"""

from .base import (
    NormalizedRate,
    RateRequest,
    RateProvider,
    aggregate_land_rates,
    get_freight_api_mode,
    get_land_providers,
)

__all__ = [
    "NormalizedRate",
    "RateRequest",
    "RateProvider",
    "aggregate_land_rates",
    "get_freight_api_mode",
    "get_land_providers",
]
