import os
import re
import json
import base64
import hashlib
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from typing import List, Optional

UAE_TZ = timezone(timedelta(hours=4))

import modal
from pydantic import BaseModel, Field, field_validator
import openai
from gmail_workspace_auth import (
    WorkspaceMailboxAuthError,
    get_gmail_service_for_workspace,
)
from tenant_context import (
    audit_ignored_mailbox_event,
    claim_email_event,
    extract_pubsub_mailbox,
    is_unique_violation,
    resolve_workspace_id,
    scoped_eq_filter,
    scoped_select,
    scoped_update_by_eq,
    scoped_upsert,
)

# =====================================================================
# MODAL APP DEFINITION
# =====================================================================
app = modal.App("rfq-analyzer-phase-1")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "cryptography",
    "google-api-python-client",
    "google-auth-httplib2",
    "google-auth-oauthlib",
    "openai",
    "pydantic",
    "fastapi",
    "supabase"
).add_local_file(
    os.path.join(os.path.dirname(__file__), "tenant_context.py"),
    "/root/tenant_context.py"
).add_local_file(
    os.path.join(os.path.dirname(__file__), "gmail_workspace_auth.py"),
    "/root/gmail_workspace_auth.py"
)

# =====================================================================
# CONSTANTS
# =====================================================================
VALID_TYPES = ['20FT', '40FT', '40HC', '40HQ', '45FT', '20OT', '40OT']
VALID_SERVICE_TYPES = ['port-to-port', 'door-to-port', 'port-to-door', 'door-to-door']

PORT_FIELD_INFO = {
    'pol':        {'label': 'Port of Loading (Origin)',        'example': 'SHENZHEN, SHANGHAI, NINGBO'},
    'pod':        {'label': 'Port of Discharge (Destination)', 'example': 'JEBEL ALI, JEDDAH, DAMMAM, HAMAD PORT'},
    'containers': {'label': 'Container Types & Quantities',   'example': '2x 40FT, 1x 20FT, 3x 40HC'},
    'date':       {'label': 'Cargo Ready Date',                'example': '2026-02-15, 20th February'},
}

DOOR_FIELD_INFO = {
    **PORT_FIELD_INFO,
    'pickup_address':   {'label': 'Pickup Address (Origin)',        'example': 'Factory name, street, city, country'},
    'delivery_address': {'label': 'Delivery Address (Destination)', 'example': 'Warehouse name, street, area, city'},
}

# =====================================================================
# CORE DATA MODELS
# =====================================================================
class ContainerItem(BaseModel):
    qty: Optional[int] = Field(None, description="Number of containers of this type")
    type: Optional[str] = Field(None, description="Container Type (20FT, 40FT, 40HC, etc.)")

    @field_validator('qty', mode='before')
    @classmethod
    def coerce_qty(cls, v):
        if isinstance(v, str):
            try:
                return int(v)
            except ValueError:
                return None
        return v

class ShipmentData(BaseModel):
    pol: Optional[str] = Field(None, description="Port of Loading (Origin)")
    pod: Optional[str] = Field(None, description="Port of Discharge (Destination)")
    pod_hint: List[str] = Field(default_factory=list, description="Port of Discharge Options if not confirmed")
    containers: List[ContainerItem] = Field(default_factory=list, description="Container types and quantities")
    date: Optional[str] = Field(None, description="Cargo Ready Date YYYY-MM-DD")
    delivery_deadline: Optional[str] = Field(None, description="Required Delivery Date YYYY-MM-DD")
    service_type: str = Field("port-to-port", description="Service Level")
    pickup_address: Optional[str] = Field(None, description="Origin Collection Address")
    delivery_address: Optional[str] = Field(None, description="Destination Delivery Address")

    @field_validator('pod_hint', mode='before')
    @classmethod
    def coerce_pod_hint(cls, v):
        if isinstance(v, str):
            return [v] if v else []
        return v or []

class ExtractedRFQs(BaseModel):
    extraction_reasoning: str = Field(description="Step by step reasoning about the email contents. Identify the ports, containers, dates, and whether it represents one or multiple shipments, before returning the structured data.")
    multi: bool = Field(False, description="True if there are multiple shipments")
    count: int = Field(0, description="Number of shipments")
    shipments: List[ShipmentData] = Field(default_factory=list, description="Array of shipment objects")

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
# RFQ ID GENERATION — Format: RFQ-YYYYMMDD-XXX
# =====================================================================
def generate_rfq_id(thread_id: str = "") -> str:
    """Generate unique RFQ ID from timestamp + thread hash."""
    now = datetime.now(UAE_TZ)
    date_part = now.strftime('%Y%m%d')
    seed = f"{now.timestamp()}-{thread_id}"
    h = hashlib.md5(seed.encode()).hexdigest()
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    # Take 3 chars from hash
    suffix = ''
    for i in range(3):
        idx = int(h[i*2:(i+1)*2], 16) % len(chars)
        suffix += chars[idx]
    return f"RFQ-{date_part}-{suffix}"

# =====================================================================
# EMAIL CLASSIFICATION
# =====================================================================
def classify_email(modal_llm_client, subject: str, sender: str, body_preview: str,
                   fallback_llm_client=None) -> str:
    """Classify email into categories using AI. Returns category string."""
    input_text = f"Subject: {subject}\nFrom: {sender}\nBody: {body_preview[:800]}"
    system_prompt = (
        "Classify this email into exactly ONE category. Reply with ONLY the category name.\n\n"
        "Categories:\n"
        "- agent_rate_reply: Email from a freight agent containing shipping rates, carrier names, pricing, "
        "validity dates, or a decline/no space response. Subject usually contains a Ref ID like \"Ref: RFQ-XXXXXXXX\".\n"
        "- customer_rfq: New email from a customer requesting a freight quote. Contains container types, "
        "port mentions, or shipping inquiry language. No Ref ID in subject.\n"
        "- customer_followup: Customer replying to an existing quote thread. May reference a previous "
        "conversation, ask for clarification, or confirm details.\n"
        "- booking_confirmation: Booking confirmation, B/L notification, or vessel confirmation.\n"
        "- out_of_scope: Spam, newsletters, unrelated emails."
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": input_text}
    ]
    valid_categories = ['agent_rate_reply', 'customer_rfq', 'customer_followup',
                       'booking_confirmation', 'out_of_scope']

    try:
        response = modal_llm_client.chat.completions.create(
            model="zai-org/GLM-5-FP8",
            messages=messages,
            max_tokens=20
        )
        raw = response.choices[0].message.content
        if raw is None and fallback_llm_client:
            print(f"Modal LLM returned None for: {subject}, retrying with OpenAI")
            response = fallback_llm_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=20
            )
            raw = response.choices[0].message.content
        if raw is None:
            print(f"Classification returned None content for: {subject}")
            return 'out_of_scope'
        category = raw.strip().lower()
        return category if category in valid_categories else 'out_of_scope'
    except Exception as e:
        print(f"Classification error: {e}, defaulting to out_of_scope")
        return 'out_of_scope'

# =====================================================================
# DATA NORMALIZERS (ported from n8n Parse & Route)
# =====================================================================
def normalize_port(port):
    if not port or not isinstance(port, str):
        return None
    p = port.strip().upper()
    return None if p in ('', 'NULL', 'N/A', 'TBD') else p

