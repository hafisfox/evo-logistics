import os
import math
import base64
from datetime import datetime, timezone, timedelta
from typing import Optional

UAE_TZ = timezone(timedelta(hours=4))

import modal
from pydantic import BaseModel
from gmail_workspace_auth import (
    WorkspaceMailboxAuthError,
    get_gmail_service_for_workspace,
)
from tenant_context import scoped_select, scoped_eq_filter
from dim_weight import total_chargeable_weight

# =====================================================================
# MODAL APP DEFINITION
# =====================================================================
app = modal.App("select-and-quote-phase-3")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "cryptography",
    "google-api-python-client",
    "google-auth-httplib2",
    "google-auth-oauthlib",
    "pydantic",
    "fastapi",
    "supabase"
).add_local_file(
    os.path.join(os.path.dirname(__file__), "tenant_context.py"),
    "/root/tenant_context.py"
).add_local_file(
    os.path.join(os.path.dirname(__file__), "gmail_workspace_auth.py"),
    "/root/gmail_workspace_auth.py"
).add_local_file(
    os.path.join(os.path.dirname(__file__), "dim_weight.py"),
    "/root/dim_weight.py"
)

# =====================================================================
# REQUEST / RESPONSE MODELS
# =====================================================================
class SelectAgentRequest(BaseModel):
    rfq_id: str
    workspace_id: str
    selected_by_user_id: str = "dashboard"
    selected_agent: str
    selected_match: str = ""
    selected_carrier: str
    shipment_number: str = "1"
    selected_by: str = "dashboard"
    margin: float = 0.13
    quote_threshold: int = 2

class SelectAgentResponse(BaseModel):
    success: bool
    rfq_id: str
    final_price_aed: float = 0
    final_price_usd: float = 0
    error: Optional[str] = None

# =====================================================================
# GOOGLE APIS UTILITIES
# =====================================================================
def get_supabase_client():
    from supabase import create_client
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        raise Exception("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.")
    return create_client(supabase_url, supabase_key)

# =====================================================================
# PRICING ENGINE (Python port of dashboard/src/lib/pricing-engine.ts)
# =====================================================================

DEFAULT_EXCHANGE_RATE = 3.685
RFQ_NORMALIZED_READ_SOURCE = os.environ.get(
    "RFQ_NORMALIZED_READ_SOURCE", "shadow"
).strip().lower()
USE_NORMALIZED_READ = RFQ_NORMALIZED_READ_SOURCE in {"normalized", "shadow"}


