import os
import re
import json
import base64
from datetime import datetime, timezone, timedelta
from typing import List, Optional

UAE_TZ = timezone(timedelta(hours=4))

import modal
from pydantic import BaseModel, Field, field_validator
import openai
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from tenant_context import (
    extract_pubsub_mailbox,
    resolve_workspace_id,
    scoped_select,
    scoped_eq_filter,
    scoped_upsert,
)

# =====================================================================
# MODAL APP DEFINITION
# =====================================================================
app = modal.App("quote-analysis-phase-2")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "google-api-python-client",
    "google-auth-httplib2",
    "google-auth-oauthlib",
    "openai",
    "pydantic",
    "fastapi",
    "supabase"
).add_local_file(
    os.path.join(os.path.dirname(__file__), "token.json"),
    "/root/token.json"
)

ADMIN_EMAIL = "hafisjavad9@gmail.com"
OWN_EMAIL = os.environ.get("OWN_EMAIL", "yunapink05@gmail.com")
QUOTE_THRESHOLD = 2  # Minimum valid quotes before notifying manager

# =====================================================================
# CORE DATA MODELS
# =====================================================================
class QuoteData(BaseModel):
    shipment_number: int = Field(1, description="Shipment block number from original request")
    price: Optional[float] = Field(None, description="Total ocean freight amount quoted")
    currency: str = Field("USD", description="Currency code")
    carrier: str = Field("N/A", description="Carrier Name (e.g. COSCO, MAERSK)")
    validity: Optional[str] = Field(None, description="Expiry date YYYY-MM-DD")
    transit_time: Optional[int] = Field(None, description="Transit time in days")
    free_time: Optional[int] = Field(None, description="Free detention/demurrage days")
    etd: Optional[str] = Field(None, description="Estimated departure YYYY-MM-DD")

    @field_validator('price', mode='before')
    @classmethod
    def coerce_price(cls, v):
        if isinstance(v, str):
            try:
                return float(v.replace(',', ''))
            except ValueError:
                return None
        return v

    @field_validator('transit_time', 'free_time', mode='before')
    @classmethod
    def coerce_int_field(cls, v):
        if isinstance(v, str):
            try:
                return int(v)
            except ValueError:
                return None
        return v

class ExtractedQuotes(BaseModel):
    extraction_reasoning: str = Field(description="Step-by-step reasoning linking agent responses to the correct shipment numbers, multiplying per-container costs, and mapping carrier shorthands before extracting data.")
    quotes: List[QuoteData] = Field(default_factory=list, description="List of extracted rate objects")

# =====================================================================
# CARRIER NORMALIZATION (ported from n8n Parse AI Output)
# =====================================================================
def normalize_carrier(carrier: str) -> str:
    """Normalize carrier name to standard format."""
    if not carrier or not isinstance(carrier, str):
        return 'N/A'
    c = carrier.strip().upper()
    if 'COSCO' in c:
        return 'COSCO'
    if 'EVERGREEN' in c:
        return 'EVERGREEN'
    if 'MEDITERRANEAN' in c or c == 'MSC':
        return 'MSC'
    if c == 'ONE' or 'OCEAN NETWORK' in c:
        return 'ONE'
    if 'MAERSK' in c:
        return 'MAERSK'
    if 'HAPAG' in c or 'LLOYD' in c:
        return 'HAPAG-LLOYD'
    if 'CMA' in c or 'CGM' in c:
        return 'CMA CGM'
    if 'YANG MING' in c or c == 'YML':
        return 'YANG MING'
    if 'HMM' in c or 'HYUNDAI' in c:
        return 'HMM'
    if c == 'PIL' or c == 'PACIFIC INTERNATIONAL LINES':
        return 'PIL'
    if 'ZIM' in c:
        return 'ZIM'
    return c

# =====================================================================
# GOOGLE APIS
# =====================================================================
def get_google_services():
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
# SUPABASE HELPERS
# =====================================================================
def _read_table(supabase, table_name, workspace_id=None):
    data = scoped_select(supabase, table_name, workspace_id) if workspace_id else supabase.table(table_name).select("*").execute().data
    if not data:
        return [], []
    headers = list(data[0].keys())
    rows = []
    for row_dict in data:
        row_arr = [row_dict.get(h, "") for h in headers]
        rows.append([str(v) if v is not None else "" for v in row_arr])
    return headers, rows