def normalize_qty(qty):
    if qty is None:
        return None
    try:
        n = int(qty)
        return n if n > 0 else None
    except (ValueError, TypeError):
        return None

def normalize_type(container_type):
    if not container_type or not isinstance(container_type, str):
        return None
    t = re.sub(r'[^A-Z0-9]', '', container_type.strip().upper())
    # Aliases
    alias_map = {
        '40FTHC': '40HC', '40HQ': '40HC', '40FTHQ': '40HC',
        '20FTGP': '20FT', '20GP': '20FT',
        '40FTGP': '40FT', '40GP': '40FT',
        '40FTOP': '40OT', '40OP': '40OT', '40OPEN': '40OT', '40OPENTOP': '40OT',
        '20FTOP': '20OT', '20OP': '20OT', '20OPEN': '20OT', '20OPENTOP': '20OT',
    }
    t = alias_map.get(t, t)
    return t if t in VALID_TYPES else None

def normalize_date(date_str):
    if not date_str or not isinstance(date_str, str):
        return None
    d = date_str.strip()
    if d.lower() in ('', 'null', 'n/a', 'tbd'):
        return None
    # Check YYYY-MM-DD format
    if re.match(r'^\d{4}-\d{2}-\d{2}$', d):
        year = int(d[:4])
        return d if year >= 2024 else None
    # Try parsing natural dates
    try:
        from datetime import datetime as dt
        parsed = dt.fromisoformat(d.replace('Z', '+00:00')) if 'T' in d else dt.strptime(d, '%Y-%m-%d')
        return parsed.strftime('%Y-%m-%d') if parsed.year >= 2024 else None
    except (ValueError, TypeError):
        return None

def normalize_service_type(st):
    if not st or not isinstance(st, str):
        return 'port-to-port'
    t = st.strip().lower()
    return t if t in VALID_SERVICE_TYPES else 'port-to-port'

def normalize_address(addr):
    if not addr or not isinstance(addr, str):
        return None
    a = addr.strip()
    return None if a.lower() in ('', 'null', 'n/a', 'tbd') else a

def normalize_pod_hint(hints):
    if not isinstance(hints, list):
        return []
    return [h.strip().upper() for h in hints
            if isinstance(h, str) and h.strip().upper() not in ('', 'NULL', 'N/A')]

def validate_shipment(s_data: dict, index: int) -> dict:
    """Normalize and validate a single shipment dict."""
    raw_containers = s_data.get('containers', [])
    validated_containers = []
    for c in raw_containers:
        nq = normalize_qty(c.get('qty'))
        nt = normalize_type(c.get('type'))
        if nq or nt:
            validated_containers.append({'qty': nq, 'type': nt})

    return {
        'num': index + 1,
        'pol': normalize_port(s_data.get('pol')),
        'pod': normalize_port(s_data.get('pod')),
        'pod_hint': normalize_pod_hint(s_data.get('pod_hint', [])),
        'containers': validated_containers,
        'date': normalize_date(s_data.get('date')),
        'delivery_deadline': normalize_date(s_data.get('delivery_deadline')),
        'service_type': normalize_service_type(s_data.get('service_type')),
        'pickup_address': normalize_address(s_data.get('pickup_address')),
        'delivery_address': normalize_address(s_data.get('delivery_address')),
    }

# =====================================================================
# ROUTING LOGIC
# =====================================================================
def get_missing_port_fields(shipment: dict) -> list:
    missing = []
    if not shipment['pol']:
        missing.append('pol')
    if not shipment['pod'] and len(shipment['pod_hint']) == 0:
        missing.append('pod')
    if not shipment['containers'] or any(not c['qty'] or not c['type'] for c in shipment['containers']):
        missing.append('containers')
    if not shipment['date']:
        missing.append('date')
    return missing

def get_missing_door_fields(shipment: dict) -> list:
    missing = get_missing_port_fields(shipment)
    st = shipment['service_type']
    if st in ('door-to-port', 'door-to-door') and not shipment['pickup_address']:
        missing.append('pickup_address')
    if st in ('port-to-door', 'door-to-door') and not shipment['delivery_address']:
        missing.append('delivery_address')
    return missing

def determine_routing_action(shipments: list) -> str:
    """Determine route action: complete, need_door_data, need_port_data."""
    has_door = any(s['service_type'] != 'port-to-port' for s in shipments)

    if has_door:
        addresses_missing = any(
            (s['service_type'] in ('door-to-port', 'door-to-door') and not s['pickup_address']) or
            (s['service_type'] in ('port-to-door', 'door-to-door') and not s['delivery_address'])
            for s in shipments
        )
        if addresses_missing:
            all_missing = [get_missing_door_fields(s) for s in shipments]
            return 'complete' if all(len(m) == 0 for m in all_missing) else 'need_door_data'

    # Check port fields
    all_missing = [get_missing_port_fields(s) for s in shipments]
    has_pod_hint = any(not s['pod'] and len(s['pod_hint']) > 0 for s in shipments)
    if all(len(m) == 0 for m in all_missing) and not has_pod_hint:
        return 'complete'
    return 'need_port_data'

# =====================================================================
# SHEETS CONCATENATION FOR MULTI-SHIPMENT
# =====================================================================
def concatenate_shipments(shipments: list) -> dict:
    """Concatenate shipment data with newline separators for Supabase.

    Containers are flattened: each container type becomes a separate newline entry.
    Route fields (pol, pod, date, etc.) are repeated for each container within a
    shipment so ALL fields have the same line count and stay index-aligned for
    Phase 2/3 which iterate by position.
    """
    all_pols = []
    all_pods = []
    all_types = []
    all_qtys = []
    all_dates = []
    all_services = []
    all_pickups = []
    all_deliveries = []
    all_deadlines = []

    for s in shipments:
        pod_val = s['pod'] or ('/'.join(s['pod_hint']) if s['pod_hint'] else 'TBD')
        containers = s['containers'] or [{'qty': None, 'type': None}]
        for c in containers:
            all_pols.append(s['pol'] or 'TBD')
            all_pods.append(pod_val)
            all_types.append(c['type'] or 'TBD')
            all_qtys.append(str(c['qty']) if c['qty'] else 'TBD')
            all_dates.append(s['date'] or 'TBD')
            all_services.append(s['service_type'])
            all_pickups.append(s['pickup_address'] or '')
            all_deliveries.append(s['delivery_address'] or '')
            all_deadlines.append(s['delivery_deadline'] or '')

    return {
        'pol': '\n'.join(all_pols),
        'pod': '\n'.join(all_pods),
        'container_type': '\n'.join(all_types),
        'qty': '\n'.join(all_qtys),
        'ready_date': '\n'.join(all_dates),
        'delivery_deadline': '\n'.join(filter(None, all_deadlines)) or None,
        'service_type': '\n'.join(sorted(set(all_services))),
        'pickup_address': '\n'.join(filter(None, all_pickups)) or None,
        'delivery_address': '\n'.join(filter(None, all_deliveries)) or None,
    }

