import os
import math
import base64
from datetime import datetime
from typing import Optional

import modal
from pydantic import BaseModel, Field
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# =====================================================================
# MODAL APP DEFINITION
# =====================================================================
app = modal.App("select-and-quote-phase-3")

image = modal.Image.debian_slim().pip_install(
    "google-api-python-client",
    "google-auth-httplib2",
    "google-auth-oauthlib",
    "pydantic",
    "fastapi"
).add_local_file(
    os.path.join(os.path.dirname(__file__), "token.json"),
    "/root/token.json"
)

SPREADSHEET_ID = "1q3qSLQMvj_t7n_Iq2dM5CVL4gmWmAYWrVI55AMJNrog"

# =====================================================================
# REQUEST / RESPONSE MODELS
# =====================================================================
class SelectAgentRequest(BaseModel):
    rfq_id: str
    selected_agent: str
    selected_carrier: str
    shipment_number: str = "1"
    selected_by: str = "dashboard"

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
        scopes=[
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/spreadsheets"
        ]
    )

    gmail_service = build('gmail', 'v1', credentials=credentials)
    sheets_service = build('sheets', 'v4', credentials=credentials)
    return gmail_service, sheets_service

# =====================================================================
# PRICING ENGINE (Python port of dashboard/src/lib/pricing-engine.ts)
# =====================================================================
USD_TO_AED = 3.685
MARGIN = 0.13


def parse_multi_value(value):
    """Parse newline-separated multi-shipment values."""
    if not value:
        return ["N/A"]
    value = str(value)
    if "\n" in value:
        return [v.strip() for v in value.split("\n")]
    return [value]


def _parse_sheet_to_dicts(sheet_result):
    """Convert raw sheet values to list of dicts using header row."""
    rows = sheet_result.get('values', [])
    if len(rows) < 2:
        return []
    headers = rows[0]
    result = []
    for row in rows[1:]:
        d = {}
        for i, h in enumerate(headers):
            d[h] = row[i] if i < len(row) else None
        result.append(d)
    return result


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
    return all_do[0] if all_do else None


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


def calculate_port_price(ocean_freight_usd, qty):
    """Port-to-port pricing calculation."""
    ocean_freight_aed = ocean_freight_usd * USD_TO_AED
    with_margin = ocean_freight_aed * (1 + MARGIN)
    final_price_aed = math.ceil(with_margin / 10) * 10
    final_price_usd = round(final_price_aed / USD_TO_AED, 2)
    margin_amount = round(with_margin - ocean_freight_aed, 2)
    return {
        "final_price_aed": final_price_aed,
        "final_price_usd": final_price_usd,
        "margin_amount": margin_amount,
        "ocean_freight_aed": round(ocean_freight_aed, 2),
    }


def calculate_door_price(ocean_freight_usd, qty, container_type, carrier,
                         delivery_address, do_charges, dest_charges, transp_charges):
    """Door service pricing with all charge components."""
    do_col = get_do_col(container_type)
    dest_col = get_dest_col(container_type)
    ocean_freight_aed = ocean_freight_usd * USD_TO_AED

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
    with_margin = subtotal_aed * (1 + MARGIN)
    final_price_aed = math.ceil(with_margin / 10) * 10
    final_price_usd = round(final_price_aed / USD_TO_AED, 2)

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


