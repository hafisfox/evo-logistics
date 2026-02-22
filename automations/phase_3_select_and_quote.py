import os
import math
import base64
from datetime import datetime, timezone, timedelta
from typing import Optional

UAE_TZ = timezone(timedelta(hours=4))

import modal
from pydantic import BaseModel
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from tenant_context import scoped_select, scoped_eq_filter

# =====================================================================
# MODAL APP DEFINITION
# =====================================================================
app = modal.App("select-and-quote-phase-3")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
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
    os.path.join(os.path.dirname(__file__), "token.json"),
    "/root/token.json"
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
def get_google_services():
    """Initializes Google API clients securely via OAuth 2.0 token."""
    if not os.path.exists("/root/token.json"):
        raise Exception("Missing /root/token.json mount. Did you run authenticate_google.py?")

    credentials = Credentials.from_authorized_user_file(
        "/root/token.json",
        scopes=["https://www.googleapis.com/auth/gmail.modify"]
    )

    gmail_service = build('gmail', 'v1', credentials=credentials)
    return gmail_service

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

EXCHANGE_RATE = 3.685


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


def calculate_port_price(ocean_freight_usd, qty, margin):
    """Port-to-port pricing calculation."""
    ocean_freight_aed = ocean_freight_usd * EXCHANGE_RATE
    with_margin = ocean_freight_aed * (1 + margin)
    final_price_aed = math.ceil(with_margin / 10) * 10
    final_price_usd = math.ceil(final_price_aed / EXCHANGE_RATE)
    margin_amount = round(with_margin - ocean_freight_aed, 2)
    return {
        "final_price_aed": final_price_aed,
        "final_price_usd": final_price_usd,
        "margin_amount": margin_amount,
        "ocean_freight_aed": round(ocean_freight_aed, 2),
    }


def calculate_door_price(ocean_freight_usd, qty, container_type, carrier,
                         delivery_address, do_charges, dest_charges, transp_charges, margin):
    """Door service pricing with all charge components."""
    do_col = get_do_col(container_type)
    dest_col = get_dest_col(container_type)
    ocean_freight_aed = ocean_freight_usd * EXCHANGE_RATE

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
    subtotal_aed = ocean_freight_aed + do_total + dest_total + transp_total
    with_margin = subtotal_aed * (1 + margin)
    final_price_aed = math.ceil(with_margin / 10) * 10
    final_price_usd = math.ceil(final_price_aed / EXCHANGE_RATE)

    return {
        "final_price_aed": final_price_aed,
        "final_price_usd": final_price_usd,
        "ocean_freight_aed": round(ocean_freight_aed, 2),
        "do_total": round(do_total, 2),
        "dest_total": round(dest_total, 2),
        "transp_total": round(transp_total, 2),
        "subtotal_aed": round(subtotal_aed, 2),
        "margin_amount": round(with_margin - subtotal_aed, 2),
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
                               delivery_address, do_charges, dest_charges, transp_charges, margin):
    """Door service pricing for mixed container types on a single route.

    Sums per-type DO and destination charges across all container types,
    then applies margin to the combined total.
    """
    ocean_freight_aed = ocean_freight_usd * EXCHANGE_RATE
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
    subtotal_aed = ocean_freight_aed + do_total + dest_total + transp_total
    with_margin = subtotal_aed * (1 + margin)
    final_price_aed = math.ceil(with_margin / 10) * 10
    final_price_usd = math.ceil(final_price_aed / EXCHANGE_RATE)

    return {
        "final_price_aed": final_price_aed,
        "final_price_usd": final_price_usd,
        "ocean_freight_aed": round(ocean_freight_aed, 2),
        "do_total": round(do_total, 2),
        "dest_total": round(dest_total, 2),
        "transp_total": round(transp_total, 2),
        "subtotal_aed": round(subtotal_aed, 2),
        "margin_amount": round(with_margin - subtotal_aed, 2),
    }