def _upsert_row(supabase, table_name, row_data: dict, workspace_id=None):
    """Upsert a row via Supabase"""
    if workspace_id:
        scoped_upsert(supabase, table_name, workspace_id, row_data)
    else:
        supabase.table(table_name).upsert(row_data).execute()

def _get_rows_by_filter(supabase, table_name, filter_column, filter_value, workspace_id=None):
    """Get all rows where filter_column == filter_value."""
    if workspace_id:
        return scoped_eq_filter(supabase, table_name, workspace_id, filter_column, filter_value)
    result = supabase.table(table_name).select("*").eq(filter_column, filter_value).execute()
    return result.data

# =====================================================================
# EMAIL HELPERS
# =====================================================================
def extract_email_body(payload) -> str:
    """Recursively extract text from email payload."""
    plain_parts = []
    html_parts = []

    def _collect(node):
        mime = node.get('mimeType', '')
        if 'parts' not in node:
            data = node.get('body', {}).get('data')
            if data:
                decoded = base64.urlsafe_b64decode(data).decode('utf-8', errors='replace')
                if mime == 'text/plain':
                    plain_parts.append(decoded)
                elif mime == 'text/html':
                    html_parts.append(decoded)
            return
        for part in node['parts']:
            _collect(part)

    _collect(payload)
    if plain_parts:
        return "\n".join(plain_parts)
    if html_parts:
        raw = "\n".join(html_parts)
        raw = re.sub(r'</t[dh]>', ' | ', raw)
        raw = re.sub(r'</tr>', '\n', raw)
        return re.sub(r'<[^>]+>', '', raw)
    return ""

def send_email(gmail_service, to_address, subject, body, content_type="text/plain"):
    ct_header = f"Content-Type: {content_type}; charset=utf-8\n" if content_type != "text/plain" else ""
    raw_msg = f"To: {to_address}\n{ct_header}Subject: {subject}\n\n{body}"
    b64_message = base64.urlsafe_b64encode(raw_msg.encode('utf-8')).decode('utf-8')
    gmail_service.users().messages().send(userId='me', body={'raw': b64_message}).execute()

def _gmail_call_with_backoff(request, retries=4, base_delay=2):
    """Execute a Gmail API request with exponential backoff on rate limit errors."""
    import time
    from googleapiclient.errors import HttpError
    for attempt in range(retries):
        try:
            return request.execute()
        except HttpError as e:
            if e.resp.status in (429, 403) and attempt < retries - 1:
                delay = base_delay * (2 ** attempt)
                print(f"Gmail rate limit hit (attempt {attempt+1}), retrying in {delay}s...")
                time.sleep(delay)
            else:
                raise

