import os
import base64
from datetime import datetime, timezone, timedelta

import modal
from gmail_workspace_auth import (
    WorkspaceMailboxAuthError,
    get_gmail_service_for_workspace,
)
from tenant_context import scoped_select, scoped_eq_filter

# =====================================================================
# TIMEZONES
# =====================================================================
UAE_TZ = timezone(timedelta(hours=4))
CHINA_TZ = timezone(timedelta(hours=8))

# =====================================================================
# MODAL APP DEFINITION
# =====================================================================
app = modal.App("scheduled-tasks")

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "cryptography",
    "google-api-python-client",
    "google-auth-httplib2",
    "google-auth-oauthlib",
    "supabase"
).add_local_file(
    os.path.join(os.path.dirname(__file__), "tenant_context.py"),
    "/root/tenant_context.py"
).add_local_file(
    os.path.join(os.path.dirname(__file__), "gmail_workspace_auth.py"),
    "/root/gmail_workspace_auth.py"
)

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


def _get_workspace_gmail_client(supabase, workspace_id, cache):
    if not workspace_id:
        return None, None
    if workspace_id in cache:
        cached = cache[workspace_id]
        return cached if cached else (None, None)

    try:
        gmail_service, mailbox_email = get_gmail_service_for_workspace(
            supabase, workspace_id
        )
        cache[workspace_id] = (gmail_service, mailbox_email)
        return gmail_service, mailbox_email
    except WorkspaceMailboxAuthError as exc:
        print(
            f"Skipping workspace {workspace_id} scheduled emails due to mailbox auth error: {exc}"
        )
        cache[workspace_id] = None
        return None, None

# =====================================================================
# EMAIL SENDING HELPERS
# =====================================================================
def send_email(gmail_service, to_address: str, subject: str, body: str, content_type: str = "text/plain"):
    ct_header = f"Content-Type: {content_type}; charset=utf-8\n" if content_type != "text/plain" else ""
    raw_msg = f"To: {to_address}\n{ct_header}Subject: {subject}\n\n{body}"
    b64_message = base64.urlsafe_b64encode(raw_msg.encode('utf-8')).decode('utf-8')
    gmail_service.users().messages().send(userId='me', body={'raw': b64_message}).execute()

def send_reply_email(gmail_service, to_address: str, thread_id: str, subject: str, body: str):
    thread = gmail_service.users().threads().get(userId='me', id=thread_id).execute()
    messages = thread.get('messages', [])

    reference_msg_id = ""
    if messages:
        last_msg = messages[-1]
        msg_headers = {h['name']: h['value'] for h in last_msg.get('payload', {}).get('headers', [])}
        reference_msg_id = msg_headers.get('Message-ID', '')
        
    raw_msg = (
        f"To: {to_address}\n"
        f"In-Reply-To: {reference_msg_id}\n"
        f"References: {reference_msg_id}\n"
        f"Subject: Re: {subject}\n"
        f"Content-Type: text/plain; charset=utf-8\n\n{body}"
    )
    b64_message = base64.urlsafe_b64encode(raw_msg.encode('utf-8')).decode('utf-8')
    gmail_service.users().messages().send(userId='me', body={
        'raw': b64_message,
        'threadId': thread_id
    }).execute()


# =====================================================================
# BUG-7: CHINA TIME LOGIC REMINDERS (Every 15 mins)
# =====================================================================
def _is_china_business_hours(dt: datetime) -> bool:
    """Check if given datetime (in China timezone) is within Mon-Fri 09:00-17:00."""
    return dt.weekday() < 5 and 9 <= dt.hour < 17