# =====================================================================
# EMAIL CONTENT FORMATTERS
# =====================================================================
def format_missing_fields(shipments: list, has_door: bool) -> str:
    """Format missing fields for customer reply email."""
    all_missing = set()
    for s in shipments:
        missing = get_missing_door_fields(s) if has_door else get_missing_port_fields(s)
        all_missing.update(missing)
        # If pod_hint exists but no pod confirmed, add pod
        if not s['pod'] and len(s['pod_hint']) > 0:
            all_missing.add('pod')

    field_info = DOOR_FIELD_INFO if has_door else PORT_FIELD_INFO
    lines = []
    for f in all_missing:
        info = field_info.get(f)
        if not info:
            continue
        # If pod has hints, give a more helpful prompt
        pod_hints = [h for s in shipments for h in s['pod_hint']]
        if f == 'pod' and pod_hints:
            lines.append(f"- {info['label']} (Please confirm: {' or '.join(pod_hints)}?)")
        else:
            lines.append(f"- {info['label']} (Example: {info['example']})")
    return '\n'.join(lines)

def format_current_details(shipments: list, is_multi: bool) -> str:
    """Format extracted details for inclusion in reply email."""
    lines = []
    for i, s in enumerate(shipments):
        prefix = f"[Shipment {i + 1}]\n" if is_multi else ''
        parts = []
        if s['pol']:
            parts.append(f"Origin Port: {s['pol']}")
        if s['pod']:
            parts.append(f"Destination Port: {s['pod']}")
        if not s['pod'] and s['pod_hint']:
            parts.append(f"POD Options: {' or '.join(s['pod_hint'])} (pending confirmation)")
        if s['containers']:
            container_strs = []
            for c in s['containers']:
                if c['qty'] and c['type']:
                    container_strs.append(f"{c['qty']} x {c['type']}")
                elif c['qty']:
                    container_strs.append(f"{c['qty']} containers")
                elif c['type']:
                    container_strs.append(c['type'])
            if container_strs:
                parts.append(f"Containers: {', '.join(container_strs)}")
        if s['date']:
            parts.append(f"Cargo Ready: {s['date']}")
        if s['delivery_deadline']:
            parts.append(f"Delivery Deadline: {s['delivery_deadline']}")
        if s['service_type'] != 'port-to-port':
            parts.append(f"Service: {s['service_type']}")

        summary = prefix + ' | '.join(parts)
        extras = []
        if s['pickup_address']:
            extras.append(f"Pickup: {s['pickup_address']}")
        if s['delivery_address']:
            extras.append(f"Delivery: {s['delivery_address']}")

        block = '\n'.join(filter(None, [summary] + extras))
        if block:
            lines.append(block)
    return '\n\n'.join(lines) if lines else 'No shipment details could be extracted'

def format_pricing_content(shipments: list, is_multi: bool) -> str:
    """Format shipment data for agent rate request email."""
    parts = []
    for s in shipments:
        header = f"Shipment {s['num']} of {len(shipments)}\n" if is_multi else ''
        pod_display = s['pod'] or (f"TBD (options: {' / '.join(s['pod_hint'])})" if s['pod_hint'] else '???')
        route = f"{s['pol'] or '???'} > {pod_display}"
        if s['containers']:
            container_strs = []
            for c in s['containers']:
                if c['qty'] and c['type']:
                    container_strs.append(f"{c['qty']} x {c['type']}")
                elif c['qty']:
                    container_strs.append(f"{c['qty']} containers (type TBD)")
                else:
                    container_strs.append('TBD')
            containers = ', '.join(container_strs)
        else:
            containers = 'TBD'
        ready = s['date'] or 'TBD'
        lines = [f"{header}Route: {route}", f"Containers: {containers}", f"Ready Date: {ready}"]
        if s['service_type'] != 'port-to-port':
            lines.append(f"Service: {s['service_type'].upper()}")
        if s['pickup_address']:
            lines.append(f"Pickup: {s['pickup_address']}")
        if s['delivery_address']:
            lines.append(f"Delivery: {s['delivery_address']}")
        if s['delivery_deadline']:
            lines.append(f"Delivery Deadline: {s['delivery_deadline']}")
        parts.append('\n'.join(lines))
    return '\n\n'.join(parts)

def build_subject_line(shipments: list, is_multi: bool, count: int, action: str) -> str:
    """Build subject line for agent rate request email."""
    s = shipments[0]
    pod_display = s['pod'] or (s['pod_hint'][0] + '?' if s['pod_hint'] else 'TBD')
    route = f"{s['pol'] or 'TBD'} > {pod_display}"
    if s['containers']:
        containers = '+'.join(
            f"{c['qty']}x{c['type']}" for c in s['containers'] if c['qty'] and c['type']
        ) or 'TBD'
    else:
        containers = 'TBD'
    multi_suffix = f" +{count - 1} more" if is_multi else ''
    door_suffix = f" [{s['service_type'].upper()}]" if s['service_type'] != 'port-to-port' else ''
    prefix = 'Quote Request'
    if action == 'need_port_data':
        prefix = 'Quote (Info Required)'
    if action == 'need_door_data':
        prefix = 'Quote (Door - Info Required)'
    return f"{prefix}: {route} [{containers}]{multi_suffix}{door_suffix}"

# =====================================================================
# EMAIL BODY EXTRACTION
# =====================================================================
def extract_email_body(payload) -> str:
    """Recursively extract text from email payload, handling all structures."""
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

def parse_email_received_date(received_at: str) -> datetime:
    """Parse RFC2822 date header and return timezone-aware datetime in UAE TZ."""
    if not received_at:
        return datetime.now(UAE_TZ)
    try:
        parsed = parsedate_to_datetime(received_at)
        if parsed is None:
            return datetime.now(UAE_TZ)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(UAE_TZ)
    except Exception:
        return datetime.now(UAE_TZ)

def build_phase1_extraction_prompt(subject: str, sender: str, email_body: str, received_at: str) -> str:
    """Build structured extraction prompt for Phase 1 RFQ parsing."""
    email_received_at = parse_email_received_date(received_at).strftime('%Y-%m-%d')
    return (
        "EMAIL_METADATA\n"
        f"email_received_at: {email_received_at}\n"
        f"subject: {subject}\n"
        f"from: {sender}\n\n"
        "EMAIL_BODY\n"
        "\"\"\"\n"
        f"{email_body}\n"
        "\"\"\""
    )

# =====================================================================
# EMAIL SENDING HELPERS
# =====================================================================
def send_reply_email(gmail_service, to_address: str, thread_id: str, message_id: str,
                     subject: str, body: str):
    """Send a plain text reply on an existing Gmail thread."""
    raw_msg = (
        f"To: {to_address}\n"
        f"In-Reply-To: {message_id}\n"
        f"References: {message_id}\n"
        f"Subject: Re: {subject}\n\n{body}"
    )
    b64_message = base64.urlsafe_b64encode(raw_msg.encode('utf-8')).decode('utf-8')
    gmail_service.users().messages().send(userId='me', body={
        'raw': b64_message,
        'threadId': thread_id
    }).execute()

def send_email(gmail_service, to_address: str, subject: str, body: str,
               content_type: str = "text/plain"):
    """Send a standalone email (not a reply)."""
    ct_header = f"Content-Type: {content_type}; charset=utf-8\n" if content_type != "text/plain" else ""
    raw_msg = f"To: {to_address}\n{ct_header}Subject: {subject}\n\n{body}"
    b64_message = base64.urlsafe_b64encode(raw_msg.encode('utf-8')).decode('utf-8')
    gmail_service.users().messages().send(userId='me', body={'raw': b64_message}).execute()