# =====================================================================
# AI SYSTEM PROMPT (ported from n8n)
# =====================================================================
AI_SYSTEM_PROMPT = """You are a Freight Rate Parser. Extract shipping rate data from freight agent reply emails. The original request may have contained ONE or MULTIPLE distinct shipments.

## CRITICAL CONCEPT: What is a "Shipment"?

A shipment is a distinct ROUTING block (POL → POD), NOT an individual container. Mixed container types on the same route are ONE shipment — the agent quotes a combined total price for all containers on that route.

| Scenario | Shipment Count |
|---|---|
| 3 x 40FT, one route | **1 shipment** |
| 2 x 40FT + 1 x 20FT, same route | **1 shipment** (mixed containers, one route) |
| 1 x 20FT SHANGHAI→JEBEL ALI + 2 x 40HC NINGBO→HAMAD PORT | **2 shipments** (different routes) |
| Original email shows "[Shipment 1 of 3]" through "[Shipment 3 of 3]" | **3 shipments** |

**Container quantity or type mix within a single route NEVER creates multiple shipments.**

## CHAIN OF THOUGHT REASONING
Before extracting the shipments, you MUST write an `extraction_reasoning` paragraph.
Think step-by-step:
1. Did the agent quote or decline?
2. If quoted: What shipments are they quoting (Shipment 1, 2, etc)? Match the shipment_number from the original "[Shipment X of Y]" blocks.
3. Is the quote provided as a total amount, or per-container? If per container, state the math (e.g. $1000 x 2 = $2000 total).
4. If the route has mixed container types (e.g. 2x40FT + 1x20FT), sum ALL per-container costs into ONE total price for that shipment.
5. Identify the Carrier and map it to the recognized UPPERCASE shorthand (e.g. Cosco Shipping -> COSCO).
6. Extract validity, transit, and free days.

## OUTPUT FORMAT

Return exactly this JSON structure. No markdown, no backticks, no explanation text — raw JSON only.

```json
{
  "extraction_reasoning": "Your step-by-step thoughts...",
  "quotes": [
    {
      "shipment_number": 1,
      "price": 1200,
      "currency": "USD",
      "carrier": "COSCO",
      "validity": "2026-03-13",
      "transit_time": 22,
      "free_time": 14,
      "etd": "2026-03-15"
    }
  ]
}
```

## FIELD RULES

**shipment_number**: Integer matching the "[Shipment X of Y]" block number from the original request (1, 2, 3...). If the original had no numbered blocks, use 1.

**price**: Total ocean freight amount quoted for that shipment (all containers combined).
null if agent declines or provides no rate. If the agent gives a per-container rate, multiply by each container's quantity and SUM all container types to get the total shipment price.

**currency**: Always "USD".

**carrier**: UPPERCASE. Normalize: "Cosco Shipping"→"COSCO", "Evergreen Line"→"EVERGREEN", "Ocean Network Express"→"ONE", "Mediterranean Shipping"→"MSC", "Hapag-Lloyd"→"HAPAG-LLOYD", "CMA CGM"→"CMA CGM", "Yang Ming"→"YANG MING", "HMM"→"HMM", "PIL"→"PIL", "ZIM"→"ZIM".

**validity**: Quote expiry as YYYY-MM-DD. null if not specified.
**transit_time**: Integer days port-to-port. null if not specified.
**free_time**: Integer days free detention/demurrage. null if not specified.
**etd**: Estimated departure as YYYY-MM-DD. null if not specified.

## MULTI-SHIPMENT HANDLING

- Agent gives ONE price covering ALL shipments → create one quote object per shipment number with identical values
- Agent gives DIFFERENT prices per shipment → create one quote object per shipment with respective values
- Shared fields (carrier, validity, transit_time, free_time) stated once → copy to all quote objects
- Agent offers multiple carriers for same shipment → Return ALL options as separate quote objects with the same shipment_number

## SPECIAL CASES

| Scenario | Action |
|---|---|
| Agent declines all or has no space | Return {"quotes": []} |
| Rate is per CBM or per ton | Return {"extraction_reasoning": "...", "quotes": []} |
| Agent gives rate "per container" explicitly | Multiply by each container type's quantity and sum all into one total shipment price |
| ETD given as a range | Use the earlier/first date |

## FEW-SHOT EXAMPLES

**Example 1: Single container type**
**Input:**
Subject: Re: RFQ: 3x40HC Shanghai to Jebel Ali [Ref:RFQ-20260221-A9B]
Body:
Hi,
For Shipment 1, we can offer Cosco Shipping at USD 1,500/40HC.
Valid till 15th March. TT is 18 days. Free time 14 days dest.
Regards

**Output:**
```json
{
  "extraction_reasoning": "The agent is quoting 'Shipment 1'. The rate given is 'USD 1,500/40HC', which means it is per container. The original subject says '3x40HC'. So the math is 1500 * 3 = 4500. The total price for the shipment is 4500. Carrier is 'Cosco Shipping', normalized to 'COSCO'. Validity is '2026-03-15'. Transit time is '18'. Free time is '14'.",
  "quotes": [
    {
      "shipment_number": 1,
      "price": 4500,
      "currency": "USD",
      "carrier": "COSCO",
      "validity": "2026-03-15",
      "transit_time": 18,
      "free_time": 14,
      "etd": null
    }
  ]
}
```

**Example 2: Mixed container types on same route (1 shipment)**
**Input:**
Subject: Re: RFQ: 2x40FT+1x20FT Shenzen to Jebel Ali [Ref:RFQ-20260222-B3C]
Body:
Hi,
40FT: RCL USD 900/ctr, 20FT: RCL USD 600/ctr
ETD 29 Mar, TT 20 days, free time 10 days, valid 20 Mar
Regards

**Output:**
```json
{
  "extraction_reasoning": "The original request has 1 route (Shenzen→Jebel Ali) with mixed containers: 2x40FT + 1x20FT. This is 1 shipment. Agent quotes 40FT at $900/ctr and 20FT at $600/ctr. Total = (900*2) + (600*1) = 1800 + 600 = 2400. Carrier is 'RCL'. ETD is 2026-03-29. Transit 20 days. Free time 10 days. Validity 2026-03-20.",
  "quotes": [
    {
      "shipment_number": 1,
      "price": 2400,
      "currency": "USD",
      "carrier": "RCL",
      "validity": "2026-03-20",
      "transit_time": 20,
      "free_time": 10,
      "etd": "2026-03-29"
    }
  ]
}
```

CRITICAL: Return ONLY the raw JSON object. No markdown, no backticks, no explanation text."""

