"""DAT — FTL spot-market rate intelligence (P0).

DAT is the largest North American trucking marketplace. This provider returns
lane rate intelligence (per-mile + per-trip + fuel). Live calls require
``DAT_API_KEY`` and ``FREIGHT_API_MODE=live``; otherwise mock payloads are used.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List

from . import mocks
from .base import NormalizedRate, RateProvider, RateRequest

DAT_BASE_URL = os.environ.get("DAT_API_BASE_URL", "https://analytics.api.dat.com")


class DATProvider(RateProvider):
    name = "dat"
    env_keys = ("DAT_API_KEY",)
    supported_modes = ("land",)

    def _fetch_live(self, req: RateRequest) -> List[Dict[str, Any]]:
        import requests  # lazy: only needed in live mode

        # NOTE: endpoint path/params/auth must be validated against DAT's
        # official Rate Intelligence API docs when credentials are provisioned.
        resp = requests.post(
            f"{DAT_BASE_URL}/rateview/v3/lookup",
            headers={
                "Authorization": f"Bearer {os.environ['DAT_API_KEY']}",
                "Accept": "application/json",
            },
            json={
                "origin": req.origin,
                "destination": req.destination,
                "equipmentType": req.equipment_type or "VAN",
            },
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("rateResponses") or data.get("results") or []

    def _mock_payloads(self, req: RateRequest) -> List[Dict[str, Any]]:
        return mocks.dat_payloads(req)

    def _normalize(self, payload: Dict[str, Any], req: RateRequest) -> NormalizedRate:
        r = payload.get("rateResponse") or payload
        rate = r.get("rate") or {}
        per_trip = (rate.get("perTrip") or {}).get("amount") or 0.0
        fuel = float(r.get("averageFuelSurchargeUsd") or 0.0)
        return NormalizedRate(
            carrier=r.get("carrier") or "DAT Spot Market",
            origin=r.get("originCity") or req.origin,
            destination=r.get("destinationCity") or req.destination,
            price=round(float(per_trip) + fuel, 2),
            currency=(rate.get("perTrip") or {}).get("currency", "USD"),
            transit_time_days=r.get("estimatedTransitDays"),
            valid_until=r.get("validUntil"),
            freight_mode="land",
            surcharges=[{"type": "FUEL", "amount": round(fuel, 2)}] if fuel else [],
            source="api",
            provider=self.name,
            equipment_type=r.get("equipmentType") or req.equipment_type,
            raw=payload,
        )
