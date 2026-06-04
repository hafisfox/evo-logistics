"""Uber Freight + Loadsmart — FTL instant quoting (P1).

Two providers with near-identical roles but distinct response shapes, so each
has its own ``_normalize``. Live calls require the respective API key and
``FREIGHT_API_MODE=live``.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List

from . import mocks
from .base import NormalizedRate, RateProvider, RateRequest

UBER_FREIGHT_BASE_URL = os.environ.get(
    "UBER_FREIGHT_API_BASE_URL", "https://api.uberfreight.com"
)
LOADSMART_BASE_URL = os.environ.get("LOADSMART_API_BASE_URL", "https://api.loadsmart.com")


class UberFreightProvider(RateProvider):
    name = "uber_freight"
    env_keys = ("UBER_FREIGHT_API_KEY",)
    supported_modes = ("land",)

    def _fetch_live(self, req: RateRequest) -> List[Dict[str, Any]]:
        import requests  # lazy: only needed in live mode

        # NOTE: validate endpoint/payload against Uber Freight API docs on provisioning.
        resp = requests.post(
            f"{UBER_FREIGHT_BASE_URL}/v1/quotes",
            headers={"Authorization": f"Bearer {os.environ['UBER_FREIGHT_API_KEY']}"},
            json={
                "origin": req.origin,
                "destination": req.destination,
                "equipment": req.equipment_type or "DRY_VAN",
                "pickupDate": req.pickup_date,
            },
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("quotes") or [data]

    def _mock_payloads(self, req: RateRequest) -> List[Dict[str, Any]]:
        return mocks.uber_freight_payloads(req)

    def _normalize(self, payload: Dict[str, Any], req: RateRequest) -> NormalizedRate:
        total = payload.get("totalPrice") or {}
        items = payload.get("lineItems") or []
        surcharges = [
            {"type": i.get("category", "OTHER"), "amount": round(float(i.get("amount") or 0.0), 2)}
            for i in items
            if (i.get("category") or "").upper() != "LINEHAUL"
        ]
        return NormalizedRate(
            carrier=payload.get("carrier") or "Uber Freight",
            origin=req.origin,
            destination=req.destination,
            price=round(float(total.get("amount") or 0.0), 2),
            currency=total.get("currency", "USD"),
            transit_time_days=payload.get("estimatedTransitDays"),
            valid_until=payload.get("expiresAt"),
            freight_mode="land",
            surcharges=surcharges,
            source="api",
            provider=self.name,
            equipment_type=payload.get("equipment") or req.equipment_type,
            raw=payload,
        )


class LoadsmartProvider(RateProvider):
    name = "loadsmart"
    env_keys = ("LOADSMART_API_KEY",)
    supported_modes = ("land",)

    def _fetch_live(self, req: RateRequest) -> List[Dict[str, Any]]:
        import requests  # lazy: only needed in live mode

        # NOTE: validate endpoint/payload against Loadsmart API docs on provisioning.
        resp = requests.post(
            f"{LOADSMART_BASE_URL}/quoting/v1/quotes",
            headers={"Authorization": f"Token {os.environ['LOADSMART_API_KEY']}"},
            json={
                "origin_zip": req.origin,
                "destination_zip": req.destination,
                "equipment_type": req.equipment_type or "VAN",
            },
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("results") or [data]

    def _mock_payloads(self, req: RateRequest) -> List[Dict[str, Any]]:
        return mocks.loadsmart_payloads(req)

    def _normalize(self, payload: Dict[str, Any], req: RateRequest) -> NormalizedRate:
        load = payload.get("load") or {}
        accessorials = payload.get("accessorials") or []
        surcharges = [
            {"type": a.get("name", "OTHER"), "amount": round(float(a.get("amount") or 0.0), 2)}
            for a in accessorials
        ]
        return NormalizedRate(
            carrier=payload.get("carrier") or "Loadsmart",
            origin=load.get("origin_zip") or req.origin,
            destination=load.get("destination_zip") or req.destination,
            price=round(float(payload.get("price") or 0.0), 2),
            currency=payload.get("currency", "USD"),
            transit_time_days=payload.get("transit_time_days"),
            valid_until=payload.get("valid_until"),
            freight_mode="land",
            surcharges=surcharges,
            source="api",
            provider=self.name,
            equipment_type=load.get("equipment_type") or req.equipment_type,
            raw=payload,
        )