# =====================================================================
# QUOTE COUNTING & SUMMARY BUILDER
# =====================================================================
def parse_multi_value(value):
    if not value:
        return ['N/A']
    if isinstance(value, str) and '\n' in value:
        return [v.strip() for v in value.split('\n')]
    return [str(value)]

def build_quote_summary(rfq, all_quote_rows: list) -> dict:
    """Build shipment-based quote summary with counts, rankings, and HTML."""
    # Parse multi-shipment fields from Master_RFQs
    service_type = (rfq.get('service_type') or 'port-to-port').lower().strip()
    pols = parse_multi_value(rfq.get('pol'))
    pods = parse_multi_value(rfq.get('pod'))
    container_types = parse_multi_value(rfq.get('container_type'))
    qtys = parse_multi_value(rfq.get('qty'))
    ready_dates = parse_multi_value(rfq.get('ready_date'))

    # Group containers by route (consecutive pol|pod pairs)
    route_groups = []
    prev_key = None
    for idx in range(len(container_types)):
        pol = pols[idx] if idx < len(pols) else (pols[-1] if pols else 'N/A')
        pod = pods[idx] if idx < len(pods) else (pods[-1] if pods else 'N/A')
        key = f"{pol}|{pod}"
        if key != prev_key:
            rd = ready_dates[idx] if idx < len(ready_dates) else (ready_dates[-1] if ready_dates else 'N/A')
            route_groups.append({"pol": pol, "pod": pod, "cts": [], "qtys": [], "ready_date": rd})
            prev_key = key
        route_groups[-1]["cts"].append(container_types[idx])
        route_groups[-1]["qtys"].append(qtys[idx] if idx < len(qtys) else '1')

    shipment_count = len(route_groups) or 1

    # Filter valid quotes
    valid_quotes = []
    for q in all_quote_rows:
        price_str = q.get('price', '')
        if price_str and price_str not in ('NO_QUOTE', 'N/A', 'Invalid_Quote', ''):
            try:
                p = float(str(price_str).replace(',', ''))
                if p > 0:
                    valid_quotes.append(q)
            except (ValueError, TypeError):
                pass

    # Build shipments structure (1 per route)
    shipment_quotes = []
    for i in range(shipment_count):
        rg = route_groups[i] if i < len(route_groups) else route_groups[0]
        container_display = ", ".join(f"{q} x {ct}" for ct, q in zip(rg["cts"], rg["qtys"]))
        shipment = {
            'number': i + 1,
            'pol': rg['pol'],
            'pod': rg['pod'],
            'container_display': container_display,
            'ready_date': rg['ready_date'],
            'quotes': []
        }

        for q in valid_quotes:
            ship_num = q.get('shipment_number', '1')
            try:
                ship_num_int = int(ship_num)
            except (ValueError, TypeError):
                ship_num_int = 1

            if ship_num_int == i + 1:
                try:
                    price = float(str(q.get('price', '0')).replace(',', ''))
                except (ValueError, TypeError):
                    continue
                shipment['quotes'].append({
                    'agent': q.get('agent_name', 'Unknown'),
                    'carrier': q.get('carrier', 'TBD'),
                    'price': price,
                    'etd': q.get('etd', 'N/A'),
                    'transit': q.get('transit_time', 'N/A'),
                    'free_time': q.get('free_time', 'N/A'),
                    'validity': q.get('validity', 'N/A'),
                })

        shipment['quotes'].sort(key=lambda x: x['price'])
        shipment_quotes.append(shipment)

    # Find overall best
    best_price = float('inf')
    best_agent = ''
    best_carrier = ''
    best_shipment = 0
    for s in shipment_quotes:
        if s['quotes']:
            lowest = s['quotes'][0]
            if lowest['price'] < best_price:
                best_price = lowest['price']
                best_agent = lowest['agent']
                best_carrier = lowest['carrier']
                best_shipment = s['number']

    # Build HTML summary
    html_parts = []
    for shipment in shipment_quotes:
        service_label = ''
        if service_type != 'port-to-port':
            service_label = (
                f'<span style="background: #e3f2fd; color: #1565c0; padding: 2px 8px; '
                f'border-radius: 12px; font-size: 11px; font-weight: bold; margin-left: 8px;">'
                f'🚪 {service_type.upper()}</span>'
            )

        rows_html = ""
        if not shipment['quotes']:
            rows_html = '<tr><td colspan="7" style="padding: 20px; text-align: center; color: #999;">No quotes received</td></tr>'
        else:
            for j, q in enumerate(shipment['quotes']):
                is_best = j == 0
                row_style = 'background: #e8f5e9;' if is_best else ''
                price_style = 'color: #2e7d32; font-weight: bold;' if is_best else ''
                badge = '<span style="background: #4caf50; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-right: 5px;">BEST</span>' if is_best else ''
                rows_html += f"""
                <tr style="{row_style} border-bottom: 1px solid #f0f0f0;">
                  <td style="padding: 12px; font-size: 13px;">{badge}{q['agent']}</td>
                  <td style="padding: 12px; font-size: 13px;">{q['carrier']}</td>
                  <td style="padding: 12px; font-size: 15px; text-align: right; {price_style}">${q['price']}</td>
                  <td style="padding: 12px; font-size: 13px; text-align: center;">{q['transit']} days</td>
                  <td style="padding: 12px; font-size: 13px; text-align: center;">{q['etd']}</td>
                  <td style="padding: 12px; font-size: 13px; text-align: center;">{q['free_time']} days</td>
                  <td style="padding: 12px; font-size: 13px; text-align: center;">{q['validity']}</td>
                </tr>"""

        html_parts.append(f"""
<div style="margin-bottom: 30px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
  <div style="background: #f5f5f5; padding: 12px 15px; border-bottom: 2px solid #667eea;">
    <strong style="color: #333;">SHIPMENT {shipment['number']}</strong> {service_label}
    <div style="font-size: 13px; color: #666; margin-top: 4px;">
      {shipment['pol']} → {shipment['pod']} | {shipment['container_display']} | Ready: {shipment['ready_date']}
    </div>
  </div>
  <table style="width: 100%; border-collapse: collapse;">
    <thead>
      <tr style="background: #fafafa; border-bottom: 1px solid #e0e0e0;">
        <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">Agent</th>
        <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">Carrier</th>
        <th style="padding: 10px; text-align: right; font-size: 12px; color: #666;">Price (USD)</th>
        <th style="padding: 10px; text-align: center; font-size: 12px; color: #666;">Transit</th>
        <th style="padding: 10px; text-align: center; font-size: 12px; color: #666;">ETD</th>
        <th style="padding: 10px; text-align: center; font-size: 12px; color: #666;">Free Time</th>
        <th style="padding: 10px; text-align: center; font-size: 12px; color: #666;">Valid Until</th>
      </tr>
    </thead>
    <tbody>{rows_html}</tbody>
  </table>
</div>""")

    return {
        'quote_count': len(valid_quotes),
        'threshold_met': len(valid_quotes) >= QUOTE_THRESHOLD,
        'best_price': best_price if best_price != float('inf') else None,
        'best_agent': best_agent,
        'best_carrier': best_carrier,
        'best_shipment': best_shipment,
        'rfq_ref': rfq.get('rfq_id'),
        'service_type': service_type,
        'total_responses': len(all_quote_rows),
        'summary_html': '\n'.join(html_parts),
        'shipment_quotes': shipment_quotes,
    }

