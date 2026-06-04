"""SMC3 — LTL class-based rating (P1).

Industry-standard LTL rating by NMFC class + weight. Live calls require
``SMC3_USERNAME`` + ``SMC3_PASSWORD`` and ``FREIGHT_API_MODE=live``.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List

from . import mocks
from .base import NormalizedRate, RateProvider, RateRequest

SMC3_BASE_URL = os.environ.get("SMC3_API_BASE_URL", "https://ws.smc3.com")


class SMC3Provider(RateProvider):
    name = "smc3"
    env_keys = ("SMC3_USERNAME", "SMC3_PASSWORD")
    supported_modes = ("land",)

    def _fetch_live(self, req: RateRequest) -> List[Dict[str, Any]]:
        import requests  # lazy: only needed in live mode
        from requests.auth import HTTPBasicAuth

        # NOTE: RateWareXL endpoint/payload shape must be validated against
        # SMC3's official docs when credentials are provisioned.
        resp = requests.post(
            f"{SMC3_BASE_URL}/RateWareXLv3/RateShipment",
            auth=HTTPBasicAuth(os.environ["SMC3_USERNAME"], os.environ["SMC3_PASSWORD"]),
            json={
                "originPostalCode": req.origin,
                "destinationPostalCode": req.destination,
                "details": [
                    {"nmfcClass": req.nmfc_class or "70", "weight": req.weight_lbs or 0}
                ],
            },
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        return data if isinstance(data, list) else [data]

    def _mock_payloads(self, req: RateRequest) -> List[Dict[str, Any]]:
        return mocks.smc3_payloads(req)

    def _normalize(self, payload: Dict[str, Any], req: RateRequest) -> NormalizedRate:
        details = payload.get("details") or {}
        charges = payload.get("charges") or []
        total = payload.get("totalChargeUsd")
        if total is None:
            total = sum(float(c.get("amountUsd") or 0.0) for c in charges)
        surcharges = [
            {"type": c.get("type", "OTHER"), "amount": round(float(c.get("amountUsd") or 0.0), 2)}
            for c in charges
            if (c.get("type") or "").upper() != "LINEHAUL"
        ]
        return NormalizedRate(
            carrier=payload.get("scac") or "SMC3 LTL",
            origin=details.get("originPostalCode") or req.origin,
            destination=details.get("destinationPostalCode") or req.destination,
            price=round(float(total or 0.0), 2),
            currency=payload.get("currency", "USD"),
            transit_time_days=details.get("transitDays"),
            valid_until=payload.get("expirationDate"),
            freight_mode="land",
            surcharges=surcharges,
            source="api",
            provider=self.name,
            equipment_type="LTL",
            raw=payload,
        )
