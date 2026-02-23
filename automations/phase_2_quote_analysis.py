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
    resolve_canonical_rfq_id,
    resolve_workspace_id,
    scoped_eq_filter,
    scoped_select,
    scoped_upsert,
)

# =====================================================================
# MODAL APP DEFINITION
# =====================================================================
app = modal.App("quote-analysis-phase-2")

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
QUOTE_THRESHOLD = 2  # Minimum valid quotes before notifying manager
RFQ_NORMALIZED_DUAL_WRITE = os.environ.get(
    "RFQ_NORMALIZED_DUAL_WRITE", "true"
).lower() in {"1", "true", "yes", "on"}

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
    extraction_reasoning: str = Field(description="Step-by-step reasoning linking agent responses to the correct shipment numbers and mapping carrier shorthands. A single price is the TOTAL for all containers on that shipment. Only compute a sum when the agent provides separate per-container-type rates.")
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


_MONTHS = {
    "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
    "JUL": 7, "AUG": 8, "SEP": 9, "SEPT": 9, "OCT": 10, "NOV": 11, "DEC": 12,
}

_QUOTE_HISTORY_MARKERS = [
    re.compile(r'^\s*-{2,}\s*Original Message\s*-{2,}\s*$', re.IGNORECASE | re.MULTILINE),
    re.compile(r'^\s*-----\s*Forwarded message\s*-----\s*$', re.IGNORECASE | re.MULTILINE),
    re.compile(r'^\s*On\s.+wrote:\s*$', re.IGNORECASE | re.MULTILINE),
    re.compile(r'^\s*From:\s.+$', re.IGNORECASE | re.MULTILINE),
    re.compile(r'^\s*Sent:\s.+$', re.IGNORECASE | re.MULTILINE),
]

_CONTEXTUAL_VALIDITY_NULL_PATTERNS = [
    re.compile(r'\bVALID\s+TO\s+TH(?:I|S)\s+VSL\b', re.IGNORECASE),
    re.compile(r'\bSUBJECT\s+TO\s+V(?:ESSEL|SL)\b', re.IGNORECASE),
]


def trim_agent_reply(body: str) -> str:
    """Trim quoted email history and keep only the current reply content."""
    if not body:
        return ""

    cut_idx = len(body)
    for marker in _QUOTE_HISTORY_MARKERS:
        match = marker.search(body)
        if match:
            cut_idx = min(cut_idx, match.start())

    trimmed = body[:cut_idx].strip()
    lines = trimmed.splitlines()
    clean_lines = []
    for line in lines:
        if line.strip().startswith(">"):
            break
        clean_lines.append(line)
    return "\n".join(clean_lines).strip()


def parse_email_received_date(received_at: str) -> datetime:
    """Parse RFC2822 date header and return timezone-aware datetime."""
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


def _parse_positive_int(value, default: int = 1) -> int:
    try:
        num = int(str(value).strip())
        return num if num > 0 else default
    except (ValueError, TypeError):
        return default


def _normalize_container_type(container_type: str) -> str:
    if not container_type:
        return "UNKNOWN"
    cleaned = str(container_type).upper().replace("'", "").replace(" ", "")
    return cleaned or "UNKNOWN"


def build_shipment_context(rfq: dict) -> dict:
    """Build shipment-level context from master RFQ row."""
    pols = parse_multi_value(rfq.get("pol"))
    pods = parse_multi_value(rfq.get("pod"))
    container_types = parse_multi_value(rfq.get("container_type"))
    qtys = parse_multi_value(rfq.get("qty"))

    service_type = (rfq.get("service_type") or "port-to-port").strip().lower()
    route_groups = []
    prev_key = None

    for idx in range(len(container_types)):
        pol = pols[idx] if idx < len(pols) else (pols[-1] if pols else "N/A")
        pod = pods[idx] if idx < len(pods) else (pods[-1] if pods else "N/A")
        route_key = f"{pol}|{pod}"
        if route_key != prev_key:
            route_groups.append({
                "shipment_number": len(route_groups) + 1,
                "pol": pol,
                "pod": pod,
                "service_type": service_type,
                "containers": [],
            })
            prev_key = route_key

        route_groups[-1]["containers"].append({
            "qty": _parse_positive_int(qtys[idx] if idx < len(qtys) else 1, 1),
            "type": _normalize_container_type(container_types[idx]),
        })

    if not route_groups:
        route_groups = [{
            "shipment_number": 1,
            "pol": pols[0] if pols else "N/A",
            "pod": pods[0] if pods else "N/A",
            "service_type": service_type,
            "containers": [{
                "qty": _parse_positive_int(qtys[0], 1) if qtys else 1,
                "type": _normalize_container_type(container_types[0]) if container_types else "UNKNOWN",
            }],
        }]

    return {
        "shipment_count": len(route_groups),
        "shipments": route_groups,
    }