def _get_reminder_target_time(sent_at_utc: datetime) -> datetime:
    """
    Given the time the RFQ was sent, calculate when the reminder should run.
    - If sent during business hours: 3 hours later (if still in business hours)
    - If sending after hours or 3 hours lands after 17:00: next business day at 10:00 AM
    """
    sent_at_cn = sent_at_utc.astimezone(CHINA_TZ)
    
    # Calculate initial 3 hour mark
    target_cn = sent_at_cn + timedelta(hours=3)
    
    # If the target is during business hours, return it
    if _is_china_business_hours(target_cn):
        return target_cn
    
    # Target is out of hours. Move to next business day at 10:00 AM CST
    next_day = sent_at_cn + timedelta(days=1)
    
    # If next_day is Saturday (5) or Sunday (6), advance to Monday
    while next_day.weekday() >= 5:
        next_day += timedelta(days=1)
        
    return next_day.replace(hour=10, minute=0, second=0, microsecond=0)

@app.function(
    schedule=modal.Cron("*/15 * * * *"),
    image=image,
    secrets=[modal.Secret.from_name("evo-logistics-env")]
)
def check_agent_reminders():
    """Send agent reminders based on China business hours."""
    supabase = get_supabase_client()
    workspace_mailbox_cache = {}
    
    now_utc = datetime.now(timezone.utc)
    
    # Get all connected workspace IDs
    workspace_rows = (
        supabase.table("workspace_mailboxes")
        .select("workspace_id")
        .eq("status", "connected")
        .execute()
        .data or []
    )
    workspace_ids = list({r["workspace_id"] for r in workspace_rows if r.get("workspace_id")})
    if not workspace_ids:
        print("No connected workspaces found for reminders.")
        return

    # Get Processing RFQs scoped per workspace
    all_rfqs = []
    all_agent_rows = []
    for wid in workspace_ids:
        all_rfqs += _get_table(supabase, "master_rfqs", wid)
        all_agent_rows += _get_table(supabase, "agent_outbound_log", wid)

    processing_rfq_keys = {
        (row.get('workspace_id'), row.get('rfq_id'))
        for row in all_rfqs
        if row.get('status') == 'Processing' and row.get('rfq_id') and row.get('workspace_id')
    }

    if not processing_rfq_keys:
        print("No active RFQs to process for reminders.")
        return
    reminders_sent = 0
    
    for row in all_agent_rows:
        rfq_id = row.get('rfq_id', '')
        workspace_id = row.get('workspace_id')
        status = row.get('status', '')
        sent_at_str = row.get('sent_at', '')
        agent_email = row.get('agent_email', '')
        agent_name = row.get('agent_name', 'Agent')
        
        rfq_key = (workspace_id, rfq_id)
        if rfq_key not in processing_rfq_keys or status != "Requested" or not sent_at_str or not agent_email:
            continue
            
        try:
            # Parse sent_at_str (UAE TIME: "%Y-%m-%d %I:%M %p")
            sent_at_uae_naive = datetime.strptime(sent_at_str, "%Y-%m-%d %I:%M %p")
            sent_at_uae = sent_at_uae_naive.replace(tzinfo=UAE_TZ)
            sent_at_utc = sent_at_uae.astimezone(timezone.utc)
            
            target_time_utc = _get_reminder_target_time(sent_at_utc).astimezone(timezone.utc)
            
            if now_utc >= target_time_utc:
                workspace_gmail_service, workspace_mailbox_email = _get_workspace_gmail_client(
                    supabase, workspace_id, workspace_mailbox_cache
                )
                if not workspace_gmail_service:
                    continue

                subject = f"REMINDER: Quote Request [Ref:{rfq_id}]"
                body = (
                    f"Dear {agent_name},\n\n"
                    f"This is a gentle reminder regarding our rate request for RFQ {rfq_id}.\n"
                    f"If you have already responded, please disregard this email. If not, we "
                    f"would appreciate receiving your quotation as soon as possible.\n\n"
                    f"Regards,\nPricing Team"
                )
                send_email(workspace_gmail_service, agent_email, subject, body)

                # Update ALL log rows for this agent+rfq to Reminded.
                # Rows use match keys like `rfq_id_email_shipnum_CARRIER_hash`
                # so we can't do an exact match — update by rfq_id + agent_email.
                if workspace_id:
                    try:
                        (
                            supabase.table("agent_outbound_log")
                            .update({"status": "Reminded"})
                            .eq("workspace_id", workspace_id)
                            .eq("rfq_id", rfq_id)
                            .eq("agent_email", agent_email)
                            .eq("status", "Requested")
                            .execute()
                        )
                    except Exception as upd_err:
                        print(f"Warning: Could not update Reminded status for {rfq_id}/{agent_email}: {upd_err}")
                print(
                    f"Sent reminder for RFQ {rfq_id} to {agent_email} "
                    f"from {workspace_mailbox_email}"
                )
                reminders_sent += 1
                
        except Exception as e:
            print(f"Error processing reminder for RFQ {rfq_id} to {agent_email}: {e}")

    print(f"Processed agent reminders. Sent {reminders_sent} reminders.")