def get_exchange_rate(supabase, workspace_id: str, from_currency: str = "USD", to_currency: str = "AED") -> float:
    """Fetch latest exchange rate from DB, falling back to default."""
    try:
        result = (
            supabase.table("exchange_rates")
            .select("rate")
            .eq("workspace_id", workspace_id)
            .eq("from_currency", from_currency)
            .eq("to_currency", to_currency)
            .order("effective_date", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            return float(result.data[0]["rate"])
    except Exception as e:
        print(f"Warning: Could not fetch exchange rate, using default: {e}")
    return DEFAULT_EXCHANGE_RATE


def get_air_rate_per_kg(supabase, workspace_id, carrier, origin, destination, chargeable_weight_kg):
    """Look up the applicable weight-tier air rate from air_charge_rates.

    Returns (rate_per_kg_usd, min_charge_usd) for the highest weight break at or below the
    chargeable weight on the (carrier, origin, destination) lane, or None if the table/lane
    is not configured. Used as a fallback so air pricing still resolves when an agent quote
    does not carry a usable per-kg rate. The primary path keeps using the quoted rate.
    """
    carrier_u = (carrier or "").upper().strip()
    origin_u = (origin or "").upper().strip()
    dest_u = (destination or "").upper().strip()
    if not carrier_u or not origin_u or not dest_u or chargeable_weight_kg <= 0:
        return None
    try:
        result = (
            supabase.table("air_charge_rates")
            .select("rate_per_kg_usd, min_charge_usd, min_weight_kg")
            .eq("workspace_id", workspace_id)
            .eq("carrier", carrier_u)
            .eq("origin", origin_u)
            .eq("destination", dest_u)
            .lte("min_weight_kg", chargeable_weight_kg)
            .order("min_weight_kg", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            row = result.data[0]
            return float(row["rate_per_kg_usd"]), float(row.get("min_charge_usd") or 0.0)
    except Exception as e:
        print(f"Warning: air rate lookup failed for {carrier_u} {origin_u}->{dest_u}: {e}")
    return None


def get_truck_lane_rate(supabase, workspace_id, carrier, origin_zip, destination_zip, equipment_type=None):
    """Look up an FTL lane rate from truck_lane_rates.

    Returns a dict {rate_per_mile_usd, flat_rate_usd, min_charge_usd, fuel_surcharge_pct}
    for the (carrier, origin_zip, destination_zip[, equipment_type]) lane, or None if not
    configured. Used as a fallback so land pricing still resolves when an agent quote does
    not carry a usable total price. The primary path keeps using the quoted total.
    """
    carrier_u = (carrier or "").upper().strip()
    o_zip = (origin_zip or "").upper().strip()
    d_zip = (destination_zip or "").upper().strip()
    if not carrier_u or not o_zip or not d_zip:
        return None
    try:
        query = (
            supabase.table("truck_lane_rates")
            .select("rate_per_mile_usd, flat_rate_usd, min_charge_usd, fuel_surcharge_pct")
            .eq("workspace_id", workspace_id)
            .eq("carrier", carrier_u)
            .eq("origin_zip", o_zip)
            .eq("destination_zip", d_zip)
        )
        if equipment_type:
            query = query.eq("equipment_type", equipment_type.upper().strip())
        result = query.limit(1).execute()
        if result.data:
            row = result.data[0]
            return {
                "rate_per_mile_usd": float(row["rate_per_mile_usd"]) if row.get("rate_per_mile_usd") is not None else None,
                "flat_rate_usd": float(row["flat_rate_usd"]) if row.get("flat_rate_usd") is not None else None,
                "min_charge_usd": float(row.get("min_charge_usd") or 0.0),
                "fuel_surcharge_pct": float(row.get("fuel_surcharge_pct") or 0.0),
            }
    except Exception as e:
        print(f"Warning: truck lane rate lookup failed for {carrier_u} {o_zip}->{d_zip}: {e}")
    return None


def get_ltl_class_rate(supabase, workspace_id, nmfc_class):
    """Look up an LTL class rate from ltl_freight_classes.

    Returns {rate_per_100lb_usd, min_charge_usd} for the NMFC class, or None.
    """
    cls = (str(nmfc_class).strip() if nmfc_class is not None else "")
    if not cls:
        return None
    try:
        result = (
            supabase.table("ltl_freight_classes")
            .select("rate_per_100lb_usd, min_charge_usd")
            .eq("workspace_id", workspace_id)
            .eq("nmfc_class", cls)
            .limit(1)
            .execute()
        )
        if result.data:
            row = result.data[0]
            return {
                "rate_per_100lb_usd": float(row["rate_per_100lb_usd"]),
                "min_charge_usd": float(row.get("min_charge_usd") or 0.0),
            }
    except Exception as e:
        print(f"Warning: LTL class rate lookup failed for class {cls}: {e}")
    return None


def sum_surcharges(surcharges: dict) -> float:
    """Sum all non-null surcharge values from a JSONB dict."""
    if not surcharges or not isinstance(surcharges, dict):
        return 0.0
    total = 0.0
    for v in surcharges.values():
        if v is not None and isinstance(v, (int, float)):
            total += float(v)
    return total


def parse_multi_value(value):
    """Parse newline-separated multi-shipment values."""
    if not value:
        return ["N/A"]
    value = str(value)
    if "\n" in value:
        return [v.strip() for v in value.split("\n")]
    return [value]



def get_do_col(container_type):
    """Map container type to DO charge column name."""
    t = (container_type or "").upper().replace("-", "").replace(" ", "")
    if t in ("20FT", "20GP"):
        return "20FT"
    if t in ("40FT", "40GP"):
        return "40FT"
    return "40HQ"


def get_dest_col(container_type):
    """Map container type to destination charge column name."""
    t = (container_type or "").upper().replace("-", "").replace(" ", "")
    if t in ("20FT", "20GP"):
        return "20FT"
    return "40FT"


def get_do_charges_row(carrier, all_do):
    """Find DO charges row for a carrier. Falls back to first row."""
    c = (carrier or "").upper().strip()
    for row in all_do:
        if (row.get("carrier") or "").upper().strip() == c:
            return row
    if all_do:
        print(f"WARNING: Carrier '{c}' not found in DO Charges table, falling back to '{all_do[0].get('carrier', 'unknown')}'")
        return all_do[0]
    return None


def calc_dest_charges(all_dest, col, qty):
    """Sum destination charges. Fixed basis charges once, others per container."""
    total = 0
    for row in all_dest:
        amount = 0
        try:
            amount = float(row.get(col) or 0)
        except (ValueError, TypeError):
            pass
        basis = (row.get("Basis") or "").lower()
        if "fixed" in basis:
            total += amount
        else:
            total += amount * qty
    return total


def get_transport_charge(delivery_address, all_transp):
    """Substring match delivery address against transport places."""
    if not delivery_address:
        return 0
    addr = delivery_address.upper()
    for row in all_transp:
        place = (row.get("Place") or "").upper().strip()
        if place and place in addr:
            try:
                return float(row.get("Price") or 0)
            except (ValueError, TypeError):
                return 0
    return 0


def calculate_port_price(ocean_freight_usd, qty, margin, exchange_rate=None, surcharges_usd=0):
    """Port-to-port pricing calculation."""
    fx = exchange_rate or DEFAULT_EXCHANGE_RATE
    ocean_freight_aed = ocean_freight_usd * fx
    surcharges_aed = surcharges_usd * fx
    subtotal_aed = ocean_freight_aed + surcharges_aed
    with_margin = subtotal_aed * (1 + margin)
    final_price_aed = math.ceil(with_margin / 10) * 10
    final_price_usd = math.ceil(final_price_aed / fx)
    margin_amount = round(with_margin - subtotal_aed, 2)
    return {
        "final_price_aed": final_price_aed,
        "final_price_usd": final_price_usd,
        "margin_amount": margin_amount,
        "margin_percent": margin,
        "ocean_freight_aed": round(ocean_freight_aed, 2),
        "surcharges_usd": round(surcharges_usd, 2),
        "surcharges_aed": round(surcharges_aed, 2),
        "exchange_rate": fx,
    }


def calculate_air_price(rate_per_kg_usd, chargeable_weight_kg, margin,
                        exchange_rate=None, surcharges_usd=0):
    """Air freight pricing: base = (USD/kg rate) x chargeable weight, then add
    surcharges and apply margin. Mirrors calculate_port_price rounding so the
    downstream email/template handling is identical to ocean port-to-port."""
    fx = exchange_rate or DEFAULT_EXCHANGE_RATE
    air_freight_usd = rate_per_kg_usd * chargeable_weight_kg
    air_freight_aed = air_freight_usd * fx
    surcharges_aed = surcharges_usd * fx
    subtotal_aed = air_freight_aed + surcharges_aed
    with_margin = subtotal_aed * (1 + margin)
    final_price_aed = math.ceil(with_margin / 10) * 10
    final_price_usd = math.ceil(final_price_aed / fx)
    return {
        "final_price_aed": final_price_aed,
        "final_price_usd": final_price_usd,
        "margin_amount": round(with_margin - subtotal_aed, 2),
        "margin_percent": margin,
        "air_freight_usd": round(air_freight_usd, 2),
        "air_freight_aed": round(air_freight_aed, 2),
        "rate_per_kg_usd": round(rate_per_kg_usd, 4),
        "chargeable_weight_kg": round(chargeable_weight_kg, 2),
        "surcharges_usd": round(surcharges_usd, 2),
        "surcharges_aed": round(surcharges_aed, 2),
        "exchange_rate": fx,
    }


def calculate_land_price(land_freight_usd, margin, exchange_rate=None, surcharges_usd=0):
    """Land freight pricing: base = quoted land freight total (per-load), then add
    surcharges and apply margin. Mirrors calculate_port_price rounding so downstream
    email/template handling is identical to ocean/air."""
    fx = exchange_rate or DEFAULT_EXCHANGE_RATE
    land_freight_aed = land_freight_usd * fx
    surcharges_aed = surcharges_usd * fx
    subtotal_aed = land_freight_aed + surcharges_aed
    with_margin = subtotal_aed * (1 + margin)
    final_price_aed = math.ceil(with_margin / 10) * 10
    final_price_usd = math.ceil(final_price_aed / fx)
    return {
        "final_price_aed": final_price_aed,
        "final_price_usd": final_price_usd,
        "margin_amount": round(with_margin - subtotal_aed, 2),
        "margin_percent": margin,
        "land_freight_usd": round(land_freight_usd, 2),
        "land_freight_aed": round(land_freight_aed, 2),
        "surcharges_usd": round(surcharges_usd, 2),
        "surcharges_aed": round(surcharges_aed, 2),
        "exchange_rate": fx,
    }


def calculate_ftl_price(margin, rate_per_mile_usd=None, distance_miles=None,
                        flat_rate_usd=None, fuel_surcharge_pct=0.0,
                        accessorials_usd=0.0, min_charge_usd=0.0, exchange_rate=None):
    """FTL rate-book estimate: linehaul = flat_rate OR (per_mile x distance), floored at
    min_charge; + fuel surcharge (% of linehaul) + accessorials; x (1 + margin).
    Returns a dict shaped like calculate_land_price for downstream parity."""
    if flat_rate_usd is not None:
        linehaul = float(flat_rate_usd)
    elif rate_per_mile_usd is not None and distance_miles is not None:
        linehaul = float(rate_per_mile_usd) * float(distance_miles)
    else:
        raise ValueError("FTL pricing requires flat_rate_usd or (rate_per_mile_usd and distance_miles)")
    linehaul = max(linehaul, float(min_charge_usd or 0.0))
    fuel_usd = linehaul * (float(fuel_surcharge_pct or 0.0) / 100.0)
    land_freight_usd = linehaul + fuel_usd
    surcharges_usd = float(accessorials_usd or 0.0)
    result = calculate_land_price(land_freight_usd, margin,
                                  exchange_rate=exchange_rate, surcharges_usd=surcharges_usd)
    result["linehaul_usd"] = round(linehaul, 2)
    result["fuel_surcharge_usd"] = round(fuel_usd, 2)
    result["load_type"] = "FTL"
    return result


def calculate_ltl_price(rate_per_100lb_usd, weight_lbs, margin,
                        fuel_surcharge_pct=0.0, accessorials_usd=0.0,
                        min_charge_usd=0.0, exchange_rate=None):
    """LTL class-based estimate: linehaul = rate_per_100lb x (weight_lbs / 100), floored at
    min_charge; + fuel surcharge + accessorials; x (1 + margin)."""
    if weight_lbs is None or float(weight_lbs) <= 0:
        raise ValueError("LTL pricing requires a positive weight_lbs")
    linehaul = float(rate_per_100lb_usd) * (float(weight_lbs) / 100.0)
    linehaul = max(linehaul, float(min_charge_usd or 0.0))
    fuel_usd = linehaul * (float(fuel_surcharge_pct or 0.0) / 100.0)
    land_freight_usd = linehaul + fuel_usd
    surcharges_usd = float(accessorials_usd or 0.0)
    result = calculate_land_price(land_freight_usd, margin,
                                  exchange_rate=exchange_rate, surcharges_usd=surcharges_usd)
    result["linehaul_usd"] = round(linehaul, 2)
    result["fuel_surcharge_usd"] = round(fuel_usd, 2)
    result["load_type"] = "LTL"
    return result


def calculate_door_price(ocean_freight_usd, qty, container_type, carrier,
                         delivery_address, do_charges, dest_charges, transp_charges, margin,
                         exchange_rate=None, surcharges_usd=0):
    """Door service pricing with all charge components."""
    fx = exchange_rate or DEFAULT_EXCHANGE_RATE
    do_col = get_do_col(container_type)
    dest_col = get_dest_col(container_type)
    ocean_freight_aed = ocean_freight_usd * fx
    surcharges_aed = surcharges_usd * fx

    # DO Charges
    do_row = get_do_charges_row(carrier, do_charges)
    do_document = 0
    do_per_container = 0
    if do_row:
        try:
            do_document = float(do_row.get("document") or 0)
        except (ValueError, TypeError):
            pass
        try:
            do_per_container = float(do_row.get(do_col) or 0)
        except (ValueError, TypeError):
            pass
    do_total = do_document + do_per_container * qty

    # Destination Charges
    dest_total = calc_dest_charges(dest_charges, dest_col, qty)

    # Transport
    transp_per_container = get_transport_charge(delivery_address, transp_charges)
    transp_total = transp_per_container * qty

    # Totals
    subtotal_aed = ocean_freight_aed + surcharges_aed + do_total + dest_total + transp_total
    with_margin = subtotal_aed * (1 + margin)
    final_price_aed = math.ceil(with_margin / 10) * 10
    final_price_usd = math.ceil(final_price_aed / fx)

    return {
        "final_price_aed": final_price_aed,
        "final_price_usd": final_price_usd,
        "ocean_freight_aed": round(ocean_freight_aed, 2),
        "surcharges_usd": round(surcharges_usd, 2),
        "surcharges_aed": round(surcharges_aed, 2),
        "do_total": round(do_total, 2),
        "dest_total": round(dest_total, 2),
        "transp_total": round(transp_total, 2),
        "subtotal_aed": round(subtotal_aed, 2),
        "margin_amount": round(with_margin - subtotal_aed, 2),
        "margin_percent": margin,
        "exchange_rate": fx,
    }


def _group_containers_by_route(pols, pods, all_cts, all_qtys):
    """Group flattened container entries back into per-route lists.

    DB stores newline-separated values with route fields repeated for index
    alignment (e.g. pol="SHENZEN\\nSHENZEN", pod="JEBEL ALI\\nJEBEL ALI",
    container_type="40FT\\n20FT", qty="2\\n1"). This groups them back by
    consecutive pol|pod key into route-level groups.
    """
    groups = []
    prev_key = None
    for idx in range(len(all_cts)):
        pol = pols[idx] if idx < len(pols) else (pols[-1] if pols else "N/A")
        pod = pods[idx] if idx < len(pods) else (pods[-1] if pods else "N/A")
        key = f"{pol}|{pod}"
        if key != prev_key:
            groups.append({"pol": pol, "pod": pod, "cts": [], "qtys": []})
            prev_key = key
        groups[-1]["cts"].append(all_cts[idx])
        try:
            groups[-1]["qtys"].append(int(all_qtys[idx]) if idx < len(all_qtys) else 1)
        except (ValueError, TypeError):
            groups[-1]["qtys"].append(1)
    return groups


def calculate_door_price_multi(ocean_freight_usd, container_types, quantities, carrier,
                               delivery_address, do_charges, dest_charges, transp_charges, margin,
                               exchange_rate=None, surcharges_usd=0):
    """Door service pricing for mixed container types on a single route.

    Sums per-type DO and destination charges across all container types,
    then applies margin to the combined total.
    """
    fx = exchange_rate or DEFAULT_EXCHANGE_RATE
    ocean_freight_aed = ocean_freight_usd * fx
    surcharges_aed = surcharges_usd * fx
    total_qty = sum(quantities)

    # DO Charges — document fee once, per-container charge per type
    do_row = get_do_charges_row(carrier, do_charges)
    do_document = 0
    do_per_container_total = 0
    if do_row:
        try:
            do_document = float(do_row.get("document") or 0)
        except (ValueError, TypeError):
            pass
        for ct, qty in zip(container_types, quantities):
            do_col = get_do_col(ct)
            try:
                do_per_container_total += float(do_row.get(do_col) or 0) * qty
            except (ValueError, TypeError):
                pass
    do_total = do_document + do_per_container_total

    # Destination Charges — sum per type
    dest_total = 0
    for ct, qty in zip(container_types, quantities):
        dest_col = get_dest_col(ct)
        dest_total += calc_dest_charges(dest_charges, dest_col, qty)

    # Transport — per container regardless of type
    transp_per_container = get_transport_charge(delivery_address, transp_charges)
    transp_total = transp_per_container * total_qty

    # Totals
    subtotal_aed = ocean_freight_aed + surcharges_aed + do_total + dest_total + transp_total
    with_margin = subtotal_aed * (1 + margin)
    final_price_aed = math.ceil(with_margin / 10) * 10
    final_price_usd = math.ceil(final_price_aed / fx)

    return {
        "final_price_aed": final_price_aed,
        "final_price_usd": final_price_usd,
        "ocean_freight_aed": round(ocean_freight_aed, 2),
        "surcharges_usd": round(surcharges_usd, 2),
        "surcharges_aed": round(surcharges_aed, 2),
        "do_total": round(do_total, 2),
        "dest_total": round(dest_total, 2),
        "transp_total": round(transp_total, 2),
        "subtotal_aed": round(subtotal_aed, 2),
        "margin_amount": round(with_margin - subtotal_aed, 2),
        "margin_percent": margin,
        "exchange_rate": fx,
    }


def calculate_full_pricing(rfq, quote, do_charges, dest_charges, transp_charges, margin,
                           exchange_rate=None, freight_mode="ocean", chargeable_weight_kg=0.0):
    """Master pricing function. Handles single and multi-shipment RFQs.

    Key: shipment_count = len(prices), i.e. 1 price per route.
    Container types within a route are display metadata grouped by _group_containers_by_route.

    For air freight (freight_mode == "air") the quote price is interpreted as a
    USD-per-chargeable-kg rate; the base freight is rate x chargeable_weight_kg
    (computed from rfq_shipment_pieces via dim_weight) plus parsed surcharges and
    margin. Ocean/land flow is unchanged.
    """
    fx = exchange_rate or DEFAULT_EXCHANGE_RATE
    all_cts = parse_multi_value(rfq.get("container_type"))
    all_qtys = parse_multi_value(rfq.get("qty"))
    pols = parse_multi_value(rfq.get("pol"))
    pods = parse_multi_value(rfq.get("pod"))
    prices = parse_multi_value(quote.get("price"))
    carrier = (quote.get("carrier") or "N/A").strip()

    # Get surcharges total from quote
    surcharges_data = quote.get("surcharges") or {}
    surcharges_usd = sum_surcharges(surcharges_data)

    if (freight_mode or "ocean").lower() == "air":
        try:
            rate_per_kg_usd = float(prices[0]) if prices else 0.0
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid air rate '{prices[0] if prices else None}': {e}")
        if rate_per_kg_usd <= 0:
            raise ValueError(f"Air rate per kg must be positive, got {rate_per_kg_usd}")
        if chargeable_weight_kg <= 0:
            raise ValueError("Air pricing requires a positive chargeable weight (check rfq_shipment_pieces)")

        result = calculate_air_price(rate_per_kg_usd, chargeable_weight_kg, margin,
                                     exchange_rate=fx, surcharges_usd=surcharges_usd)
        result["shipment_number"] = 1
        result["service_type"] = (rfq.get("service_type") or "airport-to-airport").lower().strip()
        result["freight_mode"] = "air"
        result["pol"] = pols[0] if pols else (rfq.get("pol") or "N/A")
        result["pod"] = pods[0] if pods else (rfq.get("pod") or "N/A")
        result["container_display"] = f"{result['chargeable_weight_kg']} kg chargeable"
        result["carrier"] = carrier
        result["surcharge_breakdown"] = surcharges_data if surcharges_usd > 0 else None
        return {
            "shipments": [result],
            "grand_total_aed": result["final_price_aed"],
            "grand_total_usd": round(result["final_price_usd"], 2),
            "exchange_rate": fx,
            "margin_percent": margin,
            "freight_mode": "air",
        }

    if (freight_mode or "ocean").lower() == "land":
        service_type = (rfq.get("service_type") or "door-to-door").lower().strip()
        land_shipments = []
        grand_total_aed = 0
        grand_total_usd = 0
        for i in range(len(prices)):
            price_str = prices[i]
            try:
                land_freight_usd = float(price_str)
                if land_freight_usd <= 0:
                    raise ValueError(f"Land freight must be positive, got {price_str}")
            except (ValueError, TypeError) as e:
                raise ValueError(f"Invalid land freight price '{price_str}' for shipment {i+1}: {e}")
            result = calculate_land_price(land_freight_usd, margin,
                                          exchange_rate=fx, surcharges_usd=surcharges_usd)
            result["shipment_number"] = i + 1
            result["service_type"] = service_type
            result["freight_mode"] = "land"
            result["pol"] = pols[i] if i < len(pols) else (pols[0] if pols else (rfq.get("pol") or "N/A"))
            result["pod"] = pods[i] if i < len(pods) else (pods[0] if pods else (rfq.get("pod") or "N/A"))
            result["container_display"] = "Truck load"
            result["carrier"] = carrier
            result["surcharge_breakdown"] = surcharges_data if surcharges_usd > 0 else None
            land_shipments.append(result)
            grand_total_aed += result["final_price_aed"]
            grand_total_usd += result["final_price_usd"]
        return {
            "shipments": land_shipments,
            "grand_total_aed": grand_total_aed,
            "grand_total_usd": round(grand_total_usd, 2),
            "exchange_rate": fx,
            "margin_percent": margin,
            "freight_mode": "land",
        }

    service_type = (rfq.get("service_type") or "port-to-port").lower().strip()
    is_port_only = service_type == "port-to-port"
    has_delivery = service_type in ("port-to-door", "door-to-door")
    delivery_addrs = parse_multi_value(rfq.get("delivery_address")) if has_delivery else []

    # Group containers by route (consecutive pol|pod)
    route_groups = _group_containers_by_route(pols, pods, all_cts, all_qtys)
    shipment_count = len(prices)

    # If route grouping produces fewer groups than prices, pad; if more, cap
    while len(route_groups) < shipment_count:
        route_groups.append(route_groups[-1] if route_groups else {"pol": "N/A", "pod": "N/A", "cts": ["N/A"], "qtys": [1]})

    shipments = []
    grand_total_aed = 0
    grand_total_usd = 0

    for i in range(shipment_count):
        price_str = prices[i] if i < len(prices) else prices[0]
        try:
            ocean_freight_usd = float(price_str)
            if ocean_freight_usd <= 0:
                raise ValueError(f"Ocean freight must be positive, got {price_str}")
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid ocean freight price '{price_str}' for shipment {i+1}: {e}")

        rg = route_groups[i]
        total_qty = sum(rg["qtys"])
        container_display = ", ".join(f"{q}\u00d7{ct}" for ct, q in zip(rg["cts"], rg["qtys"]))

        if is_port_only:
            result = calculate_port_price(ocean_freight_usd, total_qty, margin,
                                          exchange_rate=fx, surcharges_usd=surcharges_usd)
        else:
            delivery_addr = (delivery_addrs[i] if i < len(delivery_addrs) else delivery_addrs[0]) if delivery_addrs else None
            if len(rg["cts"]) > 1:
                result = calculate_door_price_multi(
                    ocean_freight_usd, rg["cts"], rg["qtys"], carrier,
                    delivery_addr, do_charges, dest_charges, transp_charges, margin,
                    exchange_rate=fx, surcharges_usd=surcharges_usd
                )
            else:
                result = calculate_door_price(
                    ocean_freight_usd, total_qty, rg["cts"][0], carrier,
                    delivery_addr, do_charges, dest_charges, transp_charges, margin,
                    exchange_rate=fx, surcharges_usd=surcharges_usd
                )

        result["shipment_number"] = i + 1
        result["service_type"] = service_type
        result["pol"] = rg["pol"]
        result["pod"] = rg["pod"]
        result["container_display"] = container_display
        result["container_types"] = rg["cts"]
        result["quantities"] = rg["qtys"]
        result["total_qty"] = total_qty
        result["carrier"] = carrier
        result["ocean_freight_usd"] = ocean_freight_usd
        result["surcharge_breakdown"] = surcharges_data if surcharges_usd > 0 else None

        shipments.append(result)
        grand_total_aed += result["final_price_aed"]
        grand_total_usd += result["final_price_usd"]

    return {
        "shipments": shipments,
        "grand_total_aed": grand_total_aed,
        "grand_total_usd": round(grand_total_usd, 2),
        "exchange_rate": fx,
        "margin_percent": margin,
    }


# =====================================================================
# SUPABASE HELPERS
# =====================================================================
def _get_table(supabase, table_name, workspace_id=None):
    """Fetch all rows from a Supabase table as a list of dicts."""
    if workspace_id:
        return scoped_select(supabase, table_name, workspace_id)
    result = supabase.table(table_name).select("*").execute()
    return result.data or []

def _get_by_filter(supabase, table_name, column, value, workspace_id=None):
    """Fetch rows matching a filter as a list of dicts."""
    if workspace_id:
        return scoped_eq_filter(supabase, table_name, workspace_id, column, value)
    result = supabase.table(table_name).select("*").eq(column, value).execute()
    return result.data or []


def _get_workspace_rows(supabase, table_name: str, workspace_id: str):
    result = (
        supabase.table(table_name)
        .select("*")
        .eq("workspace_id", workspace_id)
        .execute()
    )
    return result.data or []


def _load_normalized_shipments(supabase, workspace_id: str, rfq_id: str) -> list:
    shipments = (
        supabase.table("rfq_shipments")
        .select("*")
        .eq("workspace_id", workspace_id)
        .eq("rfq_id", rfq_id)
        .order("shipment_number")
        .execute()
        .data
        or []
    )
    if not shipments:
        return []

    containers = (
        supabase.table("rfq_shipment_containers")
        .select("*")
        .eq("workspace_id", workspace_id)
        .eq("rfq_id", rfq_id)
        .order("shipment_number")
        .order("line_number")
        .execute()
        .data
        or []
    )

    containers_by_shipment = {}
    for c in containers:
        key = int(c.get("shipment_number") or 1)
        containers_by_shipment.setdefault(key, []).append(c)

    for s in shipments:
        key = int(s.get("shipment_number") or 1)
        s["containers"] = containers_by_shipment.get(key, [])

    return shipments


def _load_pieces(supabase, workspace_id: str, rfq_id: str) -> list:
    """Load air-freight piece dimensions for chargeable-weight calculation."""
    return (
        supabase.table("rfq_shipment_pieces")
        .select("*")
        .eq("workspace_id", workspace_id)
        .eq("rfq_id", rfq_id)
        .execute()
        .data
        or []
    )


def _load_truck_details(supabase, workspace_id: str, rfq_id: str) -> list:
    """Load land-freight truck details (equipment/load type/weight/class) for pricing."""
    return (
        supabase.table("rfq_shipment_truck_details")
        .select("*")
        .eq("workspace_id", workspace_id)
        .eq("rfq_id", rfq_id)
        .order("shipment_number")
        .execute()
        .data
        or []
    )


def _build_legacy_rfq_projection(rfq_data: dict, shipments: list) -> dict:
    if not shipments:
        return rfq_data

    pol_lines = []
    pod_lines = []
    type_lines = []
    qty_lines = []
    ready_date_lines = []
    pickup_lines = []
    delivery_lines = []
    service_type_value = None

    for shipment in shipments:
        if not service_type_value and shipment.get("service_type"):
            service_type_value = shipment.get("service_type")
        shipment_pol = shipment.get("pol") or "N/A"
        shipment_pod = shipment.get("pod") or "N/A"
        shipment_ready = shipment.get("ready_date")
        shipment_pickup = shipment.get("pickup_address")
        shipment_delivery = shipment.get("delivery_address")

        for container in shipment.get("containers") or [{"container_type": "40HQ", "qty": 1}]:
            pol_lines.append(str(shipment_pol))
            pod_lines.append(str(shipment_pod))
            type_lines.append(str(container.get("container_type") or "40HQ"))
            qty_lines.append(str(container.get("qty") or 1))
            if shipment_ready:
                ready_date_lines.append(str(shipment_ready))
            if shipment_pickup:
                pickup_lines.append(str(shipment_pickup))
            if shipment_delivery:
                delivery_lines.append(str(shipment_delivery))

    projected = dict(rfq_data)
    projected["pol"] = "\n".join(pol_lines) if pol_lines else rfq_data.get("pol")
    projected["pod"] = "\n".join(pod_lines) if pod_lines else rfq_data.get("pod")
    projected["container_type"] = "\n".join(type_lines) if type_lines else rfq_data.get("container_type")
    projected["qty"] = "\n".join(qty_lines) if qty_lines else rfq_data.get("qty")
    if ready_date_lines:
        projected["ready_date"] = "\n".join(ready_date_lines)
    if pickup_lines:
        projected["pickup_address"] = "\n".join(pickup_lines)
    if delivery_lines:
        projected["delivery_address"] = "\n".join(delivery_lines)
    if service_type_value:
        projected["service_type"] = service_type_value
    return projected


def _map_normalized_quotes_to_legacy(rows: list) -> list:
    mapped = []
    for q in rows:
        mapped.append(
            {
                "rfq_id": q.get("rfq_id"),
                "match": q.get("match"),
                "status": q.get("status") or "Invalid_Quote",
                "agent_name": q.get("agent_name"),
                "agent_email": q.get("agent_email"),
                "shipment_number": str(q.get("shipment_number") or "1"),
                "carrier": q.get("carrier") or "N/A",
                "price": str(q.get("price")) if q.get("price") is not None else "N/A",
                "currency": q.get("currency") or "USD",
                "etd": q.get("etd") or "N/A",
                "transit_time": str(q.get("transit_time")) if q.get("transit_time") is not None else "N/A",
                "free_time": str(q.get("free_time")) if q.get("free_time") is not None else "N/A",
                "validity": q.get("validity") or "N/A",
                "validity_date": q.get("validity_date"),
                "surcharges": q.get("surcharges"),
                "free_time_details": q.get("free_time_details"),
                "conditions": q.get("conditions"),
                "sent_at": q.get("sent_at"),
                "received_at": q.get("received_at"),
            }
        )
    return mapped


def _load_quotes_for_selection(supabase, workspace_id: str, rfq_id: str) -> list:
    if not USE_NORMALIZED_READ:
        return _get_by_filter(supabase, "agent_outbound_log", "rfq_id", rfq_id, workspace_id)

    normalized_quotes = _get_by_filter(supabase, "agent_quotes", "rfq_id", rfq_id, workspace_id)
    if normalized_quotes:
        return _map_normalized_quotes_to_legacy(normalized_quotes)

    return _get_by_filter(supabase, "agent_outbound_log", "rfq_id", rfq_id, workspace_id)


def _load_do_charges_for_pricing(supabase, workspace_id: str) -> list:
    rows = _get_workspace_rows(supabase, "v_do_charges_legacy", workspace_id)
    if rows:
        return rows
    return _get_table(supabase, "do_charges", workspace_id)


def _load_destination_charges_for_pricing(supabase, workspace_id: str) -> list:
    rows = _get_workspace_rows(supabase, "v_destination_charges_legacy", workspace_id)
    if rows:
        return [
            {
                "Charge Type": row.get("charge_type"),
                "Basis": row.get("basis"),
                "20FT": row.get("20FT"),
                "40FT": row.get("40FT"),
            }
            for row in rows
        ]

    legacy_rows = _get_table(supabase, "destination_charges", workspace_id)
    return [
        {
            "Charge Type": row.get("charge_type"),
            "Basis": row.get("basis"),
            "20FT": row.get("20FT"),
            "40FT": row.get("40FT"),
        }
        for row in legacy_rows
    ]


# =====================================================================
# QUOTATION EMAIL
# =====================================================================
def _build_quotation_html(rfq_id, rfq_data, pricing, quote_data):
    """Build HTML email body for the customer quotation."""
    shipments_html = ""
    for s in pricing["shipments"]:
        container_display = s.get('container_display', 'N/A')
        usd_display = f" (USD {s['final_price_usd']:,.0f})" if s.get('final_price_usd') else ""
        shipments_html += f"""
        <tr>
            <td style="padding:8px;border:1px solid #ddd;">{s.get('pol','N/A')} &rarr; {s.get('pod','N/A')}</td>
            <td style="padding:8px;border:1px solid #ddd;">{container_display}</td>
            <td style="padding:8px;border:1px solid #ddd;">{s.get('carrier','N/A')}</td>
            <td style="padding:8px;border:1px solid #ddd;font-weight:bold;">AED {s['final_price_aed']:,.0f}{usd_display}</td>
        </tr>"""

    etd = quote_data.get("etd") or "TBC"
    transit_time = quote_data.get("transit_time") or "TBC"
    free_time = quote_data.get("free_time") or "TBC"
    validity = quote_data.get("validity") or quote_data.get("validity_date") or "TBC"
    conditions = quote_data.get("conditions") or ""
    service_type = pricing["shipments"][0].get("service_type", "port-to-port") if pricing["shipments"] else "port-to-port"
    service_label = service_type.replace("-", " to ").title()

    # Free time details
    free_time_html = f"{free_time} days"
    ftd = quote_data.get("free_time_details")
    if ftd and isinstance(ftd, dict):
        parts = []
        if ftd.get("demurrage_days"):
            parts.append(f"{ftd['demurrage_days']} days demurrage")
        if ftd.get("detention_days"):
            parts.append(f"{ftd['detention_days']} days detention")
        if parts:
            free_time_html = ", ".join(parts)
        elif ftd.get("combined_days"):
            free_time_html = f"{ftd['combined_days']} days (combined)"

    # Conditions note
    conditions_html = f"<li><strong>Conditions:</strong> {conditions}</li>" if conditions else ""

    return f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2 style="color:#1a56db;">Quotation — {rfq_id}</h2>
        <p>Dear Customer,</p>
        <p>Thank you for your inquiry. Please find our quotation below:</p>

        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr style="background:#f3f4f6;">
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Route</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Containers</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Carrier</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Price</th>
            </tr>
            {shipments_html}
            <tr style="background:#f9fafb;font-weight:bold;">
                <td colspan="3" style="padding:8px;border:1px solid #ddd;text-align:right;">Total</td>
                <td style="padding:8px;border:1px solid #ddd;">AED {pricing['grand_total_aed']:,.0f} (USD {pricing['grand_total_usd']:,.0f})</td>
            </tr>
        </table>

        <h3 style="color:#374151;">Service Details</h3>
        <ul>
            <li><strong>Service:</strong> {service_label}</li>
            <li><strong>ETD:</strong> {etd}</li>
            <li><strong>Transit Time:</strong> {transit_time} days</li>
            <li><strong>Free Time:</strong> {free_time_html}</li>
            <li><strong>Validity:</strong> {validity}</li>
            {conditions_html}
        </ul>

        <h3 style="color:#374151;">Terms & Conditions</h3>
        <ul>
            <li>Prices are all-inclusive ({service_label.lower()}) unless stated otherwise</li>
            <li>Subject to equipment and space availability at time of booking</li>
            <li>Customs clearance and documentation charges are excluded unless quoted</li>
            <li>Demurrage and detention charges apply beyond the free time period</li>
        </ul>

        <p>Please confirm to proceed with booking, or let us know if you have any questions.</p>
        <p>Best regards,<br/><strong>Evo Logistics Pricing Team</strong></p>
    </div>
    """


def _send_quotation_email(gmail_service, customer_email, thread_id, rfq_id, rfq_data, pricing, quote_data):
    """Send quotation reply on the original email thread."""
    # Get original message ID for threading
    thread = gmail_service.users().threads().get(userId='me', id=thread_id).execute()
    messages = thread.get('messages', [])

    reference_msg_id = ""
    original_subject = ""
    if messages:
        last_msg = messages[-1]
        msg_headers = {h['name']: h['value'] for h in last_msg.get('payload', {}).get('headers', [])}
        reference_msg_id = msg_headers.get('Message-ID', '')
        # Use the first message's subject for proper threading
        first_msg_headers = {h['name']: h['value'] for h in messages[0].get('payload', {}).get('headers', [])}
        original_subject = first_msg_headers.get('Subject', '')

    reply_subject = f"Re: {original_subject}" if original_subject else f"Quotation - {rfq_id}"

    body_html = _build_quotation_html(rfq_id, rfq_data, pricing, quote_data)

    raw_msg = (
        f"To: {customer_email}\n"
        f"In-Reply-To: {reference_msg_id}\n"
        f"References: {reference_msg_id}\n"
        f"Subject: {reply_subject}\n"
        f"Content-Type: text/html; charset=utf-8\n\n{body_html}"
    )

    b64_message = base64.urlsafe_b64encode(raw_msg.encode('utf-8')).decode('utf-8')
    gmail_service.users().messages().send(userId='me', body={
        'raw': b64_message,
        'threadId': thread_id
    }).execute()
    print(f"Quotation email sent to {customer_email} on thread {thread_id}")


def _notify_sales(
    gmail_service,
    notification_email,
    rfq_id,
    rfq_data,
    pricing,
    customer_email,
    carrier,
    agent_name,
):
    """Send enriched notification email to workspace mailbox after quotation."""
    if not notification_email:
        print(f"No workspace notification mailbox configured for {rfq_id}")
        return
    total_aed = pricing["grand_total_aed"]
    total_usd = pricing["grand_total_usd"]
    margin_pct = pricing.get("margin_percent", 0.13)
    fx_rate = pricing.get("exchange_rate", DEFAULT_EXCHANGE_RATE)

    # Build shipment rows for the breakdown table
    rows_html = ""
    for s in pricing["shipments"]:
        container_display = s.get('container_display', 'N/A')
        margin_amt = s.get('margin_amount', 0)
        surcharges_aed = s.get('surcharges_aed', 0)
        rows_html += (
            f"<tr>"
            f"<td style='padding:6px 10px;border:1px solid #e0e0e0;'>{s.get('pol','N/A')} &rarr; {s.get('pod','N/A')}</td>"
            f"<td style='padding:6px 10px;border:1px solid #e0e0e0;'>{container_display}</td>"
            f"<td style='padding:6px 10px;border:1px solid #e0e0e0;'>{s.get('carrier','N/A')}</td>"
            f"<td style='padding:6px 10px;border:1px solid #e0e0e0;text-align:right;'>AED {s['final_price_aed']:,.0f}</td>"
            f"<td style='padding:6px 10px;border:1px solid #e0e0e0;text-align:right;color:#16a34a;'>AED {margin_amt:,.0f}</td>"
            f"</tr>"
        )

    service_type = rfq_data.get("service_type", "port-to-port")
    ready_date = rfq_data.get("ready_date", "N/A")

    subject = f"Quotation Sent - {rfq_id} - AED {total_aed:,.0f}"
    body_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:650px;">
        <h3 style="color:#1a56db;">Quotation Sent for {rfq_id}</h3>
        <table style="border-collapse:collapse;margin:10px 0;">
            <tr><td style="padding:4px 10px;color:#666;">Customer</td><td style="padding:4px 10px;font-weight:bold;">{customer_email}</td></tr>
            <tr><td style="padding:4px 10px;color:#666;">Agent</td><td style="padding:4px 10px;font-weight:bold;">{agent_name}</td></tr>
            <tr><td style="padding:4px 10px;color:#666;">Carrier</td><td style="padding:4px 10px;font-weight:bold;">{carrier}</td></tr>
            <tr><td style="padding:4px 10px;color:#666;">Service</td><td style="padding:4px 10px;">{service_type}</td></tr>
            <tr><td style="padding:4px 10px;color:#666;">Ready Date</td><td style="padding:4px 10px;">{ready_date}</td></tr>
            <tr><td style="padding:4px 10px;color:#666;">Margin</td><td style="padding:4px 10px;font-weight:bold;color:#16a34a;">{margin_pct*100:.0f}%</td></tr>
            <tr><td style="padding:4px 10px;color:#666;">FX Rate</td><td style="padding:4px 10px;">{fx_rate}</td></tr>
        </table>

        <h4 style="margin-top:16px;">Shipment Breakdown</h4>
        <table style="width:100%;border-collapse:collapse;margin:8px 0;">
            <tr style="background:#f3f4f6;">
                <th style="padding:6px 10px;border:1px solid #e0e0e0;text-align:left;">Route</th>
                <th style="padding:6px 10px;border:1px solid #e0e0e0;text-align:left;">Containers</th>
                <th style="padding:6px 10px;border:1px solid #e0e0e0;text-align:left;">Carrier</th>
                <th style="padding:6px 10px;border:1px solid #e0e0e0;text-align:right;">Price</th>
                <th style="padding:6px 10px;border:1px solid #e0e0e0;text-align:right;">Margin</th>
            </tr>
            {rows_html}
            <tr style="font-weight:bold;background:#f9fafb;">
                <td colspan="3" style="padding:6px 10px;border:1px solid #e0e0e0;text-align:right;">Total</td>
                <td style="padding:6px 10px;border:1px solid #e0e0e0;text-align:right;">AED {total_aed:,.0f} (USD {total_usd:,.2f})</td>
                <td style="padding:6px 10px;border:1px solid #e0e0e0;text-align:right;"></td>
            </tr>
        </table>
    </div>"""

    message = (
        f"To: {notification_email}\n"
        f"Subject: {subject}\n"
        f"Content-Type: text/html; charset=utf-8\n\n{body_html}"
    )
    b64_message = base64.urlsafe_b64encode(message.encode('utf-8')).decode('utf-8')
    gmail_service.users().messages().send(userId='me', body={'raw': b64_message}).execute()
    print(f"Sales notification sent for {rfq_id}")


# =====================================================================
# FASTAPI ENDPOINT
# =====================================================================
@app.function(
    image=image,
    secrets=[modal.Secret.from_name("evo-logistics-env")]
)
@modal.fastapi_endpoint(method="POST")
def select_agent(request: SelectAgentRequest) -> dict:
    """Dashboard calls this to select an agent, calculate pricing, and send quotation."""
    try:
        result = _process_agent_selection(request)
        return result
    except Exception as e:
        print(f"Error processing agent selection for {request.rfq_id}: {e}")
        return {"success": False, "rfq_id": request.rfq_id, "final_price_aed": 0, "final_price_usd": 0, "error": str(e)}


# =====================================================================
# CORE PROCESSING LOGIC
# =====================================================================
def _process_agent_selection(request: SelectAgentRequest) -> dict:
    supabase = get_supabase_client()
    workspace_id = request.workspace_id
    try:
        gmail_service, workspace_mailbox_email = get_gmail_service_for_workspace(
            supabase, workspace_id
        )
    except WorkspaceMailboxAuthError as exc:
        raise Exception(
            f"Workspace mailbox authentication failed for {workspace_id}: {exc}"
        ) from exc

    # 1. Fetch the RFQ from Supabase
    rfq_rows = _get_by_filter(supabase, "master_rfqs", "rfq_id", request.rfq_id, workspace_id)
    if not rfq_rows:
        raise Exception(
            f"RFQ '{request.rfq_id}' not found in master_rfqs for workspace '{workspace_id}'"
        )
    rfq_data = rfq_rows[0]
    normalized_shipments = _load_normalized_shipments(supabase, workspace_id, request.rfq_id) if USE_NORMALIZED_READ else []
    rfq_for_pricing = _build_legacy_rfq_projection(rfq_data, normalized_shipments)

    # Determine freight mode (air pricing uses chargeable weight from pieces).
    freight_mode = "ocean"
    if normalized_shipments:
        freight_mode = (normalized_shipments[0].get("freight_mode") or "ocean").lower()
    chargeable_weight_kg = 0.0
    truck_details = []
    if freight_mode == "air":
        pieces = _load_pieces(supabase, workspace_id, request.rfq_id)
        chargeable_weight_kg = total_chargeable_weight(pieces)
        print(f"Air freight: chargeable weight = {chargeable_weight_kg} kg from {len(pieces)} piece line(s)")
    elif freight_mode == "land":
        truck_details = _load_truck_details(supabase, workspace_id, request.rfq_id)
        print(f"Land freight: loaded {len(truck_details)} truck detail row(s)")

    print(f"Found RFQ {request.rfq_id}")

    # 2. Update status to "Selected" and set selected_agent
    supabase.table("master_rfqs").update({
        "status": "Selected",
        "selected_agent": request.selected_agent
    }).eq("workspace_id", workspace_id).eq("rfq_id", request.rfq_id).execute()
    print(f"Updated RFQ status to Selected, agent: {request.selected_agent}")

    # 3. Find the selected quote
    all_quotes = _load_quotes_for_selection(supabase, workspace_id, request.rfq_id)
    quote_data = _find_selected_quote(all_quotes, request)
    print(f"Found quote: carrier={quote_data.get('carrier')}, price={quote_data.get('price')}")

    # 4. Read pricing lookup tables directly as dicts
    do_charges = _load_do_charges_for_pricing(supabase, workspace_id)
    dest_charges = _load_destination_charges_for_pricing(supabase, workspace_id)
    transp_charges = _get_table(supabase, "transportation_charges", workspace_id)

    # 5. Fetch exchange rate
    fx = get_exchange_rate(supabase, workspace_id)
    print(f"Using exchange rate: {fx}")

    # 5b. Air rate fallback: if the selected quote lacks a usable per-kg rate, fall back to
    # the workspace air rate book (weight-tier lookup) so air pricing still resolves. The
    # min charge is folded into the effective rate so rate x weight >= min_charge.
    if freight_mode == "air" and chargeable_weight_kg > 0:
        try:
            quoted_rate = float(parse_multi_value(quote_data.get("price"))[0])
        except (TypeError, ValueError, IndexError):
            quoted_rate = 0.0
        if quoted_rate <= 0:
            origin = (rfq_for_pricing.get("pol") or "").split("\n")[0].strip()
            destination = (rfq_for_pricing.get("pod") or "").split("\n")[0].strip()
            tier = get_air_rate_per_kg(
                supabase, workspace_id, quote_data.get("carrier"),
                origin, destination, chargeable_weight_kg,
            )
            if tier:
                rate_per_kg, min_charge = tier
                effective_rate = rate_per_kg
                if min_charge > 0:
                    effective_rate = max(rate_per_kg, min_charge / chargeable_weight_kg)
                quote_data = {**quote_data, "price": str(effective_rate)}
                print(
                    f"Air rate fallback: {effective_rate:.4f} USD/kg from air_charge_rates "
                    f"(tier {rate_per_kg}/kg, min charge {min_charge})"
                )

    # 5c. Land rate fallback: if the selected quote lacks a usable total price, fall back to
    # the workspace land rate book — FTL truck_lane_rates (per-mile/flat) or LTL class rate —
    # so land pricing still resolves. The primary path keeps using the quoted total.
    if freight_mode == "land":
        try:
            quoted_total = float(parse_multi_value(quote_data.get("price"))[0])
        except (TypeError, ValueError, IndexError):
            quoted_total = 0.0
        if quoted_total <= 0 and truck_details:
            detail = truck_details[0]
            load_type = (detail.get("load_type") or "").upper().strip()
            fallback_total = None
            if load_type == "LTL" and detail.get("nmfc_class") and detail.get("weight_lbs"):
                cls_rate = get_ltl_class_rate(supabase, workspace_id, detail.get("nmfc_class"))
                if cls_rate:
                    est = calculate_ltl_price(
                        cls_rate["rate_per_100lb_usd"], detail.get("weight_lbs"), request.margin,
                        min_charge_usd=cls_rate.get("min_charge_usd", 0.0), exchange_rate=fx,
                    )
                    fallback_total = est["land_freight_usd"]
            else:
                lane = get_truck_lane_rate(
                    supabase, workspace_id, quote_data.get("carrier"),
                    detail.get("origin_zip"), detail.get("destination_zip"),
                    detail.get("equipment_type"),
                )
                if lane and (lane.get("flat_rate_usd") or lane.get("rate_per_mile_usd")):
                    # Without a distance we can only use a configured flat rate.
                    if lane.get("flat_rate_usd"):
                        est = calculate_ftl_price(
                            request.margin, flat_rate_usd=lane["flat_rate_usd"],
                            fuel_surcharge_pct=lane.get("fuel_surcharge_pct", 0.0),
                            min_charge_usd=lane.get("min_charge_usd", 0.0), exchange_rate=fx,
                        )
                        fallback_total = est["land_freight_usd"]
            if fallback_total and fallback_total > 0:
                quote_data = {**quote_data, "price": str(fallback_total)}
                print(f"Land rate fallback: {fallback_total:.2f} USD total from land rate book")

    # 6. Calculate pricing (surcharges auto-extracted from quote_data)
    pricing = calculate_full_pricing(
        rfq_for_pricing,
        quote_data,
        do_charges,
        dest_charges,
        transp_charges,
        request.margin,
        exchange_rate=fx,
        freight_mode=freight_mode,
        chargeable_weight_kg=chargeable_weight_kg,
    )
    print(f"Pricing calculated: AED {pricing['grand_total_aed']:,.0f} / USD {pricing['grand_total_usd']:,.2f}")

    # 6. Update master_rfqs with final pricing
    now_str = datetime.now(UAE_TZ).strftime('%Y-%m-%d %I:%M %p')

    supabase.table("master_rfqs").update({
        "status": "Quoted",
        "final_price_aed": pricing["grand_total_aed"],
        "final_price_usd": pricing["grand_total_usd"],
        "quoted_at": now_str
    }).eq("workspace_id", workspace_id).eq("rfq_id", request.rfq_id).execute()
    print(f"master_rfqs updated with pricing and status=Quoted")

    # 7. Send quotation email on original thread
    thread_id = rfq_data.get("thread_id")
    customer_email = rfq_data.get("customer_email")

    if thread_id and customer_email:
        _send_quotation_email(gmail_service, customer_email, thread_id,
                              request.rfq_id, rfq_data, pricing, quote_data)
    else:
        print(f"Warning: Missing thread_id or customer_email, skipping quotation email")

    # 8. Notify sales team
    _notify_sales(
        gmail_service,
        workspace_mailbox_email,
        request.rfq_id,
        rfq_data,
        pricing,
        customer_email or "N/A",
        request.selected_carrier,
        request.selected_agent,
    )

    return {
        "success": True,
        "rfq_id": request.rfq_id,
        "final_price_aed": pricing["grand_total_aed"],
        "final_price_usd": pricing["grand_total_usd"],
    }


def _find_selected_quote(all_quotes: list, request: SelectAgentRequest) -> dict:
    """Find the single selected quote.

    Prefers exact match-key lookup. Falls back to legacy agent/carrier/shipment
    lookup for backward compatibility.
    """
    selected_match = (request.selected_match or "").strip()
    if selected_match:
        for q in all_quotes:
            if q.get("rfq_id") != request.rfq_id:
                continue
            if (q.get("match") or "").strip() == selected_match:
                return q

    for q in all_quotes:
        if q.get("rfq_id") != request.rfq_id:
            continue
        if (q.get("agent_name") or "").strip().lower() != request.selected_agent.strip().lower():
            continue
        if (q.get("carrier") or "").upper().strip() != request.selected_carrier.upper().strip():
            continue
        if str(q.get("shipment_number", "1")) != str(request.shipment_number):
            continue
        return q
    raise Exception(
        f"No quote found for rfq_id={request.rfq_id}, selected_match={request.selected_match}, "
        f"agent={request.selected_agent}, carrier={request.selected_carrier}, shipment={request.shipment_number}"
    )


if __name__ == "__main__":
    app.serve()