# =====================================================================
# REPLY TEMPLATES
# =====================================================================
def send_port_data_reply(gmail_service, to_address, thread_id, message_id, subject,
                         current_details, missing_formatted):
    """Reply requesting missing port data."""
    captured = ""
    if current_details and current_details != 'No shipment details could be extracted':
        captured = f"Here is what we have captured so far:\n\n{current_details}\n\n━━━━━━━━━━━━━━━━━━\n\n"

    body = (
        f"Dear Customer,\n\n"
        f"Thank you for your shipping inquiry.\n\n"
        f"{captured}"
        f"To provide you with an accurate quotation, we need the following information:\n\n"
        f"{missing_formatted}\n\n"
        f"Please reply with the missing details and we will send your quote promptly.\n\n"
        f"Best regards,\nPricing Team"
    )
    send_reply_email(gmail_service, to_address, thread_id, message_id, subject, body)

def send_door_data_reply(gmail_service, to_address, thread_id, message_id, subject,
                         current_details, missing_formatted):
    """Reply requesting missing door service data (addresses)."""
    captured = ""
    if current_details and current_details != 'No shipment details could be extracted':
        captured = f"Here is what we have captured so far:\n\n{current_details}\n\n━━━━━━━━━━━━━━━━━━\n\n"

    body = (
        f"Dear Customer,\n\n"
        f"Thank you for your shipping inquiry. We have identified this as a door-to-door / door service request.\n\n"
        f"{captured}"
        f"To complete your quotation, we need the following missing details:\n\n"
        f"{missing_formatted}\n\n"
        f"Please note:\n"
        f"- For pickup addresses, include the company name, full street address, city, and country\n"
        f"- For delivery addresses, include the company/warehouse name, full street address, area, city, and country\n"
        f"- If you have a Google Maps link for either location, please share it\n\n"
        f"We will process your quote as soon as we receive this information.\n\n"
        f"Best regards,\nPricing Team"
    )
    send_reply_email(gmail_service, to_address, thread_id, message_id, subject, body)

def send_fallback_reply(gmail_service, to_address, thread_id, message_id, subject):
    """Reply when AI couldn't parse the email at all."""
    body = (
        "Dear Customer,\n\n"
        "Thank you for your inquiry.\n\n"
        "We were unable to process your request automatically. To help us provide an accurate "
        "quotation, please reply with your request in this format:\n\n"
        "\"Please quote: [ORIGIN PORT] to [DESTINATION PORT], [NUMBER]x[CONTAINER TYPE], "
        "ready [DATE]\"\n\n"
        "Example: \"Please quote: SHENZHEN to JEBEL ALI, 3x40HC, ready 15th February 2026\"\n\n"
        "Best regards,\nPricing Team"
    )
    send_reply_email(gmail_service, to_address, thread_id, message_id, subject, body)

def send_fallback_admin_notification(
    gmail_service, notification_email, rfq_id, email_meta, email_body
):
    """Send detailed fallback alert for manual review."""
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 700px; border: 2px solid #e74c3c; border-radius: 8px; padding: 24px;">
      <h2 style="color: #e74c3c; margin-top: 0;">⚠️ Fallback Alert — Email Parsing Failed</h2>
      <p>An incoming customer email could <strong>not be automatically parsed</strong> by the Phase 1 AI Extractor.
      The email requires <strong>manual review</strong>.</p>
      <hr style="border: 1px solid #eee;" />
      <h3 style="color: #333;">📋 Email Details</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr style="background: #f9f9f9;">
          <td style="padding: 8px 12px; font-weight: bold; width: 180px;">RFQ ID</td>
          <td style="padding: 8px 12px;">{rfq_id}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold;">From</td>
          <td style="padding: 8px 12px;">{email_meta.get('from', 'N/A')}</td>
        </tr>
        <tr style="background: #f9f9f9;">
          <td style="padding: 8px 12px; font-weight: bold;">Subject</td>
          <td style="padding: 8px 12px;">{email_meta.get('subject', 'N/A')}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold;">Thread ID</td>
          <td style="padding: 8px 12px;">{email_meta.get('thread_id', 'N/A')}</td>
        </tr>
      </table>
      <hr style="border: 1px solid #eee;" />
      <h3 style="color: #333;">📧 Original Email Body</h3>
      <div style="background: #f4f4f4; padding: 14px; border-radius: 6px; font-size: 13px; white-space: pre-wrap; word-break: break-word;">
{email_body[:5000]}</div>
      <hr style="border: 1px solid #eee;" />
      <h3 style="color: #333;">✅ Required Actions</h3>
      <ol style="font-size: 14px; line-height: 1.8;">
        <li>Open the original email in Gmail using the Thread ID above.</li>
        <li>Manually extract shipment details (POL, POD, container type, qty, cargo ready date, service type).</li>
        <li>Reply to the customer directly or create the RFQ manually.</li>
      </ol>
      <p style="background: #fdecea; padding: 12px; border-radius: 4px; font-size: 13px; color: #c0392b;">
        <strong>Note:</strong> A generic fallback reply has already been sent to the customer.
      </p>
    </div>
    """
    if not notification_email:
        print(f"No notification mailbox configured for fallback alert {rfq_id}")
        return
    subject = f"[FALLBACK] Email Could Not Be Parsed — Manual Review Required | {rfq_id}"
    send_email(gmail_service, notification_email, subject, body_html, content_type="text/html")

# =====================================================================
# SUPABASE HELPERS
# =====================================================================
def _read_table(supabase, table_name, workspace_id=None):
    """Read all rows from a table and return (headers, data_rows) arrays."""
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
    """Upsert a row: insert or update via Supabase"""
    if workspace_id:
        scoped_upsert(supabase, table_name, workspace_id, row_data)
    else:
        supabase.table(table_name).upsert(row_data).execute()

# =====================================================================
# AGENT OUTREACH
# =====================================================================
def _send_agent_outreach(gmail_service, supabase, workspace_id, rfq_id, shipments, is_multi, count,
                         action, pricing_content, subject_line):
    """Read active agents, send rate request emails, log to agent_outbound_log."""
    # 1. Read active agents from Agents sheet
    headers, data_rows = _read_table(supabase, "agents", workspace_id)
    if not headers:
        print("No Agents sheet or no headers found")
        return

    # Build agent dicts
    agents = []
    for row in data_rows:
        agent = {}
        for j, h in enumerate(headers):
            agent[h] = row[j] if j < len(row) else None
        if (agent.get('status') or '').lower() == 'active':
            agents.append(agent)

    if not agents:
        print("No active agents found")
        return

    print(f"Sending rate requests to {len(agents)} active agents")
    now_str = datetime.now(UAE_TZ).strftime('%Y-%m-%d %I:%M %p')

    for agent in agents:
        agent_email = agent.get('email', '')
        agent_name = agent.get('agent_name', 'Agent')
        if not agent_email:
            continue

        # 2. Send rate request email
        email_subject = f"RFQ: {subject_line} [Ref:{rfq_id}]"
        email_body = (
            f"Dear {agent_name},\n\n"
            f"Please provide your best Ocean Freight rates for ALL shipments listed below:\n\n"
            f"{pricing_content}\n\n"
            f"Please reply with the following for EACH shipment:\n\n"
            f"1. Carrier Name\n"
            f"2. Price (USD)\n"
            f"3. ETD\n"
            f"4. Transit Time (days)\n"
            f"5. Free Time at Destination (days)\n"
            f"6. Rate Validity Date\n\n"
            f"Regards,\nPricing Team"
        )

        try:
            send_email(gmail_service, agent_email, email_subject, email_body)
            print(f"Rate request sent to {agent_name} ({agent_email})")
        except Exception as e:
            print(f"Failed to send to {agent_email}: {e}")
            continue

        # 3. Log to Agent_Outbound_Log — one row per shipment
        num_shipments = max(count, 1)
        for ship_num in range(1, num_shipments + 1):
            match_key = f"{rfq_id}_{agent_email}_{ship_num}"
            log_data = {
                'rfq_id': rfq_id,
                'match': match_key,
                'shipment_number': str(ship_num),
                'status': 'Requested',
                'agent_name': agent_name,
                'agent_email': agent_email,
                'sent_at': now_str,
            }
            try:
                _upsert_row(supabase, "agent_outbound_log", log_data, workspace_id)
            except Exception as e:
                print(f"Failed to log outreach for {agent_email} shipment {ship_num}: {e}")

# =====================================================================
# AI SYSTEM PROMPT (ported from n8n)
# =====================================================================
AI_SYSTEM_PROMPT = """You are a Freight RFQ Intake Parser for container shipping.