# =====================================================================
# BUG-8: 24-HOUR CUSTOMER FOLLOW-UP (Hourly)
# =====================================================================
@app.function(
    schedule=modal.Cron("0 * * * *"),
    image=image,
    secrets=[modal.Secret.from_name("evo-logistics-env")]
)
def check_customer_followups():
    """Send follow-ups to customers 24 hours after quotation if no response."""
    supabase = get_supabase_client()
    workspace_mailbox_cache = {}
    
    now_uae = datetime.now(UAE_TZ)
    
    # Get all connected workspace IDs
    workspace_rows = (
        supabase.table("workspace_mailboxes")
        .select("workspace_id")
        .eq("status", "connected")
        .execute()
        .data or []
    )
    workspace_ids = list({r["workspace_id"] for r in workspace_rows if r.get("workspace_id")})

    # Get Quoted RFQs scoped per workspace
    all_rfqs = []
    for wid in workspace_ids:
        all_rfqs += _get_table(supabase, "master_rfqs", wid)
    followups_sent = 0
    
    for row in all_rfqs:
        if row.get('status') != 'Quoted':
            continue
        workspace_id = row.get("workspace_id")

        quoted_at_str = row.get('quoted_at', '')
        if not quoted_at_str:
            continue

        try:
            quoted_at_naive = datetime.strptime(str(quoted_at_str).strip(), "%Y-%m-%d %I:%M %p")
            quoted_at_uae = quoted_at_naive.replace(tzinfo=UAE_TZ)
            
            if now_uae >= quoted_at_uae + timedelta(hours=24):
                workspace_gmail_service, workspace_mailbox_email = _get_workspace_gmail_client(
                    supabase, workspace_id, workspace_mailbox_cache
                )
                if not workspace_gmail_service:
                    continue

                rfq_id = row.get('rfq_id', '')
                customer_email = row.get('customer_email', '')
                thread_id = row.get('thread_id', '')
                
                subject = f"Quotation Status - {rfq_id}"
                body = (
                    f"Dear Customer,\n\n"
                    f"We hope this email finds you well. This is a quick follow-up returning to our quotation for RFQ {rfq_id}.\n\n"
                    f"Please feel free to reach out if you have any questions or if you want to proceed with the booking.\n\n"
                    f"Best regards,\nPricing Team"
                )
                send_reply_email(
                    workspace_gmail_service,
                    customer_email,
                    thread_id,
                    subject,
                    body,
                )
                
                if workspace_id:
                    scoped_update_by_eq(
                        supabase,
                        "master_rfqs",
                        workspace_id,
                        {"status": "Followed_Up"},
                        "rfq_id",
                        rfq_id,
                    )
                print(
                    f"Sent 24-hour follow-up for RFQ {rfq_id} to {customer_email} "
                    f"from {workspace_mailbox_email}"
                )
                followups_sent += 1
        except Exception as e:
            rfq_id = row.get('rfq_id', 'Unknown')
            print(f"Error processing follow-up for RFQ {rfq_id}: {e}")

    print(f"Processed customer follow-ups. Sent {followups_sent} follow-ups.")

if __name__ == "__main__":
    app.serve()