# =====================================================================
# MANAGER NOTIFICATION EMAIL
# =====================================================================
def send_manager_notification(gmail_service, summary: dict):
    """Send enriched quote summary email to manager."""
    rfq_ref = summary['rfq_ref']
    quote_count = summary['quote_count']
    best_price = summary['best_price']
    best_agent = summary['best_agent']
    best_carrier = summary['best_carrier']
    best_shipment = summary['best_shipment']

    body_html = f"""
<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333;">

  <!-- Header -->
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0; font-size: 24px;">📊 Quote Review Required</h2>
    <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Pricing Automation System</p>
  </div>

  <!-- RFQ Info -->
  <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #667eea;">
    <div style="font-size: 13px; color: #666; margin-bottom: 4px;">RFQ Reference</div>
    <div style="font-size: 20px; font-weight: bold; color: #333;">{rfq_ref}</div>
    <div style="font-size: 14px; color: #666; margin-top: 8px;">
      Total Valid Quotes: <strong>{quote_count}</strong>
    </div>
  </div>

  <!-- Best Rate Card -->
  <div style="background: #e8f5e9; border: 2px solid #4caf50; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <div style="color: #2e7d32; font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px;">
      🏆 Overall Best Rate (Shipment {best_shipment})
    </div>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; color: #666; font-size: 14px;">Agent</td>
        <td style="padding: 8px 0; font-weight: bold; font-size: 14px; text-align: right;">{best_agent}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #666; font-size: 14px;">Carrier</td>
        <td style="padding: 8px 0; font-weight: bold; font-size: 14px; text-align: right;">{best_carrier}</td>
      </tr>
      <tr style="border-top: 2px solid #4caf50;">
        <td style="padding: 12px 0; color: #2e7d32; font-size: 14px; font-weight: 600;">Price</td>
        <td style="padding: 12px 0; font-weight: bold; font-size: 22px; color: #2e7d32; text-align: right;">USD ${best_price}</td>
      </tr>
    </table>
  </div>

  <!-- Shipment Tables -->
  <div style="margin: 20px 0;">
    {summary['summary_html']}
  </div>

  <!-- Action Button -->
  <div style="text-align: center; margin: 30px 0;">
    <p style="color: #666; font-size: 14px;">Review in the Evo Logistics Dashboard to proceed.</p>
  </div>

  <!-- Footer -->
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px; border-top: 1px solid #e0e0e0;">
    Automated by Pricing Automation System
  </div>
</div>
"""
    subject = f"RFQ {rfq_ref} - {quote_count} Quotes Received - Best: USD {best_price}"
    send_email(gmail_service, ADMIN_EMAIL, subject, body_html, content_type="text/html")