You receive:
1) EMAIL_METADATA
- email_received_at (YYYY-MM-DD)
- subject
- from
2) EMAIL_BODY (raw customer message)

Return ONLY raw JSON matching:
{
  "extraction_reasoning": "concise deterministic summary",
  "multi": false,
  "count": 1,
  "shipments": [
    {
      "pol": null,
      "pod": null,
      "pod_hint": [],
      "containers": [{"qty": null, "type": null}],
      "date": null,
      "delivery_deadline": null,
      "service_type": "port-to-port",
      "pickup_address": null,
      "delivery_address": null
    }
  ]
}

STRICT OUTPUT RULES:
- Raw JSON only (no markdown/backticks/explanations).
- count MUST equal len(shipments).
- multi = true iff len(shipments) > 1.
- Use null for unknown values.
- pod_hint must always be an array.
- containers must always be a non-empty array.
- Container type must be one of: 20FT, 40FT, 40HC, 40HQ, 45FT, 20OT, 40OT.
- pol/pod/pod_hint values must be UPPERCASE.
- extraction_reasoning must be concise deterministic summary (max 2 short sentences).

EXTRACTION LOGIC:
1) Identify all distinct shipment route statements.
2) Parse containers per route, combining repeated same-type mentions.
3) Parse service_type.
4) Parse addresses.
5) Parse dates using email_received_at anchor.
6) Populate structured output.

ROUTE SPLITTING RULES:
- One explicit origin->destination route = one shipment.
- Same route with mixed container types = one shipment with multiple container items.
- Same route repeated across lines = merge container quantities by type.
- If a summary line and a detailed line both mention the same container on the same shipment, sum quantities instead of overwriting.
- If destination is an option in one statement (e.g., "Dubai or Doha"), keep one shipment: pod=null, pod_hint includes mapped options.
- If origin alternatives are listed in one statement (e.g., "NANSHA,YANTIAN"), SPLIT into multiple shipments (duplicate shared details into each split).

FIELD RULES:

pol (origin):
- Accept explicit ports or explicit origin cities from phrases like "from SHANGHAI", "pickup point ... DONGGUAN", "FOB SHENZHEN".
- If only pickup address exists, derive origin city from the address text when clear; use that city as pol.
- Uppercase result.

pod (destination):
- Set when destination is clearly single.
- If multiple destination options in one statement, set pod=null and use pod_hint.

pod/pod_hint controlled destination mapping:
- DUBAI, JEBEL ALI, DEIRA, AL QUOZ -> JEBEL ALI
- QATAR, DOHA, HAMAD -> HAMAD PORT
- UAQ, UMM AL QUWAIN -> UMM AL QUWAIN
- ABU DHABI, MUSAFFAH -> KHALIFA PORT
- OMAN, MUSCAT, SOHAR -> SOHAR
- BASRA, IRAQ, UMM QASR -> UMM QASR
- SHARJAH -> SHARJAH
- RAK, RAS AL KHAIMAH -> RAS AL KHAIMAH
- FUJAIRAH -> FUJAIRAH
- AJMAN -> AJMAN
- JEDDAH -> JEDDAH
- DAMMAM -> DAMMAM
- RIYADH (without port) -> pod=null, pod_hint=["JEDDAH","DAMMAM"]

containers:
- Parse forms like 1x40, 1X40FT, 1 x 40' container, 2X40FTHQ, 3x40HC.
- 40 or 40FT implies type 40FT unless HC/HQ explicitly present.
- Repeated fragments like "1x40 1x40" -> qty 2, type 40FT.
- qty must be integer or null.

date (cargo ready date):
- Output YYYY-MM-DD.
- Parse explicit dates (DD/MM/YYYY, YYYY-MM-DD, 28th July, 25TH JAN).
- If year missing, infer from email_received_at.
- If only day is provided (e.g., "ready on 22nd"), infer nearest future valid date from email_received_at context.
- If "ready to load" / "goods are ready" and no explicit date, set date = email_received_at.
- If unresolved, set null.

delivery_deadline:
- Parse phrases like "must arrive by", "delivered before", "need by", "deadline".

service_type:
- door-to-door if both pickup and delivery are requested or explicitly stated.
- door-to-port if pickup/collection is requested and destination is port.
- port-to-door if delivery to warehouse/door is requested from FOB/port origin.
- FOB + DOOR must map to port-to-door.
- otherwise port-to-port.

pickup_address / delivery_address:
- Capture full textual address blocks exactly as written (including warehouse names and map URLs if present).
- Do not convert full addresses into port names.

OUT-OF-SCHEMA DETAILS:
- Commodity, weight, urgency, direct vessel request, dem/det requirement, SOC restrictions, ETD/ETA/TT request fields are not structured fields here.
- Mention them briefly in extraction_reasoning if relevant to interpretation.

FEW-SHOT PATTERN A (door-to-port):
Input: "Door to Jebel Ali port, 1x20FT, loading point in Dongguan address, cargo ready 26th December."
Output intent: service_type=door-to-port, pickup_address captured, pod=JEBEL ALI, pol=DONGGUAN.

FEW-SHOT PATTERN B (door-to-door):
Input: "1x20FT door to door, pickup in Houjie Dongguan, delivery Al Quoz Dubai warehouse."
Output intent: service_type=door-to-door, pol=DONGGUAN, pod=JEBEL ALI, both addresses captured.

FEW-SHOT PATTERN C (multi-route list):
Input: "5x40 Wuhan to Jebel Ali, 2x40 Wuhan to Qatar, 3x40 Shanghai to Jebel Ali."
Output intent: three shipments with mapped pod for Qatar as HAMAD PORT.

FEW-SHOT PATTERN D (FOB to Door):
Input: "FOB Shenzhen to Door (Deira warehouse), 1x40FT, pickup date 22/11/2025."
Output intent: service_type=port-to-door, pol=SHENZHEN, pod=JEBEL ALI, delivery_address captured.

FEW-SHOT PATTERN E (origin alternatives):
Input: "POL NANSHA,YANTIAN POD JEBEL ALI 2X40FTHQ ready 29/1/2026 delivery UAQ store."
Output intent: split into two shipments (NANSHA->JEBEL ALI and YANTIAN->JEBEL ALI) with duplicated shared details.

