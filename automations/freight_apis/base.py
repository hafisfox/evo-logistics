"""Normalized rate schema + provider abstraction for external freight APIs.

All providers normalize their responses into :class:`NormalizedRate`, matching
the schema described in FUTURE_PLAN.md. A provider returns rates either from a
live HTTP call (only when ``FREIGHT_API_MODE=live`` AND its credentials are
present) or from deterministic mock payloads (the default).
"""

from __future__ import annotations

import os
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional


def get_freight_api_mode() -> str:
    """Return the global freight-API mode: ``"live"`` or ``"mock"`` (default).

    Read dynamically (not cached at import) so tests and runtime config changes
    take effect without re-importing the module.
    """
    return (os.environ.get("FREIGHT_API_MODE") or "mock").strip().lower()


@dataclass
class RateRequest:
    """A lane/shipment to price across providers.

    ``origin``/``destination`` are ZIP codes for US domestic land freight, or
    city/airport/port identifiers for other modes.
    """

    origin: str
    destination: str
    freight_mode: str = "land"
    equipment_type: Optional[str] = None  # e.g. "VAN", "REEFER", "FLATBED"
    load_type: Optional[str] = None  # "FTL" | "LTL"
    weight_lbs: Optional[float] = None
    nmfc_class: Optional[str] = None  # LTL freight class, e.g. "70"
    pickup_date: Optional[str] = None  # ISO date

    def normalized(self) -> "RateRequest":
        """Return a copy with whitespace-trimmed, upper-cased lane fields."""
        return RateRequest(
            origin=(self.origin or "").strip().upper(),
            destination=(self.destination or "").strip().upper(),
            freight_mode=(self.freight_mode or "land").strip().lower(),
            equipment_type=(self.equipment_type or "").strip().upper() or None,
            load_type=(self.load_type or "").strip().upper() or None,
            weight_lbs=self.weight_lbs,
            nmfc_class=(str(self.nmfc_class).strip() if self.nmfc_class is not None else None) or None,
            pickup_date=self.pickup_date,
        )


@dataclass
class NormalizedRate:
    """One rate quote, normalized across providers.

    Mirrors the ``NormalizedRate`` TS interface in dashboard/src/types/pricing.ts
    and the ``external_rate_quotes`` table columns.
    """

    carrier: str
    origin: str
    destination: str
    price: float
    currency: str = "USD"
    transit_time_days: Optional[int] = None
    valid_until: Optional[str] = None  # ISO date
    freight_mode: str = "land"
    surcharges: List[Dict[str, Any]] = field(default_factory=list)  # [{"type","amount"}]
    source: str = "api"  # "agent_email" | "api"
    provider: str = ""
    equipment_type: Optional[str] = None
    raw: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """JSON-serializable dict (used in the Modal endpoint response)."""
        return asdict(self)

    def to_row(self, *, workspace_id: str, rfq_id: Optional[str] = None) -> Dict[str, Any]:
        """Map to an ``external_rate_quotes`` table row (snake_case columns)."""
        return {
            "workspace_id": workspace_id,
            "rfq_id": rfq_id,
            "provider": self.provider,
            "freight_mode": self.freight_mode,
            "carrier": self.carrier,
            "origin": self.origin,
            "destination": self.destination,
            "equipment_type": self.equipment_type,
            "price_usd": round(float(self.price), 2),
            "currency": self.currency,
            "transit_time_days": self.transit_time_days,
            "valid_until": self.valid_until,
            "surcharges": self.surcharges,
            "source": self.source,
            "raw": self.raw,
        }


class RateProvider(ABC):
    """Base class for an external rate provider.

    Subclasses implement three hooks:
      * ``_fetch_live(req)``   -> list of raw provider payloads via HTTP
      * ``_mock_payloads(req)`` -> list of raw payloads shaped like the API
      * ``_normalize(payload, req)`` -> :class:`NormalizedRate`

    ``fetch`` selects live vs mock, normalizes, and never raises — a failing
    provider yields ``[]`` so the aggregator stays resilient.
    """

    name: str = "base"
    #: env var names that must all be set for the provider to run in live mode
    env_keys: tuple = ()
    #: which freight modes this provider can price
    supported_modes: tuple = ("land",)

    # -- configuration / mode -------------------------------------------------
    def is_configured(self) -> bool:
        """True when every required credential env var is present and non-empty."""
        return bool(self.env_keys) and all(os.environ.get(k) for k in self.env_keys)

    def mode(self) -> str:
        """Effective mode for this provider: ``"live"`` only when globally live
        *and* credentials are configured; otherwise ``"mock"``."""
        if get_freight_api_mode() == "live" and self.is_configured():
            return "live"
        return "mock"

    def supports(self, req: RateRequest) -> bool:
        return (req.freight_mode or "land").lower() in self.supported_modes

    # -- public API -----------------------------------------------------------
    def fetch(self, req: RateRequest) -> List[NormalizedRate]:
        """Return normalized rates for ``req``; ``[]`` on any error or no support."""
        req = req.normalized()
        if not self.supports(req):
            return []
        try:
            payloads = self._fetch_live(req) if self.mode() == "live" else self._mock_payloads(req)
            rates: List[NormalizedRate] = []
            for payload in payloads or []:
                try:
                    rates.append(self._normalize(payload, req))
                except Exception as exc:  # one bad row shouldn't drop the rest
                    print(f"[freight_apis] {self.name}: normalize failed: {exc}")
            return rates
        except Exception as exc:
            print(f"[freight_apis] {self.name}: fetch failed ({self.mode()} mode): {exc}")
            return []

    # -- hooks (implemented by subclasses) ------------------------------------
    @abstractmethod
    def _fetch_live(self, req: RateRequest) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def _mock_payloads(self, req: RateRequest) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def _normalize(self, payload: Dict[str, Any], req: RateRequest) -> NormalizedRate:
        ...


def get_land_providers() -> List[RateProvider]:
    """Instantiate the land-freight providers. Imported lazily to avoid cycles."""
    from .dat import DATProvider
    from .smc3 import SMC3Provider
    from .uber_freight import LoadsmartProvider, UberFreightProvider

    return [DATProvider(), SMC3Provider(), UberFreightProvider(), LoadsmartProvider()]


def aggregate_land_rates(
    req: RateRequest,
    providers: Optional[List[RateProvider]] = None,
) -> List[NormalizedRate]:
    """Query all land providers and merge results, cheapest first.

    Resilient to individual provider failures (each returns ``[]`` on error).
    """
    providers = providers if providers is not None else get_land_providers()
    rates: List[NormalizedRate] = []
    for provider in providers:
        rates.extend(provider.fetch(req))
    rates.sort(key=lambda r: (r.price if r.price is not None else float("inf")))
    return rates
