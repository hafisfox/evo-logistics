import base64
import json
import os
from typing import Any, Dict, Optional


BOOTSTRAP_WORKSPACE_ID = os.environ.get(
    "BOOTSTRAP_WORKSPACE_ID", "00000000-0000-0000-0000-000000000001"
)
ALLOW_BOOTSTRAP_WORKSPACE_FALLBACK = os.environ.get(
    "ALLOW_BOOTSTRAP_WORKSPACE_FALLBACK", "false"
).lower() in {"1", "true", "yes", "on"}

TENANT_TABLES = {
    "master_rfqs",
    "rfq_shipments",
    "rfq_shipment_containers",
    "agent_outbound_log",
    "agent_quotes",
    "agents",
    "do_charges",
    "destination_charges",
    "transportation_charges",
    "do_charge_profiles",
    "do_charge_rates",
    "destination_charge_items",
    "destination_charge_rates",
    "app_settings",
    "workspace_mailboxes",
    "workspace_invites",
    "workspace_members",
    "audit_events",
    "processed_email_events",
    "rfq_id_aliases",
}


def extract_pubsub_mailbox(payload: Optional[Dict[str, Any]]) -> Optional[str]:
    """Extract mailbox email from Pub/Sub payload produced by Gmail watch."""
    if not isinstance(payload, dict):
        return None

    message = payload.get("message")
    if not isinstance(message, dict):
        return None

    if isinstance(message.get("attributes"), dict):
        candidate = message["attributes"].get("emailAddress")
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip().lower()

    encoded_data = message.get("data")
    if not isinstance(encoded_data, str) or not encoded_data:
        return None

    try:
        decoded = base64.urlsafe_b64decode(encoded_data + "=" * (-len(encoded_data) % 4))
        parsed = json.loads(decoded.decode("utf-8"))
    except Exception:
        return None

    candidate = parsed.get("emailAddress")
    if isinstance(candidate, str) and candidate.strip():
        return candidate.strip().lower()
    return None


def resolve_workspace_id(supabase, mailbox_email: Optional[str]) -> Optional[str]:
    """Resolve workspace from connected mailbox email.

    Default behavior is strict isolation:
    - connected mailbox mapping -> workspace id
    - unknown/disconnected mailbox -> None

    Optional compatibility mode can be enabled via
    ALLOW_BOOTSTRAP_WORKSPACE_FALLBACK=true to route unresolved events
    to the bootstrap workspace during phased cutover.
    """
    if mailbox_email:
        try:
            row = (
                supabase.table("workspace_mailboxes")
                .select("workspace_id, status")
                .eq("email", mailbox_email)
                .limit(1)
                .execute()
                .data
            )
            if row:
                status = (row[0].get("status") or "").lower()
                if status in ("connected", ""):
                    workspace_id = row[0].get("workspace_id")
                    if workspace_id:
                        return workspace_id
        except Exception:
            pass

    if ALLOW_BOOTSTRAP_WORKSPACE_FALLBACK:
        return BOOTSTRAP_WORKSPACE_ID
    return None


def audit_ignored_mailbox_event(
    supabase,
    *,
    source: str,
    mailbox_email: Optional[str],
    reason: str,
) -> None:
    """Write a minimal audit row when a mailbox event is ignored."""
    try:
        supabase.table("audit_events").insert(
            {
                "workspace_id": BOOTSTRAP_WORKSPACE_ID,
                "action": "automation_mailbox_event_ignored",
                "entity_type": source,
                "entity_id": mailbox_email or "unknown",
                "metadata": {
                    "mailbox_email": mailbox_email,
                    "reason": reason,
                },
            }
        ).execute()
    except Exception:
        # Non-blocking: webhook flow must not fail because audit write failed.
        pass


def scoped_select(supabase, table_name: str, workspace_id: str, columns: str = "*"):
    query = supabase.table(table_name).select(columns)
    if table_name in TENANT_TABLES:
        query = query.eq("workspace_id", workspace_id)
    return query.execute().data or []


def scoped_eq_filter(
    supabase, table_name: str, workspace_id: str, column: str, value: Any, columns: str = "*"
):
    query = supabase.table(table_name).select(columns).eq(column, value)
    if table_name in TENANT_TABLES:
        query = query.eq("workspace_id", workspace_id)
    return query.execute().data or []


def scoped_upsert(supabase, table_name: str, workspace_id: str, row_data: Dict[str, Any]):
    payload = dict(row_data)
    if table_name in TENANT_TABLES and "workspace_id" not in payload:
        payload["workspace_id"] = workspace_id
    supabase.table(table_name).upsert(payload).execute()


def scoped_update_by_eq(
    supabase, table_name: str, workspace_id: str, values: Dict[str, Any], column: str, value: Any
):
    query = supabase.table(table_name).update(values).eq(column, value)
    if table_name in TENANT_TABLES:
        query = query.eq("workspace_id", workspace_id)
    query.execute()


def _extract_pg_error_code(exc: Exception) -> Optional[str]:
    """Extract Postgres error code from PostgREST exceptions."""
    code = getattr(exc, "code", None)
    if code:
        return str(code)

    if getattr(exc, "args", None):
        first_arg = exc.args[0]
        if isinstance(first_arg, dict) and first_arg.get("code"):
            return str(first_arg.get("code"))
    return None


def is_unique_violation(exc: Exception) -> bool:
    """Return True when exception represents UNIQUE VIOLATION (23505)."""
    return _extract_pg_error_code(exc) == "23505"


def claim_email_event(
    supabase,
    *,
    workspace_id: str,
    source: str,
    gmail_message_id: str,
    thread_id: Optional[str],
    subject: Optional[str] = None,
    sender: Optional[str] = None,
) -> bool:
    """Insert idempotency claim row; False if already claimed.

    During phased rollout, fail-open if table is missing.
    """
    payload = {
        "workspace_id": workspace_id,
        "source": source,
        "gmail_message_id": gmail_message_id,
        "thread_id": thread_id,
        "subject": subject,
        "sender": sender,
    }
    try:
        supabase.table("processed_email_events").insert(payload).execute()
        return True
    except Exception as exc:
        code = _extract_pg_error_code(exc)
        if code == "23505":
            return False
        if code == "42P01":
            print(
                "Warning: processed_email_events table missing; "
                "continuing in fail-open mode."
            )
            return True
        raise


def resolve_canonical_rfq_id(supabase, workspace_id: str, rfq_id: str) -> str:
    """Resolve duplicate RFQ IDs via alias table; fallback to original ID."""
    if not rfq_id:
        return rfq_id

    try:
        rows = (
            supabase.table("rfq_id_aliases")
            .select("canonical_rfq_id")
            .eq("workspace_id", workspace_id)
            .eq("duplicate_rfq_id", rfq_id)
            .limit(1)
            .execute()
            .data
            or []
        )
    except Exception as exc:
        code = _extract_pg_error_code(exc)
        if code == "42P01":
            print(
                "Warning: rfq_id_aliases table missing; "
                "continuing without alias resolution."
            )
            return rfq_id
        raise

    if rows and rows[0].get("canonical_rfq_id"):
        return rows[0]["canonical_rfq_id"]
    return rfq_id