def format_shipment_context_for_prompt(context: dict) -> str:
    parts = []
    for shipment in context.get("shipments", []):
        containers = ", ".join(
            f"{c.get('qty', 1)}x{c.get('type', 'UNKNOWN')}"
            for c in shipment.get("containers", [])
        )
        parts.append(
            f"Shipment {shipment.get('shipment_number')}: "
            f"{shipment.get('pol', 'N/A')} -> {shipment.get('pod', 'N/A')} | "
            f"{containers or 'UNKNOWN'} | service={shipment.get('service_type', 'port-to-port')}"
        )
    return "\n".join(parts).strip()


def detect_explicit_shipment_mapping(email_body: str) -> bool:
    return bool(re.search(r'\bSHIPMENT\s*\d+\b', email_body or "", flags=re.IGNORECASE))


def _normalize_contextual_validity(value: Optional[str]) -> Optional[str]:
    if not value or not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    for pattern in _CONTEXTUAL_VALIDITY_NULL_PATTERNS:
        if pattern.search(text):
            return None
    return text


def normalize_partial_date(value: Optional[str], anchor_date: datetime) -> Optional[str]:
    """Normalize date-like strings into YYYY-MM-DD when possible."""
    if not value:
        return None
    text = str(value).strip()
    if not text or text.upper() in {"N/A", "NA", "TBD", "NONE", "NULL"}:
        return None

    iso_match = re.match(r'^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$', text)
    if iso_match:
        year, month, day = map(int, iso_match.groups())
        try:
            return datetime(year, month, day).strftime('%Y-%m-%d')
        except ValueError:
            return None

    compact_match = re.match(r'^(\d{1,2})\s*[-/]\s*(\d{1,2})$', text)
    if compact_match:
        first, second = map(int, compact_match.groups())
        if first > 12 and second <= 12:
            day, month = first, second
        else:
            month, day = first, second
        try:
            return datetime(anchor_date.year, month, day).strftime('%Y-%m-%d')
        except ValueError:
            return None

    cleaned = re.sub(r'[,;]', ' ', text)
    cleaned = re.sub(r'(\d+)(ST|ND|RD|TH)\b', r'\1', cleaned, flags=re.IGNORECASE)
    tokens = [tok for tok in cleaned.split() if tok]

    for i, tok in enumerate(tokens):
        mon_key = tok[:3].upper()
        if mon_key not in _MONTHS:
            continue
        month = _MONTHS[mon_key]
        day = None
        year = anchor_date.year

        if i > 0 and tokens[i - 1].isdigit():
            day = int(tokens[i - 1])
        elif i + 1 < len(tokens) and tokens[i + 1].isdigit():
            day = int(tokens[i + 1])

        if i + 1 < len(tokens) and re.fullmatch(r'\d{4}', tokens[i + 1]):
            year = int(tokens[i + 1])
        elif i + 2 < len(tokens) and re.fullmatch(r'\d{4}', tokens[i + 2]):
            year = int(tokens[i + 2])

        if day is None:
            continue
        try:
            return datetime(year, month, day).strftime('%Y-%m-%d')
        except ValueError:
            continue

    return None