def calculate_full_pricing(rfq, quote, do_charges, dest_charges, transp_charges):
    """Master pricing function. Handles single and multi-shipment RFQs."""
    container_types = parse_multi_value(rfq.get("container_type"))
    quantities = parse_multi_value(rfq.get("qty"))
    pols = parse_multi_value(rfq.get("pol"))
    pods = parse_multi_value(rfq.get("pod"))
    carriers = parse_multi_value(quote.get("carrier"))
    prices = parse_multi_value(quote.get("price"))

    service_type = (rfq.get("service_type") or "port-to-port").lower().strip()
    is_port_only = service_type == "port-to-port"
    has_delivery = service_type in ("port-to-door", "door-to-door")
    shipment_count = max(len(container_types), len(quantities), len(prices))

    shipments = []
    grand_total_aed = 0
    grand_total_usd = 0

    for i in range(shipment_count):
        ct = container_types[i] if i < len(container_types) else container_types[0]
        qty_str = quantities[i] if i < len(quantities) else quantities[0]
        try:
            qty = int(qty_str)
        except (ValueError, TypeError):
            qty = 1
        carrier = carriers[i] if i < len(carriers) else carriers[0]
        price_str = prices[i] if i < len(prices) else prices[0]
        try:
            ocean_freight_usd = float(price_str)
        except (ValueError, TypeError):
            ocean_freight_usd = 0

        if is_port_only:
            result = calculate_port_price(ocean_freight_usd, qty)
        else:
            delivery_addr = rfq.get("delivery_address") if has_delivery else None
            result = calculate_door_price(
                ocean_freight_usd, qty, ct, carrier,
                delivery_addr, do_charges, dest_charges, transp_charges
            )

        result["shipment_number"] = i + 1
        result["service_type"] = service_type
        result["pol"] = pols[i] if i < len(pols) else pols[0]
        result["pod"] = pods[i] if i < len(pods) else pods[0]
        result["container_type"] = ct
        result["qty"] = qty
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
# SHEETS HELPERS
# =====================================================================
def _col_letter(index):
    """Convert 0-based column index to Excel-style letter (0=A, 25=Z, 26=AA)."""
    result = ""
    while True:
        result = chr(index % 26 + ord('A')) + result
        index = index // 26 - 1
        if index < 0:
            break
    return result


def _read_sheet(sheets_service, sheet_name):
    """Read all rows from a sheet and return (headers, rows, raw_result)."""
    result = sheets_service.spreadsheets().values().get(
        spreadsheetId=SPREADSHEET_ID, range=f'{sheet_name}!A:Z'
    ).execute()
    rows = result.get('values', [])
    headers = rows[0] if rows else []
    return headers, rows[1:] if len(rows) > 1 else [], result


def _find_rfq_row(headers, rows, rfq_id):
    """Find the RFQ row index (0-based within data rows) and return it as a dict."""
    try:
        rfq_id_idx = headers.index("rfq_id")
    except ValueError:
        raise Exception("Column 'rfq_id' not found in Master_RFQs headers")

    for i, row in enumerate(rows):
        if len(row) > rfq_id_idx and row[rfq_id_idx] == rfq_id:
            row_dict = {}
            for j, h in enumerate(headers):
                row_dict[h] = row[j] if j < len(row) else None
            return i, row_dict

    raise Exception(f"RFQ '{rfq_id}' not found in Master_RFQs")


def _update_cell(sheets_service, sheet_name, row_index, col_index, value):
    """Update a single cell. row_index is 1-based (header=1, first data=2)."""
    cell_ref = f"{sheet_name}!{_col_letter(col_index)}{row_index}"
    sheets_service.spreadsheets().values().update(
        spreadsheetId=SPREADSHEET_ID,
        range=cell_ref,
        valueInputOption="USER_ENTERED",
        body={'values': [[value]]}
    ).execute()