def calculate_full_pricing(rfq, quote, do_charges, dest_charges, transp_charges, margin):
    """Master pricing function. Handles single and multi-shipment RFQs.

    Key: shipment_count = len(prices), i.e. 1 price per route.
    Container types within a route are display metadata grouped by _group_containers_by_route.
    """
    all_cts = parse_multi_value(rfq.get("container_type"))
    all_qtys = parse_multi_value(rfq.get("qty"))
    pols = parse_multi_value(rfq.get("pol"))
    pods = parse_multi_value(rfq.get("pod"))
    prices = parse_multi_value(quote.get("price"))
    carrier = (quote.get("carrier") or "N/A").strip()

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
            result = calculate_port_price(ocean_freight_usd, total_qty, margin)
        else:
            delivery_addr = (delivery_addrs[i] if i < len(delivery_addrs) else delivery_addrs[0]) if delivery_addrs else None
            if len(rg["cts"]) > 1:
                result = calculate_door_price_multi(
                    ocean_freight_usd, rg["cts"], rg["qtys"], carrier,
                    delivery_addr, do_charges, dest_charges, transp_charges, margin
                )
            else:
                result = calculate_door_price(
                    ocean_freight_usd, total_qty, rg["cts"][0], carrier,
                    delivery_addr, do_charges, dest_charges, transp_charges, margin
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

        shipments.append(result)
        grand_total_aed += result["final_price_aed"]
        grand_total_usd += result["final_price_usd"]

    return {
        "shipments": shipments,
        "grand_total_aed": grand_total_aed,
        "grand_total_usd": round(grand_total_usd, 2),
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


# =====================================================================
# QUOTATION EMAIL
# =====================================================================
def _build_quotation_html(rfq_id, rfq_data, pricing, quote_data):
    """Build HTML email body for the customer quotation."""
    shipments_html = ""
    for s in pricing["shipments"]:
        container_display = s.get('container_display', 'N/A')
        shipments_html += f"""
        <tr>
            <td style="padding:8px;border:1px solid #ddd;">{s.get('pol','N/A')} &rarr; {s.get('pod','N/A')}</td>
            <td style="padding:8px;border:1px solid #ddd;">{container_display}</td>
            <td style="padding:8px;border:1px solid #ddd;">{s.get('carrier','N/A')}</td>
            <td style="padding:8px;border:1px solid #ddd;font-weight:bold;">AED {s['final_price_aed']:,.0f}</td>
        </tr>"""

    etd = quote_data.get("etd") or "TBC"
    transit_time = quote_data.get("transit_time") or "TBC"
    free_time = quote_data.get("free_time") or "TBC"
    validity = quote_data.get("validity") or "TBC"
    service_type = pricing["shipments"][0].get("service_type", "port-to-port") if pricing["shipments"] else "port-to-port"
    service_label = service_type.replace("-", " to ").title()

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
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Price (AED)</th>
            </tr>
            {shipments_html}
            <tr style="background:#f9fafb;font-weight:bold;">
                <td colspan="3" style="padding:8px;border:1px solid #ddd;text-align:right;">Total</td>
                <td style="padding:8px;border:1px solid #ddd;">AED {pricing['grand_total_aed']:,.0f}</td>
            </tr>
        </table>

        <h3 style="color:#374151;">Service Details</h3>
        <ul>
            <li><strong>Service:</strong> {service_label}</li>
            <li><strong>ETD:</strong> {etd}</li>
            <li><strong>Transit Time:</strong> {transit_time} days</li>
            <li><strong>Free Time:</strong> {free_time} days</li>
            <li><strong>Validity:</strong> {validity}</li>
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


def _notify_sales(gmail_service, rfq_id, rfq_data, pricing, customer_email, carrier, agent_name):
    """Send enriched notification email to sales team after quotation."""
    sales_email = "hafisjavad9@gmail.com"
    total_aed = pricing["grand_total_aed"]
    total_usd = pricing["grand_total_usd"]

    # Build shipment rows for the breakdown table
    rows_html = ""
    for s in pricing["shipments"]:
        container_display = s.get('container_display', 'N/A')
        rows_html += (
            f"<tr>"
            f"<td style='padding:6px 10px;border:1px solid #e0e0e0;'>{s.get('pol','N/A')} &rarr; {s.get('pod','N/A')}</td>"
            f"<td style='padding:6px 10px;border:1px solid #e0e0e0;'>{container_display}</td>"
            f"<td style='padding:6px 10px;border:1px solid #e0e0e0;'>{s.get('carrier','N/A')}</td>"
            f"<td style='padding:6px 10px;border:1px solid #e0e0e0;text-align:right;'>AED {s['final_price_aed']:,.0f}</td>"
            f"</tr>"
        )

    service_type = rfq_data.get("service_type", "port-to-port")
    ready_date = rfq_data.get("ready_date", "N/A")

    subject = f"Quotation Sent - {rfq_id} - AED {total_aed:,.0f}"
    body_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h3 style="color:#1a56db;">Quotation Sent for {rfq_id}</h3>
        <table style="border-collapse:collapse;margin:10px 0;">
            <tr><td style="padding:4px 10px;color:#666;">Customer</td><td style="padding:4px 10px;font-weight:bold;">{customer_email}</td></tr>
            <tr><td style="padding:4px 10px;color:#666;">Agent</td><td style="padding:4px 10px;font-weight:bold;">{agent_name}</td></tr>
            <tr><td style="padding:4px 10px;color:#666;">Carrier</td><td style="padding:4px 10px;font-weight:bold;">{carrier}</td></tr>
            <tr><td style="padding:4px 10px;color:#666;">Service</td><td style="padding:4px 10px;">{service_type}</td></tr>
            <tr><td style="padding:4px 10px;color:#666;">Ready Date</td><td style="padding:4px 10px;">{ready_date}</td></tr>
        </table>

        <h4 style="margin-top:16px;">Shipment Breakdown</h4>
        <table style="width:100%;border-collapse:collapse;margin:8px 0;">
            <tr style="background:#f3f4f6;">
                <th style="padding:6px 10px;border:1px solid #e0e0e0;text-align:left;">Route</th>
                <th style="padding:6px 10px;border:1px solid #e0e0e0;text-align:left;">Containers</th>
                <th style="padding:6px 10px;border:1px solid #e0e0e0;text-align:left;">Carrier</th>
                <th style="padding:6px 10px;border:1px solid #e0e0e0;text-align:right;">Price</th>
            </tr>
            {rows_html}
            <tr style="font-weight:bold;background:#f9fafb;">
                <td colspan="3" style="padding:6px 10px;border:1px solid #e0e0e0;text-align:right;">Total</td>
                <td style="padding:6px 10px;border:1px solid #e0e0e0;text-align:right;">AED {total_aed:,.0f} (USD {total_usd:,.2f})</td>
            </tr>
        </table>
    </div>"""

    message = (
        f"To: {sales_email}\n"
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
    gmail_service = get_google_services()
    supabase = get_supabase_client()
    workspace_id = request.workspace_id

    # 1. Fetch the RFQ from Supabase
    rfq_rows = _get_by_filter(supabase, "master_rfqs", "rfq_id", request.rfq_id, workspace_id)
    if not rfq_rows:
        raise Exception(
            f"RFQ '{request.rfq_id}' not found in master_rfqs for workspace '{workspace_id}'"
        )
    rfq_data = rfq_rows[0]

    print(f"Found RFQ {request.rfq_id}")

    # 2. Update status to "Selected" and set selected_agent
    supabase.table("master_rfqs").update({
        "status": "Selected",
        "selected_agent": request.selected_agent
    }).eq("workspace_id", workspace_id).eq("rfq_id", request.rfq_id).execute()
    print(f"Updated RFQ status to Selected, agent: {request.selected_agent}")

    # 3. Find the selected quote
    all_quotes = _get_by_filter(
        supabase, "agent_outbound_log", "rfq_id", request.rfq_id, workspace_id
    )
    quote_data = _find_selected_quote(all_quotes, request)
    print(f"Found quote: carrier={quote_data.get('carrier')}, price={quote_data.get('price')}")

    # 4. Read pricing lookup tables directly as dicts
    do_charges = _get_table(supabase, "do_charges", workspace_id)
    dest_charges = _get_table(supabase, "destination_charges", workspace_id)
    transp_charges = _get_table(supabase, "transportation_charges", workspace_id)

    # 5. Calculate pricing
    pricing = calculate_full_pricing(
        rfq_data,
        quote_data,
        do_charges,
        dest_charges,
        transp_charges,
        request.margin
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
    _notify_sales(gmail_service, request.rfq_id, rfq_data, pricing,
                  customer_email or "N/A", request.selected_carrier,
                  request.selected_agent)

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