def sanitize_extracted_quotes(
    parsed_quotes: List[QuoteData],
    shipment_count: int,
    anchor_date: datetime,
    has_explicit_shipment_mapping: bool,
) -> List[QuoteData]:
    """Deterministically sanitize parser output before persistence."""
    if shipment_count > 1 and not has_explicit_shipment_mapping:
        valid_candidate_shipments = {
            int(q.shipment_number)
            for q in parsed_quotes
            if q.price is not None and q.price > 0
        }
        if valid_candidate_shipments in (set(), {1}):
            return []

    cleaned: List[QuoteData] = []
    seen = set()
    for quote in parsed_quotes:
        try:
            shipment_number = int(quote.shipment_number)
        except (ValueError, TypeError):
            continue

        if shipment_number < 1 or shipment_number > max(shipment_count, 1):
            continue

        price = quote.price
        if price is None or price <= 0:
            continue

        carrier = normalize_carrier(quote.carrier)
        etd = normalize_partial_date(quote.etd, anchor_date)
        validity_text = _normalize_contextual_validity(quote.validity)
        validity = normalize_partial_date(validity_text, anchor_date)

        sanitized = QuoteData(
            shipment_number=shipment_number,
            price=float(price),
            currency="USD",
            carrier=carrier,
            validity=validity,
            transit_time=quote.transit_time,
            free_time=quote.free_time,
            etd=etd,
        )

        dedupe_key = (
            sanitized.shipment_number,
            sanitized.carrier,
            sanitized.price,
            sanitized.etd,
            sanitized.transit_time,
            sanitized.free_time,
            sanitized.validity,
        )
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        cleaned.append(sanitized)

    return cleaned


def build_quote_match_key(rfq_id: str, agent_email: str, quote: QuoteData) -> str:
    fingerprint = (
        f"{quote.price}|{quote.etd or ''}|{quote.transit_time or ''}|"
        f"{quote.free_time or ''}|{quote.validity or ''}"
    )
    short_hash = hashlib.sha1(fingerprint.encode("utf-8")).hexdigest()[:8]
    return (
        f"{rfq_id}_{agent_email}_{quote.shipment_number}_"
        f"{normalize_carrier(quote.carrier)}_{short_hash}"
    )

# =====================================================================
# GOOGLE APIS
# =====================================================================
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


def _normalize_iso_date(value: Optional[str]) -> Optional[str]:
    if not value or not isinstance(value, str):
        return None
    cleaned = value.strip()
    if not cleaned or cleaned.upper() in {"N/A", "NO_QUOTE", "TBD"}:
        return None
    match = re.match(r"^(\d{4}-\d{2}-\d{2})", cleaned)
    if match:
        return match.group(1)
    return None