# =====================================================================
# QUOTATION EMAIL
# =====================================================================
def _build_quotation_html(rfq_id, rfq_data, pricing, quote_data):
    """Build HTML email body for the customer quotation."""
    shipments_html = ""
    for s in pricing["shipments"]:
        shipments_html += f"""
        <tr>
            <td style="padding:8px;border:1px solid #ddd;">{s.get('pol','N/A')} → {s.get('pod','N/A')}</td>
            <td style="padding:8px;border:1px solid #ddd;">{s.get('container_type','N/A')}</td>
            <td style="padding:8px;border:1px solid #ddd;">{s.get('qty',1)}</td>
            <td style="padding:8px;border:1px solid #ddd;">{s.get('carrier','N/A')}</td>
            <td style="padding:8px;border:1px solid #ddd;font-weight:bold;">AED {s['final_price_aed']:,.0f}</td>
        </tr>"""

    etd = quote_data.get("etd") or "TBC"
    transit_time = quote_data.get("transit_time") or "TBC"
    free_time = quote_data.get("free_time") or "TBC"
    validity = quote_data.get("validity") or "TBC"

    return f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2 style="color:#1a56db;">Quotation — {rfq_id}</h2>
        <p>Dear Customer,</p>
        <p>Thank you for your inquiry. Please find our quotation below:</p>

        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr style="background:#f3f4f6;">
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Route</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Container</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Qty</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Carrier</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Price (AED)</th>
            </tr>
            {shipments_html}
            <tr style="background:#f9fafb;font-weight:bold;">
                <td colspan="4" style="padding:8px;border:1px solid #ddd;text-align:right;">Total</td>
                <td style="padding:8px;border:1px solid #ddd;">AED {pricing['grand_total_aed']:,.0f}</td>
            </tr>
        </table>

        <h3 style="color:#374151;">Service Details</h3>
        <ul>
            <li><strong>ETD:</strong> {etd}</li>
            <li><strong>Transit Time:</strong> {transit_time} days</li>
            <li><strong>Free Time:</strong> {free_time} days</li>
            <li><strong>Validity:</strong> {validity}</li>
        </ul>

        <h3 style="color:#374151;">Terms & Conditions</h3>
        <ul>
            <li>Prices are all-inclusive (port-to-port) unless stated otherwise</li>
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
    if messages:
        last_msg = messages[-1]
        msg_headers = {h['name']: h['value'] for h in last_msg.get('payload', {}).get('headers', [])}
        reference_msg_id = msg_headers.get('Message-ID', '')

    body_html = _build_quotation_html(rfq_id, rfq_data, pricing, quote_data)

    raw_msg = (
        f"To: {customer_email}\n"
        f"In-Reply-To: {reference_msg_id}\n"
        f"References: {reference_msg_id}\n"
        f"Subject: Re: Quotation - {rfq_id}\n"
        f"Content-Type: text/html; charset=utf-8\n\n{body_html}"
    )

    b64_message = base64.urlsafe_b64encode(raw_msg.encode('utf-8')).decode('utf-8')
    gmail_service.users().messages().send(userId='me', body={
        'raw': b64_message,
        'threadId': thread_id
    }).execute()
    print(f"Quotation email sent to {customer_email} on thread {thread_id}")


