import base64
import json
import os
from typing import Any, Dict, Optional


BOOTSTRAP_WORKSPACE_ID = os.environ.get(
    "BOOTSTRAP_WORKSPACE_ID", "00000000-0000-0000-0000-000000000001"
)

TENANT_TABLES = {
    "master_rfqs",
    "agent_outbound_log",
    "agents",
    "do_charges",
    "destination_charges",
    "transportation_charges",
    "app_settings",
    "workspace_mailboxes",
    "workspace_invites",
    "workspace_members",
    "audit_events",
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


def resolve_workspace_id(supabase, mailbox_email: Optional[str]) -> str:
    """Resolve workspace from connected mailbox email, fallback to bootstrap workspace."""
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

    return BOOTSTRAP_WORKSPACE_ID


def scoped_select(supabase, table_name: str, workspace_id: str):
    query = supabase.table(table_name).select("*")
    if table_name in TENANT_TABLES:
        query = query.eq("workspace_id", workspace_id)
    return query.execute().data or []


def scoped_eq_filter(supabase, table_name: str, workspace_id: str, column: str, value: Any):
    query = supabase.table(table_name).select("*").eq(column, value)
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