def _parse_nullable_int(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    cleaned = str(value).strip()
    if not cleaned or cleaned.upper() in {"N/A", "NO_QUOTE", "TBD"}:
        return None
    try:
        parsed = int(cleaned)
        return parsed if parsed > 0 else None
    except (ValueError, TypeError):
        return None


def _parse_nullable_price(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    cleaned = str(value).replace(",", "").strip()
    if not cleaned or cleaned.upper() in {"N/A", "NO_QUOTE", "TBD"}:
        return None
    try:
        parsed = float(cleaned)
        return parsed if parsed > 0 else None
    except (ValueError, TypeError):
        return None


def _ensure_quote_shipment_row(supabase, workspace_id: str, rfq_row: dict, shipment_number: int):
    existing = (
        supabase.table("rfq_shipments")
        .select("shipment_number")
        .eq("workspace_id", workspace_id)
        .eq("rfq_id", rfq_row.get("rfq_id"))
        .eq("shipment_number", shipment_number)
        .limit(1)
        .execute()
        .data
        or []
    )
    if existing:
        return

    context = build_shipment_context(rfq_row)
    shipment = next(
        (s for s in context.get("shipments", []) if int(s.get("shipment_number", 0)) == shipment_number),
        None,
    )
    if shipment is None:
        shipment = {
            "shipment_number": shipment_number,
            "pol": parse_multi_value(rfq_row.get("pol"))[0] if parse_multi_value(rfq_row.get("pol")) else "TBD",
            "pod": parse_multi_value(rfq_row.get("pod"))[0] if parse_multi_value(rfq_row.get("pod")) else "TBD",
            "service_type": (rfq_row.get("service_type") or "port-to-port").lower().strip(),
            "containers": [{"qty": 1, "type": "40HQ"}],
        }

    scoped_upsert(
        supabase,
        "rfq_shipments",
        workspace_id,
        {
            "rfq_id": rfq_row.get("rfq_id"),
            "shipment_number": shipment_number,
            "pol": shipment.get("pol") or "TBD",
            "pod": shipment.get("pod") or "TBD",
            "ready_date": _normalize_iso_date(str(rfq_row.get("ready_date") or "")),
            "delivery_deadline": _normalize_iso_date(str(rfq_row.get("delivery_deadline") or "")),
            "service_type": shipment.get("service_type") or "port-to-port",
            "pickup_address": rfq_row.get("pickup_address"),
            "delivery_address": rfq_row.get("delivery_address"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    containers = shipment.get("containers") or [{"qty": 1, "type": "40HQ"}]
    for idx, container in enumerate(containers):
        scoped_upsert(
            supabase,
            "rfq_shipment_containers",
            workspace_id,
            {
                "rfq_id": rfq_row.get("rfq_id"),
                "shipment_number": shipment_number,
                "line_number": idx + 1,
                "container_type": _normalize_container_type(container.get("type")),
                "qty": _parse_positive_int(container.get("qty"), 1),
            },
        )


def _dual_write_agent_quote(
    supabase,
    workspace_id: str,
    rfq_row: dict,
    log_data: dict,
    *,
    source: str,
):
    if not RFQ_NORMALIZED_DUAL_WRITE:
        return
    try:
        shipment_number = _parse_positive_int(log_data.get("shipment_number"), 1)
        _ensure_quote_shipment_row(supabase, workspace_id, rfq_row, shipment_number)

        payload = {
            "workspace_id": workspace_id,
            "rfq_id": rfq_row.get("rfq_id"),
            "shipment_number": shipment_number,
            "match": log_data.get("match"),
            "agent_name": log_data.get("agent_name") or "Unknown",
            "agent_email": log_data.get("agent_email") or "unknown@example.com",
            "carrier": log_data.get("carrier") or "N/A",
            "price": _parse_nullable_price(log_data.get("price")),
            "currency": (log_data.get("currency") or "USD"),
            "etd": _normalize_iso_date(log_data.get("etd")),
            "transit_time": _parse_nullable_int(log_data.get("transit_time")),
            "free_time": _parse_nullable_int(log_data.get("free_time")),
            "validity": _normalize_iso_date(log_data.get("validity")),
            "status": log_data.get("status") or "Invalid_Quote",
            "sent_at": log_data.get("sent_at"),
            "received_at": log_data.get("received_at"),
            "raw_meta": {"source": source},
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        supabase.table("agent_quotes").upsert(
            payload,
            on_conflict="workspace_id,match",
        ).execute()
    except Exception as exc:
        print(f"Warning: normalized quote dual-write failed for {log_data.get('match')}: {exc}")

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
AI_SYSTEM_PROMPT = """You are a Freight Rate Parser.

Your input includes authoritative RFQ context and one trimmed agent reply.
Return ocean freight quotes only, with conservative extraction rules.

CONSERVATIVE RULES:
1) Extract only explicit ocean-freight quotes (O/F, Ocean Freight, Our rate, best offer, USDxxxx/20GP, USDxxxx/40HQ, table columns like 40HQ($)).
2) If no explicit ocean-freight amount is present, return quotes: [].
3) If multiple shipments exist and mapping to shipment_number is ambiguous, return quotes: [] for ambiguous content.
4) A single price quoted for a shipment (same POL, POD, ready date) is ALWAYS the TOTAL price for ALL containers on that shipment combined — do NOT multiply it by container count or quantity. Only multiply when the agent explicitly provides SEPARATE per-container-type rates (e.g. "40FT: USD800, 20FT: USD500") — in that case multiply each rate by its RFQ quantity and sum them.
5) If one message contains multiple valid options for the same shipment/carrier (different ETD/vessel/price), return all options as separate quote objects.

EXCLUDE THESE FROM PRICE (never add into ocean-freight total):
EXW, THC, DOC, CUS, ENS, NOC, COMMODITY INSPECTION, INSPECTION, TLX, CO, handling fee, local charges, POD local charges.

DATE RULES:
1) Normalize dates as YYYY-MM-DD.
2) If year is omitted, infer from email_received_at.
3) If only contextual validity is provided (e.g., "valid to this vessel", "subject to vessel"), set validity to null.
4) ETD range: choose earlier date.

TIME RULES:
1) Parse transit time from TT/T,T/transit days.
2) Parse free time from phrases like "14 days free", "14 FT", "free time 14".

OUTPUT SCHEMA (RAW JSON ONLY):
{
  "extraction_reasoning": "brief deterministic reasoning",
  "quotes": [
    {
      "shipment_number": 1,
      "price": 2400,
      "currency": "USD",
      "carrier": "SSL",
      "validity": null,
      "transit_time": 15,
      "free_time": 14,
      "etd": "2026-01-20"
    }
  ]
}

FEW-SHOT PATTERNS:
1) Narrative with extras:
Input: "Shenzhen to Jebel Ali USD2350/40HQ ... EXW USD550 ... export license USD200"
Output: price=2350 only, EXW/license excluded.

2) Table row format:
Input row: POL=Qingdao POD=Jebel Ali Carrier=SSL 40HQ($)=2050 Cut off=11-Jan ETD=14-Jan T/T=31 Free Time=14
Output: one quote with price=2050, carrier=SSL, etd, transit_time=31, free_time=14.

3) Same-carrier multi-option:
Input includes two SSL offers for same shipment with different ETD/price.
Output: two quote objects with same shipment_number and carrier, different fields.

4) No-rate / no-space:
Input: "space full", "no slot", "closed", no amount.
Output: quotes=[].

5) Mixed abbreviations:
Input: "ETD 1/20 ... TT about 27days ... 14 FT"
Output: etd normalized with inferred year, transit_time=27, free_time=14.

6) Single price for multi-container shipment (MOST COMMON CASE):
RFQ: 2x40FT + 1x20FT, SHENZHEN → JEBEL ALI. Agent: "Price: USD 1900"
Output: price=1900. This is the TOTAL for all 3 containers — do NOT multiply.

7) Per-container-type breakdown (requires multiplication):
RFQ: 2x40FT + 1x20FT. Agent: "40FT: USD700, 20FT: USD500"
Output: price = (700×2) + (500×1) = 1900.

CRITICAL:
- Use RFQ_CONTEXT shipment numbering.
- currency must be USD.
- Return only raw JSON, no markdown/backticks/text."""

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
def send_manager_notification(gmail_service, to_address: str, summary: dict):
    """Send enriched quote summary email to workspace mailbox."""
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
    if not to_address:
        print(f"No workspace notification mailbox configured for {rfq_ref}")
        return
    send_email(gmail_service, to_address, subject, body_html, content_type="text/html")

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
# CORE QUOTE PROCESSING LOGIC
# =====================================================================
def _process_agent_quotes(pubsub_payload=None):
    supabase = get_supabase_client()
    mailbox_email = extract_pubsub_mailbox(pubsub_payload)
    workspace_id = resolve_workspace_id(supabase, mailbox_email)
    if not workspace_id:
        audit_ignored_mailbox_event(
            supabase,
            source="phase_2_quote_analysis",
            mailbox_email=mailbox_email,
            reason="mailbox_not_connected_or_unmapped",
        )
        print(
            "Ignoring Phase 2 webhook event because mailbox is not connected "
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
            source="phase_2_quote_analysis",
            mailbox_email=mailbox_email,
            reason="mailbox_auth_failed",
        )
        print(f"Skipping Phase 2 processing due to mailbox auth error: {exc}")
        return

    # BUG-4 Fix: Only fetch agent rate replies to prevent race condition with Phase 1
    gmail_query = 'is:unread subject:"Ref: RFQ-"'
    if own_mailbox_email:
        gmail_query = f"{gmail_query} -from:{own_mailbox_email}"
    results = _gmail_call_with_backoff(
        gmail_service.users().messages().list(userId='me', q=gmail_query)
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
        if own_mailbox_email and own_mailbox_email in sender.lower():
            print(f"Skipping self-sent email: {subject}")
            _gmail_call_with_backoff(
                gmail_service.users().messages().modify(
                    userId='me', id=msg_id, body={'removeLabelIds': ['UNREAD']}
                )
            )
            continue

        claimed = claim_email_event(
            supabase,
            workspace_id=workspace_id,
            source="phase_2_quote_analysis",
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
            _gmail_call_with_backoff(
                gmail_service.users().messages().modify(
                    userId='me', id=msg_id, body={'removeLabelIds': ['UNREAD']}
                )
            )
            print(f"[{msg_id}] Skipping duplicate delivery for thread {thread_id}")
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
        canonical_ref_id = resolve_canonical_rfq_id(supabase, workspace_id, ref_id)
        if canonical_ref_id != ref_id:
            print(
                f"[{msg_id}] RFQ alias resolved: {ref_id} -> {canonical_ref_id}"
            )

        master_rows = _get_rows_by_filter(
            supabase, "master_rfqs", "rfq_id", canonical_ref_id, workspace_id
        )
        if not master_rows:
            print(f"No master RFQ row found for {canonical_ref_id}, skipping message.")
            continue
        rfq_row = master_rows[0]
        shipment_context = build_shipment_context(rfq_row)
        shipment_context_text = format_shipment_context_for_prompt(shipment_context)

        agent_name, agent_email = extract_agent_info(sender)

        # Extract body
        email_body = extract_email_body(email_data['payload'])
        if not email_body.strip():
            email_body = email_data.get('snippet', '')
        trimmed_body = trim_agent_reply(email_body)
        if not trimmed_body:
            trimmed_body = email_body.strip()

        received_dt = parse_email_received_date(received_at)
        has_explicit_shipment_mapping = detect_explicit_shipment_mapping(trimmed_body)

        print(f"Processing agent quote: {subject} from {agent_name} ({agent_email})")

        # Call AI to parse quotes
        prompt = (
            f"RFQ_CONTEXT\n"
            f"rfq_id: {canonical_ref_id}\n"
            f"email_received_at: {received_dt.strftime('%Y-%m-%d')}\n"
            f"subject: {subject}\n"
            f"shipment_count: {shipment_context.get('shipment_count', 1)}\n"
            f"{shipment_context_text}\n\n"
            f"AGENT_EMAIL_METADATA\n"
            f"agent_name: {agent_name}\n"
            f"agent_email: {agent_email}\n\n"
            f"AGENT_REPLY_CURRENT_MESSAGE\n"
            f"\"\"\"\n{trimmed_body}\n\"\"\""
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
            sanitized_quotes = sanitize_extracted_quotes(
                parsed_quotes=extracted.quotes,
                shipment_count=shipment_context.get("shipment_count", 1),
                anchor_date=received_dt,
                has_explicit_shipment_mapping=has_explicit_shipment_mapping,
            )

            if not sanitized_quotes:
                # Agent declined, ambiguous, or no valid quotes — log as invalid
                match_key = f"{canonical_ref_id}_{agent_email}_invalid_{msg_id}"
                log_data = {
                    'rfq_id': canonical_ref_id,
                    'match': match_key,
                    'status': 'Invalid_Quote',
                    'agent_name': agent_name,
                    'agent_email': agent_email,
                    'carrier': 'N/A',
                    'price': None,
                    'currency': 'N/A',
                    'etd': None,
                    'transit_time': 'N/A',
                    'free_time': 'N/A',
                    'validity': None,
                    'received_at': now_str,
                }
                _upsert_row(supabase, "agent_outbound_log", log_data, workspace_id)
                _dual_write_agent_quote(
                    supabase,
                    workspace_id,
                    rfq_row,
                    log_data,
                    source="phase_2_quote_analysis_invalid",
                )
                print(f"No valid quotes from {agent_name}, logged as Invalid_Quote")
                continue

            # Process each quote
            for quote in sanitized_quotes:
                carrier = normalize_carrier(quote.carrier)
                price = quote.price
                is_valid = (
                    price is not None and
                    not isinstance(price, str) and
                    price > 0
                )

                match_key = build_quote_match_key(canonical_ref_id, agent_email, quote)
                log_data = {
                    'rfq_id': canonical_ref_id,
                    'match': match_key,
                    'status': 'Received' if is_valid else 'Invalid_Quote',
                    'agent_name': agent_name,
                    'agent_email': agent_email,
                    'shipment_number': str(quote.shipment_number),
                    'carrier': carrier,
                    'price': str(price) if is_valid else 'N/A',
                    'currency': quote.currency or 'USD',
                    'etd': quote.etd or None,
                    'transit_time': str(quote.transit_time) if quote.transit_time else 'N/A',
                    'free_time': str(quote.free_time) if quote.free_time else 'N/A',
                    'validity': quote.validity or None,
                    'received_at': now_str,
                }

                _upsert_row(supabase, "agent_outbound_log", log_data, workspace_id)
                _dual_write_agent_quote(
                    supabase,
                    workspace_id,
                    rfq_row,
                    log_data,
                    source="phase_2_quote_analysis_valid",
                )
                print(f"Quote logged: {agent_name} / {carrier} / ${price} (shipment {quote.shipment_number})")

            # After logging all quotes, check threshold
            _check_threshold_and_notify(
                gmail_service,
                supabase,
                canonical_ref_id,
                workspace_id,
                own_mailbox_email,
            )

        except Exception as e:
            print(f"Error processing quote from {agent_name}: {e}")
            # Log error but continue processing other messages
            try:
                match_key = f"{canonical_ref_id}_{agent_email}_error_{msg_id}"
                _upsert_row(supabase, "agent_outbound_log", {
                    'rfq_id': canonical_ref_id,
                    'match': match_key,
                    'status': 'Invalid_Quote',
                    'agent_name': agent_name,
                    'agent_email': agent_email,
                    'carrier': 'N/A',
                    'shipment_number': '1',
                    'received_at': datetime.now(UAE_TZ).strftime('%Y-%m-%d %I:%M %p'),
                }, workspace_id)
                _dual_write_agent_quote(
                    supabase,
                    workspace_id,
                    rfq_row,
                    {
                        'rfq_id': canonical_ref_id,
                        'match': match_key,
                        'status': 'Invalid_Quote',
                        'agent_name': agent_name,
                        'agent_email': agent_email,
                        'carrier': 'N/A',
                        'shipment_number': '1',
                        'received_at': datetime.now(UAE_TZ).strftime('%Y-%m-%d %I:%M %p'),
                    },
                    source="phase_2_quote_analysis_exception",
                )
            except Exception:
                pass


def _check_threshold_and_notify(
    gmail_service,
    supabase,
    ref_id: str,
    workspace_id: str,
    notification_email: str,
):
    """Check if enough valid quotes received and notify manager.

    Sends the notification exactly once: only when the RFQ status is 'Processing'
    and the threshold is freshly met. After notifying, status is updated to prevent
    duplicate notifications on subsequent quote arrivals.
    """
    # Get the master RFQ
    master_rows = _get_rows_by_filter(supabase, "master_rfqs", "rfq_id", ref_id, workspace_id)
    if not master_rows:
        print(f"No master_rfqs row found for {ref_id}")
        return

    rfq = master_rows[0]

    # Only notify when still in Processing state — guards against repeated notifications
    current_status = (rfq.get("status") or "").strip()
    if current_status.lower() != "processing":
        print(f"Skipping threshold notify for {ref_id}: status is '{current_status}' (not Processing)")
        return

    # Get all quotes for this RFQ
    all_quote_rows = _get_rows_by_filter(supabase, "agent_outbound_log", "rfq_id", ref_id, workspace_id)

    # Build summary
    summary = build_quote_summary(rfq, all_quote_rows)

    if summary['threshold_met'] and summary['quote_count'] == QUOTE_THRESHOLD:
        # Only notify at the exact threshold crossing (not on every subsequent quote)
        print(f"Threshold crossed for {ref_id}: {summary['quote_count']} valid quotes — notifying manager")

        # Send manager notification
        try:
            send_manager_notification(gmail_service, notification_email, summary)
            print(f"Manager notification sent for {ref_id}")
        except Exception as e:
            print(f"Failed to send manager notification: {e}")
    elif summary['threshold_met']:
        print(f"Threshold already met for {ref_id}: {summary['quote_count']} quotes (notification already sent at {QUOTE_THRESHOLD})")
    else:
        print(f"Threshold not met for {ref_id}: {summary['quote_count']}/{QUOTE_THRESHOLD} valid quotes")


if __name__ == "__main__":
    app.serve()