def _notify_sales(gmail_service, rfq_id, final_price_aed, final_price_usd, customer_email, carrier):
    """Send notification email to sales team after quotation."""
    sales_email = "hafisjavad9@gmail.com"
    subject = f"Quotation Sent - {rfq_id} - AED {final_price_aed:,.0f}"
    body_html = (
        f"<h3>Quotation Sent for {rfq_id}</h3>"
        f"<ul>"
        f"<li><strong>Customer:</strong> {customer_email}</li>"
        f"<li><strong>Carrier:</strong> {carrier}</li>"
        f"<li><strong>Final Price:</strong> AED {final_price_aed:,.0f} (USD {final_price_usd:,.2f})</li>"
        f"</ul>"
        f"<p><a href='https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit'>View in Sheets</a></p>"
    )

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
    secrets=[modal.Secret.from_dotenv(__file__)]
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
    gmail_service, sheets_service = get_google_services()

    # 1. Read Master_RFQs and find the RFQ
    rfq_headers, rfq_rows, _ = _read_sheet(sheets_service, "Master_RFQs")
    rfq_row_idx, rfq_data = _find_rfq_row(rfq_headers, rfq_rows, request.rfq_id)
    rfq_sheet_row = rfq_row_idx + 2  # +1 for header, +1 for 1-based

    print(f"Found RFQ {request.rfq_id} at sheet row {rfq_sheet_row}")

    # 2. Update status to "Selected" and set selected_agent
    status_col = rfq_headers.index("status")
    agent_col = rfq_headers.index("selected_agent")
    _update_cell(sheets_service, "Master_RFQs", rfq_sheet_row, status_col, "Selected")
    _update_cell(sheets_service, "Master_RFQs", rfq_sheet_row, agent_col, request.selected_agent)
    print(f"Updated RFQ status to Selected, agent: {request.selected_agent}")

    # 3. Find the selected quote in Agent_Outbound_Log
    quote_headers, quote_rows, _ = _read_sheet(sheets_service, "Agent_Outbound_Log")
    quote_data = _find_selected_quote(quote_headers, quote_rows, request)
    print(f"Found quote: carrier={quote_data.get('carrier')}, price={quote_data.get('price')}")

    # 4. Read pricing lookup tables
    _, _, do_raw = _read_sheet(sheets_service, "DO Charges")
    _, _, dest_raw = _read_sheet(sheets_service, "Destination Charges")
    _, _, transp_raw = _read_sheet(sheets_service, "Transportation Charges")

    do_charges = _parse_sheet_to_dicts(do_raw)
    dest_charges = _parse_sheet_to_dicts(dest_raw)
    transp_charges = _parse_sheet_to_dicts(transp_raw)

    # 5. Calculate pricing
    pricing = calculate_full_pricing(rfq_data, quote_data, do_charges, dest_charges, transp_charges)
    print(f"Pricing calculated: AED {pricing['grand_total_aed']:,.0f} / USD {pricing['grand_total_usd']:,.2f}")

    # 6. Update Master_RFQs with final pricing
    now_str = datetime.now().strftime('%Y-%m-%d %I:%M %p')
    price_aed_col = rfq_headers.index("final_price_aed")
    price_usd_col = rfq_headers.index("final_price_usd")
    quoted_at_col = rfq_headers.index("quoted_at")

    _update_cell(sheets_service, "Master_RFQs", rfq_sheet_row, status_col, "Quoted")
    _update_cell(sheets_service, "Master_RFQs", rfq_sheet_row, price_aed_col, pricing["grand_total_aed"])
    _update_cell(sheets_service, "Master_RFQs", rfq_sheet_row, price_usd_col, pricing["grand_total_usd"])
    _update_cell(sheets_service, "Master_RFQs", rfq_sheet_row, quoted_at_col, now_str)
    print(f"Master_RFQs updated with pricing and status=Quoted")

    # 7. Send quotation email on original thread
    thread_id = rfq_data.get("thread_id")
    customer_email = rfq_data.get("customer_email")

    if thread_id and customer_email:
        _send_quotation_email(gmail_service, customer_email, thread_id,
                              request.rfq_id, rfq_data, pricing, quote_data)
    else:
        print(f"Warning: Missing thread_id or customer_email, skipping quotation email")

    # 8. Notify sales team
    _notify_sales(gmail_service, request.rfq_id, pricing["grand_total_aed"],
                  pricing["grand_total_usd"], customer_email or "N/A",
                  request.selected_carrier)

    return {
        "success": True,
        "rfq_id": request.rfq_id,
        "final_price_aed": pricing["grand_total_aed"],
        "final_price_usd": pricing["grand_total_usd"],
    }


def _find_selected_quote(headers, rows, request: SelectAgentRequest) -> dict:
    """Find the matching quote from Agent_Outbound_Log."""
    try:
        rfq_id_idx = headers.index("rfq_id") if "rfq_id" in headers else None
        match_idx = headers.index("match") if "match" in headers else None
        carrier_idx = headers.index("carrier")
        shipment_idx = headers.index("shipment_number") if "shipment_number" in headers else None
    except ValueError as e:
        raise Exception(f"Missing required column in Agent_Outbound_Log: {e}")

    for row in rows:
        # Match by rfq_id column if it exists, otherwise by match column prefix
        rfq_match = False
        if rfq_id_idx is not None and len(row) > rfq_id_idx:
            rfq_match = row[rfq_id_idx] == request.rfq_id
        elif match_idx is not None and len(row) > match_idx:
            rfq_match = row[match_idx].startswith(request.rfq_id + "_")

        if not rfq_match:
            continue

        # Match carrier
        if len(row) > carrier_idx and (row[carrier_idx] or "").upper().strip() == request.selected_carrier.upper().strip():
            # Match shipment number if specified
            if shipment_idx is not None and len(row) > shipment_idx:
                if str(row[shipment_idx]) != str(request.shipment_number):
                    continue

            # Build dict from row
            quote_dict = {}
            for j, h in enumerate(headers):
                quote_dict[h] = row[j] if j < len(row) else None
            return quote_dict

    raise Exception(
        f"Quote not found for rfq_id={request.rfq_id}, "
        f"carrier={request.selected_carrier}, shipment={request.shipment_number}"
    )


if __name__ == "__main__":
    app.serve()