# =====================================================================
# EXTRACT REF ID FROM EMAIL SUBJECT
# =====================================================================
def extract_ref_id(subject: str) -> Optional[str]:
    """Extract RFQ reference ID from subject line. Format: Ref: [RFQ-YYYYMMDD-XXX]"""
    match = re.search(r'Ref:\s*\[?([A-Za-z0-9-]+)\]?', subject, re.IGNORECASE)
    return match.group(1) if match else None

def extract_agent_info(from_header: str) -> tuple:
    """Extract agent name and email from From header."""
    # "John Smith <john@example.com>" → ("John Smith", "john@example.com")
    name_match = re.match(r'^([^<]+)', from_header)
    email_match = re.search(r'<([^>]+)>', from_header)

    agent_name = name_match.group(1).strip().replace('"', '') if name_match else 'Unknown Agent'
    agent_email = email_match.group(1) if email_match else from_header.strip()

    return agent_name, agent_email

# =====================================================================
# GMAIL PUSH WEBHOOK
# =====================================================================
@app.function(
    image=image,
    secrets=[modal.Secret.from_name("evo-logistics-env")]
)
@modal.fastapi_endpoint(method="POST")
def gmail_push_phase2(_data: dict):
    """Triggered by Gmail push notification via Google Cloud Pub/Sub.
    
    IMPORTANT: Always return 200 to Pub/Sub — retries cause rate limit storms.
    """
    try:
        _process_agent_quotes(_data)
    except Exception as e:
        print(f"CRITICAL ERROR in _process_agent_quotes: {e}")
        import traceback; traceback.print_exc()
    return {"status": "ok"}

