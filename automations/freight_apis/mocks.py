"""Deterministic synthetic payloads for each provider's mock mode.

Each function returns raw dicts shaped like the corresponding *real* API
response, so the provider's ``_normalize`` logic is exercised identically in
mock and live modes. Pricing is derived deterministically from the lane so the
same request yields stable, plausible numbers (useful for tests and demos).
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List

# Import type only for hints; avoid a hard runtime cycle.
from .base import RateRequest


def _pseudo_miles(req: RateRequest) -> int:
    """Stable, plausible mileage derived from the origin/destination strings.

    Not geographically accurate — just deterministic and lane-dependent so mock
    rates differ per lane and are reproducible.
    """
    seed = sum(ord(c) for c in (req.origin + req.destination)) if (req.origin or req.destination) else 0
    return 250 + (seed % 1800)  # 250–2049 miles


def _valid_until(days: int = 7) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


def _weight_lbs(req: RateRequest, default: float) -> float:
    return float(req.weight_lbs) if req.weight_lbs else default


# ---------------------------------------------------------------------------
# DAT — FTL spot-market rate intelligence
# Shape approximates DAT RateView/Rate Intelligence responses.
# ---------------------------------------------------------------------------
def dat_payloads(req: RateRequest) -> List[Dict[str, Any]]:
    miles = _pseudo_miles(req)
    equip = req.equipment_type or "VAN"
    per_mile = round(1.85 + (miles % 70) / 100.0, 2)  # ~1.85–2.54 /mi
    fuel_per_mile = 0.42
    linehaul = round(per_mile * miles, 2)
    fuel = round(fuel_per_mile * miles, 2)
    return [
        {
            "rateResponse": {
                "escalation": "BEST_FIT",
                "equipmentType": equip,
                "originCity": req.origin,
                "destinationCity": req.destination,
                "mileage": miles,
                "rate": {
                    "perMile": {"amount": per_mile, "currency": "USD"},
                    "perTrip": {"amount": linehaul, "currency": "USD"},
                },
                "averageFuelSurchargePerMileUsd": fuel_per_mile,
                "averageFuelSurchargeUsd": fuel,
                "estimatedTransitDays": max(1, round(miles / 500)),
                "validUntil": _valid_until(7),
            }
        }
    ]


# ---------------------------------------------------------------------------
# SMC3 — LTL class-based rating (RateWare / CzarLite style)
# ---------------------------------------------------------------------------
def smc3_payloads(req: RateRequest) -> List[Dict[str, Any]]:
    weight = _weight_lbs(req, 1200.0)
    nmfc = req.nmfc_class or "70"
    # crude class-sensitive base rate per 100 lbs
    base_per_cwt = 18.0 + (sum(ord(c) for c in str(nmfc)) % 22)
    freight = round(base_per_cwt * (weight / 100.0), 2)
    fuel = round(freight * 0.29, 2)
    return [
        {
            "scac": "SMC3",
            "details": {
                "nmfcClass": str(nmfc),
                "totalWeightLbs": weight,
                "originPostalCode": req.origin,
                "destinationPostalCode": req.destination,
                "transitDays": max(1, round(_pseudo_miles(req) / 450)),
            },
            "charges": [
                {"type": "LINEHAUL", "amountUsd": freight},
                {"type": "FUEL", "amountUsd": fuel},
            ],
            "totalChargeUsd": round(freight + fuel, 2),
            "currency": "USD",
            "expirationDate": _valid_until(14),
        }
    ]


# ---------------------------------------------------------------------------
# Uber Freight — FTL instant quote
# ---------------------------------------------------------------------------
def uber_freight_payloads(req: RateRequest) -> List[Dict[str, Any]]:
    miles = _pseudo_miles(req)
    equip = req.equipment_type or "DRY_VAN"
    linehaul = round((2.05 + (miles % 50) / 100.0) * miles, 2)
    fuel = round(0.40 * miles, 2)
    return [
        {
            "quoteId": f"uf-mock-{abs(hash((req.origin, req.destination))) % 100000}",
            "carrier": "Uber Freight",
            "equipment": equip,
            "totalPrice": {"amount": round(linehaul + fuel, 2), "currency": "USD"},
            "estimatedTransitDays": max(1, round(miles / 520)),
            "lineItems": [
                {"category": "LINEHAUL", "amount": linehaul},
                {"category": "FUEL", "amount": fuel},
            ],
            "expiresAt": _valid_until(2),
        }
    ]


# ---------------------------------------------------------------------------
# Loadsmart — FTL instant quote (distinct field names from Uber Freight)
# ---------------------------------------------------------------------------
def loadsmart_payloads(req: RateRequest) -> List[Dict[str, Any]]:
    miles = _pseudo_miles(req)
    equip = req.equipment_type or "VAN"
    price = round((2.0 + (miles % 60) / 100.0) * miles + 0.39 * miles, 2)
    return [
        {
            "load": {
                "origin_zip": req.origin,
                "destination_zip": req.destination,
                "equipment_type": equip,
            },
            "price": price,
            "currency": "USD",
            "transit_time_days": max(1, round(miles / 500)),
            "accessorials": [{"name": "FUEL", "amount": round(0.39 * miles, 2)}],
            "valid_until": _valid_until(3),
        }
    ]


# ---------------------------------------------------------------------------
# VUCEM — cross-border customs (docs, not rates)
# ---------------------------------------------------------------------------
def usmca_certificate_mock(shipment: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "documentType": "USMCA_CERTIFICATE_OF_ORIGIN",
        "status": "GENERATED_MOCK",
        "blanketPeriod": {"from": date.today().isoformat(), "to": _valid_until(365)},
        "certifierType": "EXPORTER",
        "goods": shipment.get("goods", []),
        "hsCodes": shipment.get("hs_codes", []),
        "note": "Mock document — production generation requires VUCEM credentials.",
    }


def vucem_pedimento_mock(shipment: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "pedimentoNumber": f"MOCK-{abs(hash(str(shipment))) % 1_000_000:06d}",
        "status": "ACCEPTED_MOCK",
        "customsRegime": "A1",
        "note": "Mock VUCEM submission — production requires VUCEM credentials.",
    }