FEW-SHOT PATTERN F (duplicate mentions across lines):
Input:
"Let me know the rates for 1x40
1x40 going to be ready on 22nd from Shanghai"
Output intent: one shipment with containers=[{"qty":2,"type":"40FT"}], not qty=1."""

# =====================================================================
# HELPERS
# =====================================================================
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
# GMAIL PUSH WEBHOOK
# =====================================================================
@app.function(
    image=image,
    secrets=[modal.Secret.from_name("evo-logistics-env")]
)
@modal.fastapi_endpoint(method="POST")
def gmail_push_phase1(_data: dict):
    """Triggered by Gmail push notification via Google Cloud Pub/Sub.
    
    IMPORTANT: Always return 200 to Pub/Sub — retries cause rate limit storms.
    Processing errors are caught internally.
    """
    try:
        _process_incoming_rfqs(_data)
    except Exception as e:
        # Log but don't re-raise: returning 200 prevents Pub/Sub from retrying
        print(f"CRITICAL ERROR in _process_incoming_rfqs: {e}")
        import traceback; traceback.print_exc()
    return {"status": "ok"}

# =====================================================================
# GMAIL WATCH RENEWAL (every 6 days — watch expires after 7)
# =====================================================================
@app.function(
    schedule=modal.Cron("0 0 */6 * *"),
    image=image,
    secrets=[modal.Secret.from_name("evo-logistics-env")]
)
def renew_gmail_watch():
    """Renews the Gmail push notification watch on INBOX."""
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
    if not mailboxes:
        print("No connected workspace mailboxes found; skipping Gmail watch renewal.")
        return

    for mailbox in mailboxes:
        workspace_id = mailbox.get("workspace_id")
        if not workspace_id:
            continue

        try:
            gmail_service, mailbox_email = get_gmail_service_for_workspace(
                supabase, workspace_id
            )
            result = gmail_service.users().watch(
                userId='me',
                body={
                    'topicName': topic,
                    'labelIds': ['INBOX'],
                },
            ).execute()
            expiration_ms = result.get("expiration")
            expiration_iso = None
            if expiration_ms:
                try:
                    expiration_iso = datetime.fromtimestamp(
                        int(expiration_ms) / 1000,
                        tz=timezone.utc
                    ).isoformat()
                except Exception:
                    expiration_iso = None

            supabase.table("workspace_mailboxes").update({
                "status": "connected",
                "watch_expiration": expiration_iso,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "last_error": None,
            }).eq("workspace_id", workspace_id).execute()

            print(
                "Gmail watch renewed for workspace "
                f"{workspace_id} ({mailbox_email}): "
                f"History ID={result.get('historyId')} Expiry={result.get('expiration')}"
            )
        except WorkspaceMailboxAuthError as exc:
            supabase.table("workspace_mailboxes").update({
                "status": "error",
                "last_error": str(exc),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("workspace_id", workspace_id).execute()
            print(
                f"Failed to renew Gmail watch for workspace {workspace_id}: {exc}"
            )
        except Exception as exc:
            supabase.table("workspace_mailboxes").update({
                "status": "error",
                "last_error": str(exc),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("workspace_id", workspace_id).execute()
            print(
                f"Unexpected failure during watch renewal for workspace {workspace_id}: {exc}"
            )

# =====================================================================
# DEDUPLICATION: Load known threads to avoid reprocessing
# =====================================================================
def _load_known_threads(supabase, workspace_id):
    """Load thread_id -> {rfq_id, status} from master_rfqs for deduplication."""
    try:
        headers, data_rows = _read_table(supabase, "master_rfqs", workspace_id)
        if not headers:
            return {}
        tid_idx = headers.index('thread_id') if 'thread_id' in headers else -1
        status_idx = headers.index('status') if 'status' in headers else -1
        rfq_idx = headers.index('rfq_id') if 'rfq_id' in headers else -1
        if tid_idx < 0:
            return {}
        result = {}
        for row in data_rows:
            if len(row) > tid_idx and row[tid_idx]:
                result[row[tid_idx]] = {
                    'status': row[status_idx] if status_idx >= 0 and len(row) > status_idx else '',
                    'rfq_id': row[rfq_idx] if rfq_idx >= 0 and len(row) > rfq_idx else '',
                }
        return result
    except Exception as e:
        print(f"Warning: Could not load known threads for dedup: {e}")
        return {}


_STATUS_PRIORITY = {
    "quoted": 1,
    "followed_up": 2,
    "customer_replied": 3,
    "selected": 4,
    "reminded": 5,
    "processing": 6,
    "missing_door_data": 7,
    "missing_port_data": 8,
    "parse_error": 9,
}


def _status_rank(status_value: Optional[str]) -> int:
    if not status_value:
        return 999
    return _STATUS_PRIORITY.get(str(status_value).strip().lower(), 999)


def _parse_received_for_sort(value: Optional[str]):
    if not value:
        return (2, "")

    if isinstance(value, datetime):
        return (0, value.isoformat())

    text = str(value).strip()

    try:
        # Stored by automation as: YYYY-MM-DD HH:MM AM/PM (UAE local)
        parsed = datetime.strptime(text, "%Y-%m-%d %I:%M %p")
        return (0, parsed.isoformat())
    except Exception:
        pass

    try:
        # In case row was inserted with an ISO timestamp
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return (0, parsed.isoformat())
    except Exception:
        return (1, text)


def _pick_preferred_thread_row(rows: list) -> Optional[dict]:
    if not rows:
        return None
    return sorted(
        rows,
        key=lambda row: (
            _status_rank(row.get("status")),
            _parse_received_for_sort(row.get("received_at")),
            str(row.get("rfq_id") or ""),
        ),
    )[0]


def _get_thread_record(supabase, workspace_id: str, thread_id: str):
    if not thread_id:
        return None

    try:
        rows = scoped_eq_filter(supabase, "master_rfqs", workspace_id, "thread_id", thread_id)
    except Exception as exc:
        print(f"Warning: Could not refresh thread {thread_id} for dedup: {exc}")
        return None

    if not rows:
        return None

    preferred = _pick_preferred_thread_row(rows)
    if not preferred:
        return None

    return {
        "status": preferred.get("status") or "",
        "rfq_id": preferred.get("rfq_id") or "",
    }


def _mark_message_read(gmail_service, msg_id: str):
    try:
        _gmail_call_with_backoff(
            gmail_service.users().messages().modify(
                userId='me', id=msg_id, body={'removeLabelIds': ['UNREAD']}
            )
        )
    except Exception:
        pass

# =====================================================================
# CORE EMAIL PROCESSING LOGIC
# =====================================================================
def _process_incoming_rfqs(pubsub_payload=None):
    supabase = get_supabase_client()
    mailbox_email = extract_pubsub_mailbox(pubsub_payload)
    workspace_id = resolve_workspace_id(supabase, mailbox_email)
    if not workspace_id:
        audit_ignored_mailbox_event(
            supabase,
            source="phase_1_request_analysis",
            mailbox_email=mailbox_email,
            reason="mailbox_not_connected_or_unmapped",
        )
        print(
            "Ignoring Phase 1 webhook event because mailbox is not connected "
            f"to any workspace: {mailbox_email or 'unknown'}"
        )
        return

    try:
        gmail_service, own_mailbox_email = get_gmail_service_for_workspace(
            supabase, workspace_id
        )
    except WorkspaceMailboxAuthError as exc:
        audit_ignored_mailbox_event(
            supabase,
            source="phase_1_request_analysis",
            mailbox_email=mailbox_email,
            reason="mailbox_auth_failed",
        )
        print(f"Skipping Phase 1 processing due to mailbox auth error: {exc}")
        return

    # 1. Fetch unread inbox emails only
    # BUG-4 Fix: Exclude agent rate replies (Phase 2 handles those) and our own sent auto-replies
    gmail_query = 'is:unread -subject:"Ref: RFQ-"'
    if own_mailbox_email:
        gmail_query = f"{gmail_query} -from:{own_mailbox_email}"
    results = gmail_service.users().messages().list(
        userId='me',
        q=gmail_query
    ).execute()
    messages = results.get('messages', [])

    if not messages:
        print("No new unread emails to process.")
        return

    # Pre-load known RFQ threads for deduplication
    known_threads = _load_known_threads(supabase, workspace_id)

    openai_client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    modal_llm_client = openai.OpenAI(
        base_url="https://api.us-west-2.modal.direct/v1",
        api_key=os.environ.get("MODAL_LLM_API_KEY", "missing_modal_key")
    )

    processed_msg_ids = set()  # Guard against double-processing in same invocation

    for msg in messages:
        msg_id = msg['id']
        if msg_id in processed_msg_ids:
            continue

        email_data = _gmail_call_with_backoff(
            gmail_service.users().messages().get(userId='me', id=msg_id, format='full')
        )
        thread_id = email_data.get('threadId')

        # Extract metadata
        headers_dict = {h['name'].lower(): h['value'] for h in email_data['payload']['headers']}
        subject = headers_dict.get('subject', '')
        sender = headers_dict.get('from', '')
        received_at_header = headers_dict.get('date', '')
        # RFC 2822 Message-ID is needed for proper threading (not the Gmail internal ID)
        rfc_message_id = headers_dict.get('message-id', '')

        claimed = claim_email_event(
            supabase,
            workspace_id=workspace_id,
            source="phase_1_request_analysis",
            gmail_message_id=msg_id,
            thread_id=thread_id,
            subject=subject,
            sender=sender,
        )
        print(
            f"[{msg_id}] Claim result: {'claimed' if claimed else 'already-claimed'} "
            f"thread={thread_id}"
        )
        if not claimed:
            _mark_message_read(gmail_service, msg_id)
            processed_msg_ids.add(msg_id)
            print(f"[{msg_id}] Skipping duplicate delivery for thread {thread_id}")
            continue

        # Mark as read IMMEDIATELY to prevent concurrent Pub/Sub invocations
        # from picking up the same email (closes the race window)
        _mark_message_read(gmail_service, msg_id)
        processed_msg_ids.add(msg_id)

        # FIX-1: Hard guard — skip any email sent by our own address to prevent reply loops
        if own_mailbox_email and own_mailbox_email in sender.lower():
            print(f"[{msg_id}] Skipping self-sent email: {subject}")
            continue

        # Extract body text
        email_body = extract_email_body(email_data['payload'])
        if not email_body.strip():
            email_body = email_data.get('snippet', '')
            print(f"[{msg_id}] WARNING: Body extraction empty, using snippet: {email_body[:200]}")

        print(f"[{msg_id}] Processing email: {subject} from {sender}")
        body_preview = email_body[:300] # Use a preview for logging
        print(
            f"[{msg_id}] Email body length: {len(email_body)} chars | "
            f"thread={thread_id} | Preview: {body_preview}"
        )

        # Refresh thread state for each message to avoid stale dedup snapshots.
        existing = _get_thread_record(supabase, workspace_id, thread_id)
        if existing:
            known_threads[thread_id] = existing
        else:
            existing = known_threads.get(thread_id)

        # 2. CLASSIFY EMAIL
        email_category = classify_email(modal_llm_client, subject, sender, body_preview,
                                           fallback_llm_client=openai_client)
        print(f"[{msg_id}] Classification: {email_category}")

        if email_category in ('agent_rate_reply', 'booking_confirmation', 'out_of_scope'):
            print(f"Skipping email (category: {email_category}): {subject}")
            continue

        # DEDUPLICATION: Check if this thread was already processed
        if existing:
            existing_status = existing['status']
            if existing_status in ('Missing_Port_Data', 'Missing_Door_Data'):
                # Thread needs more data — allow processing as followup
                print(
                    f"[{msg_id}] Thread {thread_id} needs data "
                    f"({existing_status}), processing as followup"
                )
            elif existing_status in ('Quoted', 'Followed_Up') and email_category == 'customer_followup':
                print(f"[{msg_id}] Customer replied to quoted thread {thread_id}. Updating status.")
                try:
                    scoped_update_by_eq(
                        supabase,
                        "master_rfqs",
                        workspace_id,
                        {"status": "Customer_Replied"},
                        "thread_id",
                        thread_id,
                    )
                    known_threads[thread_id] = {
                        "status": "Customer_Replied",
                        "rfq_id": existing.get("rfq_id") or "",
                    }
                except Exception as update_exc:
                    print(
                        f"[{msg_id}] Failed to update thread {thread_id} "
                        f"to Customer_Replied: {update_exc}"
                    )
                continue
            else:
                # Already processed (Processing, Parse_Error, etc.) — skip
                print(
                    f"[{msg_id}] Thread {thread_id} already processed "
                    f"(status: {existing_status}), skipping"
                )
                continue

        # Only process customer_rfq and customer_followup
        email_meta = {
            'id': msg_id,
            'thread_id': thread_id,
            'subject': subject,
            'from': sender,
            'rfc_message_id': rfc_message_id,
        }

        # Use existing RFQ ID for followups, generate new for fresh threads
        rfq_id = existing['rfq_id'] if existing and existing['rfq_id'] else generate_rfq_id(thread_id)
        now_str = datetime.now(UAE_TZ).strftime('%Y-%m-%d %I:%M %p')

        # 3. Ask OpenAI to extract structured data
        prompt = build_phase1_extraction_prompt(
            subject=subject,
            sender=sender,
            email_body=email_body,
            received_at=received_at_header,
        )

        try:
            response = openai_client.beta.chat.completions.parse(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": AI_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0,
                response_format=ExtractedRFQs
            )
            extracted = response.choices[0].message.parsed

            if not extracted.shipments:
                print(f"[{msg_id}] No logistics data found in email: {subject}. Handling as fallback.")
                # Fallback: log + reply + notify admin
                fallback_ok = _handle_fallback(
                    gmail_service,
                    supabase,
                    rfq_id,
                    own_mailbox_email,
                    sender,
                    thread_id,
                    rfc_message_id,
                    subject,
                    email_body,
                    email_meta,
                    now_str,
                    workspace_id,
                    msg_id=msg_id,
                )
                if fallback_ok:
                    known_threads[thread_id] = {"status": "Parse_Error", "rfq_id": rfq_id}
                continue

            # 4. Validate and normalize each shipment
            shipments = [validate_shipment(s.model_dump(), i) for i, s in enumerate(extracted.shipments)]
            is_multi = extracted.multi or len(shipments) > 1
            # count = number of route-level shipments (1 row per route in agent_outbound_log)
            count = len(shipments) or 1

            # 5. Determine routing action
            action = determine_routing_action(shipments)
            has_door = any(s['service_type'] != 'port-to-port' for s in shipments)
            sheets_data = concatenate_shipments(shipments)

            print(f"Routing action: {action}, has_door: {has_door}")

            def _safe_date(val):
                """Return None if the value is missing, 'TBD', or contains 'TBD'."""
                if not val or not isinstance(val, str):
                    return None
                # For multi-shipment: take the first valid YYYY-MM-DD date found
                import re as _re
                dates = _re.findall(r'\d{4}-\d{2}-\d{2}', val)
                return dates[0] if dates else None

            def _safe_text(val):
                """Return value for DB, preserving newline-separated multi-values."""
                if not val or not isinstance(val, str):
                    return None
                stripped = val.strip()
                if not stripped or stripped.upper() in ('TBD', 'N/A'):
                    return None
                return stripped

            # 6. Prepare common sheet data
            sheet_row = {
                'thread_id': thread_id,
                'rfq_id': rfq_id,
                'customer_email': sender,
                'received_at': now_str,
                'pol': _safe_text(sheets_data['pol']),
                'pod': _safe_text(sheets_data['pod']),
                'container_type': _safe_text(sheets_data['container_type']),
                'qty': _safe_text(sheets_data['qty']),
                'ready_date': _safe_date(sheets_data['ready_date']),
                'delivery_deadline': _safe_date(sheets_data.get('delivery_deadline')),
                'service_type': sheets_data['service_type'],
                'pickup_address': sheets_data['pickup_address'] or None,
                'delivery_address': sheets_data['delivery_address'] or None,
            }

            # Build formatted content
            current_details = format_current_details(shipments, is_multi)
            missing_formatted = format_missing_fields(shipments, has_door)
            pricing_content = format_pricing_content(shipments, is_multi)
            subject_line = build_subject_line(shipments, is_multi, count, action)

            # 7. Route based on action
            if action == 'complete':
                sheet_row['status'] = 'Processing'
                try:
                    _upsert_row(supabase, "master_rfqs", sheet_row, workspace_id)
                except Exception as upsert_exc:
                    if is_unique_violation(upsert_exc):
                        print(
                            f"[{msg_id}] Duplicate thread detected at write time "
                            f"(thread={thread_id}); skipping side-effects."
                        )
                        refreshed = _get_thread_record(supabase, workspace_id, thread_id)
                        if refreshed:
                            known_threads[thread_id] = refreshed
                        continue
                    raise
                known_threads[thread_id] = {'status': 'Processing', 'rfq_id': rfq_id}
                print(f"RFQ {rfq_id} is complete. Sending agent outreach...")

                # Send rate requests to agents
                _send_agent_outreach(
                    gmail_service, supabase, workspace_id, rfq_id, shipments,
                    is_multi, count, action, pricing_content, subject_line
                )

            elif action == 'need_door_data':
                sheet_row['status'] = 'Missing_Door_Data'
                try:
                    _upsert_row(supabase, "master_rfqs", sheet_row, workspace_id)
                except Exception as upsert_exc:
                    if is_unique_violation(upsert_exc):
                        print(
                            f"[{msg_id}] Duplicate thread detected at write time "
                            f"(thread={thread_id}); skipping side-effects."
                        )
                        refreshed = _get_thread_record(supabase, workspace_id, thread_id)
                        if refreshed:
                            known_threads[thread_id] = refreshed
                        continue
                    raise
                known_threads[thread_id] = {'status': 'Missing_Door_Data', 'rfq_id': rfq_id}
                send_door_data_reply(gmail_service, sender, thread_id, rfc_message_id,
                                     subject, current_details, missing_formatted)
                print(f"Door data reply sent for thread: {thread_id}")

            elif action == 'need_port_data':
                sheet_row['status'] = 'Missing_Port_Data'
                try:
                    _upsert_row(supabase, "master_rfqs", sheet_row, workspace_id)
                except Exception as upsert_exc:
                    if is_unique_violation(upsert_exc):
                        print(
                            f"[{msg_id}] Duplicate thread detected at write time "
                            f"(thread={thread_id}); skipping side-effects."
                        )
                        refreshed = _get_thread_record(supabase, workspace_id, thread_id)
                        if refreshed:
                            known_threads[thread_id] = refreshed
                        continue
                    raise
                known_threads[thread_id] = {'status': 'Missing_Port_Data', 'rfq_id': rfq_id}
                send_port_data_reply(gmail_service, sender, thread_id, rfc_message_id,
                                     subject, current_details, missing_formatted)
                print(f"Port data reply sent for thread: {thread_id}")

        except Exception as e:
            if is_unique_violation(e):
                print(
                    f"[{msg_id}] Duplicate thread conflict during processing "
                    f"(thread={thread_id}); skipping fallback side-effects."
                )
                refreshed = _get_thread_record(supabase, workspace_id, thread_id)
                if refreshed:
                    known_threads[thread_id] = refreshed
                continue
            print(f"Error processing message {msg_id}: {e}")
            # Handle as fallback
            try:
                fallback_ok = _handle_fallback(
                    gmail_service,
                    supabase,
                    rfq_id,
                    own_mailbox_email,
                    sender,
                    thread_id,
                    rfc_message_id,
                    subject,
                    email_body,
                    email_meta,
                    now_str,
                    workspace_id,
                    msg_id=msg_id,
                )
                if fallback_ok:
                    known_threads[thread_id] = {"status": "Parse_Error", "rfq_id": rfq_id}
            except Exception as e2:
                print(f"Fallback handler also failed for {msg_id}: {e2}")
        finally:
            pass  # Mark-as-read already done at top of loop


def _handle_fallback(gmail_service, supabase, rfq_id, notification_email, sender, thread_id,
                     rfc_message_id, subject, email_body, email_meta, now_str, workspace_id,
                     msg_id: str = ""):
    """Handle emails that couldn't be parsed: log, reply to customer, notify workspace."""
    # Log to sheets with Parse_Error status
    sheet_row = {
        'thread_id': thread_id,
        'rfq_id': rfq_id,
        'customer_email': sender,
        'status': 'Parse_Error',
        'pol': 'UNKNOWN',
        'service_type': 'port-to-port',
        'received_at': now_str,
    }
    try:
        _upsert_row(supabase, "master_rfqs", sheet_row, workspace_id)
    except Exception as e:
        if is_unique_violation(e):
            print(
                f"[{msg_id or 'fallback'}] Duplicate thread conflict while logging fallback "
                f"(thread={thread_id}); skipping fallback side-effects."
            )
            return False
        print(f"Failed to log fallback to Supabase: {e}")

    # Reply to customer with fallback template
    try:
        send_fallback_reply(gmail_service, sender, thread_id, rfc_message_id, subject)
        print(f"Fallback reply sent for thread: {thread_id}")
    except Exception as e:
        print(f"Failed to send fallback reply: {e}")

    # Notify admin
    try:
        send_fallback_admin_notification(
            gmail_service,
            notification_email,
            rfq_id,
            email_meta,
            email_body,
        )
        print(f"Fallback notification sent for {rfq_id}")
    except Exception as e:
        print(f"Failed to send fallback notification: {e}")
    return True


if __name__ == "__main__":
    app.serve()