# =====================================================================
# GMAIL WATCH RENEWAL
# =====================================================================
@app.function(
    schedule=modal.Cron("0 0 */6 * *"),
    image=image,
    secrets=[modal.Secret.from_name("evo-logistics-env")]
)
def renew_gmail_watch():
    """Renews the Gmail push notification watch on INBOX."""
    gmail_service = get_google_services()
    supabase = get_supabase_client()
    topic = os.environ["GOOGLE_PUBSUB_TOPIC"]
    mailboxes = (
        supabase.table("workspace_mailboxes")
        .select("workspace_id, email, status")
        .eq("status", "connected")
        .execute()
        .data
        or []
    )
    targets = mailboxes or [{"workspace_id": "bootstrap", "email": "default"}]

    for mailbox in targets:
        result = gmail_service.users().watch(userId='me', body={
            'topicName': topic,
            'labelIds': ['INBOX']
        }).execute()
        print(
            "Gmail watch renewed for workspace "
            f"{mailbox.get('workspace_id')} ({mailbox.get('email')}): "
            f"History ID={result.get('historyId')} Expiry={result.get('expiration')}"
        )

# =====================================================================
# CORE QUOTE PROCESSING LOGIC
# =====================================================================
def _process_agent_quotes(pubsub_payload=None):
    gmail_service = get_google_services()
    supabase = get_supabase_client()
    mailbox_email = extract_pubsub_mailbox(pubsub_payload)
    workspace_id = resolve_workspace_id(supabase, mailbox_email)

    # BUG-4 Fix: Only fetch agent rate replies to prevent race condition with Phase 1
    results = _gmail_call_with_backoff(
        gmail_service.users().messages().list(userId='me', q='is:unread subject:"Ref: RFQ-"')
    )
    messages = results.get('messages', [])

    if not messages:
        print("No new emails to process.")
        return

    openai_client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    for msg in messages:
        msg_id = msg['id']
        email_data = _gmail_call_with_backoff(
            gmail_service.users().messages().get(userId='me', id=msg_id, format='full')
        )
        thread_id = email_data.get('threadId')

        # Extract metadata
        headers_dict = {h['name'].lower(): h['value'] for h in email_data['payload']['headers']}
        subject = headers_dict.get('subject', '')
        sender = headers_dict.get('from', '')
        received_at = headers_dict.get('date', '')

        # Self-sender guard: skip emails from our own address
        if OWN_EMAIL in sender.lower():
            print(f"Skipping self-sent email: {subject}")
            _gmail_call_with_backoff(
                gmail_service.users().messages().modify(
                    userId='me', id=msg_id, body={'removeLabelIds': ['UNREAD']}
                )
            )
            continue

        # Mark as read immediately to prevent re-processing
        _gmail_call_with_backoff(
            gmail_service.users().messages().modify(
                userId='me', id=msg_id, body={'removeLabelIds': ['UNREAD']}
            )
        )

        # Extract Ref ID — only process emails that have one
        ref_id = extract_ref_id(subject)
        if not ref_id:
            print(f"No Ref ID in subject, skipping: {subject}")
            continue

        agent_name, agent_email = extract_agent_info(sender)

        # Extract body
        email_body = extract_email_body(email_data['payload'])
        if not email_body.strip():
            email_body = email_data.get('snippet', '')

        print(f"Processing agent quote: {subject} from {agent_name} ({agent_email})")

        # Call AI to parse quotes
        prompt = (
            f"AGENT EMAIL:\n"
            f"Agent: {agent_name}\n"
            f"\"\"\"\n{email_body}\n\"\"\"\n\n"
            f"Today is: {datetime.now(UAE_TZ).strftime('%Y-%m-%d')}"
        )

        try:
            response = openai_client.beta.chat.completions.parse(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": AI_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                response_format=ExtractedQuotes
            )
            extracted = response.choices[0].message.parsed

            now_str = datetime.now(UAE_TZ).strftime('%Y-%m-%d %I:%M %p')

            if not extracted.quotes:
                # Agent declined or no quotes — log as invalid
                match_key = f"{ref_id}_{agent_email}"
                log_data = {
                    'rfq_id': ref_id,
                    'match': match_key,
                    'status': 'Invalid_Quote',
                    'agent_name': agent_name,
                    'agent_email': agent_email,
                    'carrier': 'N/A',
                    'price': 'N/A',
                    'currency': 'N/A',
                    'etd': 'N/A',
                    'transit_time': 'N/A',
                    'free_time': 'N/A',
                    'validity': 'N/A',
                    'received_at': now_str,
                }
                _upsert_row(supabase, "agent_outbound_log", log_data, workspace_id)
                print(f"No valid quotes from {agent_name}, logged as Invalid_Quote")
                continue

            # Process each quote
            for quote in extracted.quotes:
                carrier = normalize_carrier(quote.carrier)
                price = quote.price
                is_valid = (
                    price is not None and
                    not isinstance(price, str) and
                    price > 0
                )

                match_key = f"{ref_id}_{agent_email}_{carrier}_{quote.shipment_number}"
                log_data = {
                    'rfq_id': ref_id,
                    'match': match_key,
                    'status': 'Received' if is_valid else 'Invalid_Quote',
                    'agent_name': agent_name,
                    'agent_email': agent_email,
                    'shipment_number': str(quote.shipment_number),
                    'carrier': carrier,
                    'price': str(price) if is_valid else 'N/A',
                    'currency': quote.currency,
                    'etd': quote.etd or 'N/A',
                    'transit_time': str(quote.transit_time) if quote.transit_time else 'N/A',
                    'free_time': str(quote.free_time) if quote.free_time else 'N/A',
                    'validity': quote.validity or 'N/A',
                    'received_at': now_str,
                }

                _upsert_row(supabase, "agent_outbound_log", log_data, workspace_id)
                print(f"Quote logged: {agent_name} / {carrier} / ${price} (shipment {quote.shipment_number})")

            # After logging all quotes, check threshold
            _check_threshold_and_notify(gmail_service, supabase, ref_id, workspace_id)

        except Exception as e:
            print(f"Error processing quote from {agent_name}: {e}")
            # Log error but continue processing other messages
            try:
                match_key = f"{ref_id}_{agent_email}"
                _upsert_row(supabase, "agent_outbound_log", {
                    'rfq_id': ref_id,
                    'match': match_key,
                    'status': 'Invalid_Quote',
                    'agent_name': agent_name,
                    'agent_email': agent_email,
                    'carrier': 'N/A',
                    'shipment_number': '1',
                    'received_at': datetime.now(UAE_TZ).strftime('%Y-%m-%d %I:%M %p'),
                }, workspace_id)
            except Exception:
                pass


def _check_threshold_and_notify(gmail_service, supabase, ref_id: str, workspace_id: str):
    """Check if enough valid quotes received and notify manager."""
    # Get the master RFQ
    master_rows = _get_rows_by_filter(supabase, "master_rfqs", "rfq_id", ref_id, workspace_id)
    if not master_rows:
        print(f"No master_rfqs row found for {ref_id}")
        return

    rfq = master_rows[0]

    # Get all quotes for this RFQ
    all_quote_rows = _get_rows_by_filter(supabase, "agent_outbound_log", "rfq_id", ref_id, workspace_id)

    # Build summary
    summary = build_quote_summary(rfq, all_quote_rows)

    if summary['threshold_met']:
        print(f"Threshold met for {ref_id}: {summary['quote_count']} valid quotes")

        # Send manager notification
        try:
            send_manager_notification(gmail_service, summary)
            print(f"Manager notification sent for {ref_id}")
        except Exception as e:
            print(f"Failed to send manager notification: {e}")
    else:
        print(f"Threshold not met for {ref_id}: {summary['quote_count']}/{QUOTE_THRESHOLD} valid quotes")


if __name__ == "__main__":
    app.serve()
