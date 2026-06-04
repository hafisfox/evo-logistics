"""Phase 4 — Land Freight Market Rates endpoint.

Modal web endpoint the dashboard calls to fetch external (API) land-freight
rate intelligence for a lane. Aggregates all configured providers (DAT, SMC3,
Uber Freight, Loadsmart) via :func:`freight_apis.aggregate_land_rates`,
optionally persists the snapshot to ``external_rate_quotes`` (workspace-scoped),
and returns the normalized rates.

Runs in mock mode unless ``FREIGHT_API_MODE=live`` and per-provider credentials
are present (see automations/.env.example). Rates here are **market
intelligence** (``source='api'``) and are not fed into customer pricing.
"""

import os
from typing import Optional

import modal
from pydantic import BaseModel

from freight_apis import RateRequest, aggregate_land_rates, get_freight_api_mode

# =====================================================================
# MODAL APP DEFINITION
# =====================================================================
app = modal.App("market-rates-phase-4")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("fastapi", "pydantic", "requests", "supabase")
    .add_local_file(
        os.path.join(os.path.dirname(__file__), "tenant_context.py"),
        "/root/tenant_context.py",
    )
    .add_local_dir(
        os.path.join(os.path.dirname(__file__), "freight_apis"),
        "/root/freight_apis",
    )
)


# =====================================================================
# REQUEST MODEL
# =====================================================================
class MarketRatesRequest(BaseModel):
    workspace_id: str
    origin: str
    destination: str
    freight_mode: str = "land"
    equipment_type: Optional[str] = None
    load_type: Optional[str] = None
    weight_lbs: Optional[float] = None
    nmfc_class: Optional[str] = None
    pickup_date: Optional[str] = None
    rfq_id: Optional[str] = None
    persist: bool = True


# =====================================================================
# SUPABASE
# =====================================================================
def get_supabase_client():
    from supabase import create_client

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        raise Exception("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.")
    return create_client(supabase_url, supabase_key)


def _persist_rates(supabase, *, workspace_id, origin, destination, freight_mode, rows) -> int:
    """Replace the prior API snapshot for this lane, then insert the fresh batch.

    Keeps one current market snapshot per (workspace, lane, mode) so the table
    does not grow unbounded on repeated refreshes.
    """
    try:
        (
            supabase.table("external_rate_quotes")
            .delete()
            .eq("workspace_id", workspace_id)
            .eq("origin", origin)
            .eq("destination", destination)
            .eq("freight_mode", freight_mode)
            .eq("source", "api")
            .execute()
        )
    except Exception as exc:
        print(f"Warning: failed clearing prior market rates for {origin}->{destination}: {exc}")

    if not rows:
        return 0
    try:
        supabase.table("external_rate_quotes").insert(rows).execute()
        return len(rows)
    except Exception as exc:
        print(f"Error inserting market rates for {origin}->{destination}: {exc}")
        return 0


# =====================================================================
# ENDPOINT
# =====================================================================
@app.function(image=image, secrets=[modal.Secret.from_name("evo-logistics-env")])
@modal.fastapi_endpoint(method="POST")
def fetch_market_rates(request: MarketRatesRequest) -> dict:
    """Aggregate external land-freight rates for a lane and (optionally) persist."""
    try:
        req = RateRequest(
            origin=request.origin,
            destination=request.destination,
            freight_mode=request.freight_mode,
            equipment_type=request.equipment_type,
            load_type=request.load_type,
            weight_lbs=request.weight_lbs,
            nmfc_class=request.nmfc_class,
            pickup_date=request.pickup_date,
        )
        rates = aggregate_land_rates(req)
        norm = req.normalized()
        rows = [r.to_row(workspace_id=request.workspace_id, rfq_id=request.rfq_id) for r in rates]

        persisted = 0
        if request.persist and rows:
            supabase = get_supabase_client()
            persisted = _persist_rates(
                supabase,
                workspace_id=request.workspace_id,
                origin=norm.origin,
                destination=norm.destination,
                freight_mode=req.freight_mode,
                rows=rows,
            )

        return {
            "success": True,
            "mode": get_freight_api_mode(),
            "count": len(rates),
            "persisted": persisted,
            "rates": [r.to_dict() for r in rates],
        }
    except Exception as e:
        print(f"Error fetching market rates for {request.origin}->{request.destination}: {e}")
        return {"success": False, "error": str(e), "rates": []}
