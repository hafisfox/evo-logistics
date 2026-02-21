"""
Backfill script - v3: strips null values from sheet_row to work around NOT NULL constraints.
For incomplete RFQs, only the fields that exist are stored.
"""
import os, sys, re, json
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv('automations/.env')

import automations.phase_1_request_analysis as p1
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import openai
from datetime import datetime
from supabase import create_client

def _get_gmail():
    creds = Credentials.from_authorized_user_file(
        "automations/token.json",
        scopes=["https://www.googleapis.com/auth/gmail.modify"]
    )
    return build('gmail', 'v1', credentials=creds)

def _safe_date(val):
    if not val or not isinstance(val, str):
        return None
    dates = re.findall(r'\d{4}-\d{2}-\d{2}', val)
    return dates[0] if dates else None

def _safe_text(val):
    if not val or not isinstance(val, str):
        return None
    first = val.split('\n')[0].strip()
    return None if first.upper() in ('TBD', '', 'N/A') else first

def build_sheet_row(thread_id, rfq_id, sender, now_str, action, sheets_data):
    """Build the row to insert, stripping out None values to avoid NOT NULL violations."""
    row = {
        'thread_id': thread_id,
        'rfq_id': rfq_id,
        'customer_email': sender,
        'received_at': now_str,
        'service_type': _safe_text(sheets_data['service_type']) or 'port-to-port',
    }
    # Only include fields that have actual values
    pol = _safe_text(sheets_data['pol'])
    pod = _safe_text(sheets_data['pod'])
    ctype = _safe_text(sheets_data['container_type'])
    qty = _safe_text(sheets_data['qty'])
    rdate = _safe_date(sheets_data['ready_date'])
    pickup = sheets_data.get('pickup_address')
    delivery = sheets_data.get('delivery_address')

    if pol: row['pol'] = pol
    if pod: row['pod'] = pod
    if ctype: row['container_type'] = ctype
    if qty: row['qty'] = qty
    if rdate: row['ready_date'] = rdate
    if pickup: row['pickup_address'] = pickup
    if delivery: row['delivery_address'] = delivery

    return row

def run_backfill():
    gmail_service = _get_gmail()
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    openai_client = openai.Client(api_key=os.environ["OPENAI_API_KEY"])

    known_threads = p1._load_known_threads(supabase)
    print(f"Known threads in DB: {list(known_threads.keys())}")

    results = gmail_service.users().messages().list(
        userId='me', maxResults=20,
        q='in:inbox -subject:"Ref: RFQ-" -from:yunapink05@gmail.com'
    ).execute()
    messages = results.get('messages', [])
    print(f"Found {len(messages)} candidate messages\n")

    processed = 0
    for msg in messages:
        msg_id = msg['id']
        email_data = gmail_service.users().messages().get(userId='me', id=msg_id, format='full').execute()
        thread_id = email_data.get('threadId')

        if thread_id in known_threads:
            print(f"Thread {thread_id[:16]}.. already in DB ({known_threads[thread_id]['status']}), skipping")
            continue

        headers_dict = {h['name'].lower(): h['value'] for h in email_data['payload']['headers']}
        subject = headers_dict.get('subject', '')
        sender = headers_dict.get('from', '')
        rfc_message_id = headers_dict.get('message-id', '')

        if 'yunapink05' in sender.lower():
            continue

        email_body = p1.extract_email_body(email_data['payload']) or email_data.get('snippet', '')
        print(f"--- '{subject[:60]}' from {sender[:40]} ---")

        category = p1.classify_email(openai_client, subject, sender, email_body)
        print(f"Category: {category}")

        if category not in ('customer_rfq', 'customer_followup'):
            print("Skipping\n")
            continue

        # Mark as read
        gmail_service.users().messages().modify(
            userId='me', id=msg_id, body={'removeLabelIds': ['UNREAD']}
        ).execute()

        rfq_id = p1.generate_rfq_id(thread_id)
        now_str = datetime.now(p1.UAE_TZ).strftime('%Y-%m-%d %I:%M %p')

        prompt = (
            f"EXTRACT SHIPMENT DATA FROM THIS EMAIL:\n\n"
            f"Subject: {subject}\nFrom: {sender}\n\n"
            f"--- EMAIL BODY ---\n{email_body}\n--- END ---"
        )

        try:
            resp = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": p1.AI_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            raw_content = resp.choices[0].message.content
            print(f"AI: {raw_content[:250]}")
            extracted = p1.ExtractedRFQs(**json.loads(raw_content))

            if not extracted.shipments:
                print("No shipment data → fallback\n")
                email_meta = {'id': msg_id, 'thread_id': thread_id, 'subject': subject, 'from': sender, 'rfc_message_id': rfc_message_id}
                p1._handle_fallback(gmail_service, supabase, rfq_id, sender, thread_id, rfc_message_id, subject, email_body, email_meta, now_str)
                continue

            shipments = [p1.validate_shipment(s.model_dump(), i) for i, s in enumerate(extracted.shipments)]
            is_multi = extracted.multi or len(shipments) > 1
            count = len(shipments)

            action = p1.determine_routing_action(shipments)
            has_door = any(s['service_type'] != 'port-to-port' for s in shipments)
            sheets_data = p1.concatenate_shipments(shipments)

            print(f"Action: {action}, multi: {is_multi}")

            sheet_row = build_sheet_row(thread_id, rfq_id, sender, now_str, action, sheets_data)
            current_details = p1.format_current_details(shipments, is_multi)
            missing_formatted = p1.format_missing_fields(shipments, has_door)
            pricing_content = p1.format_pricing_content(shipments, is_multi)
            subject_line = p1.build_subject_line(shipments, is_multi, count, action)

            if action == 'complete':
                sheet_row['status'] = 'Processing'
                p1._upsert_row(supabase, "master_rfqs", sheet_row)
                print(f"✅ RFQ {rfq_id} → Processing. Sending agent outreach...")
                p1._send_agent_outreach(gmail_service, supabase, rfq_id, shipments, is_multi, count, action, pricing_content, subject_line)
            elif action == 'need_door_data':
                sheet_row['status'] = 'Missing_Door_Data'
                p1._upsert_row(supabase, "master_rfqs", sheet_row)
                p1.send_door_data_reply(gmail_service, sender, thread_id, rfc_message_id, subject, current_details, missing_formatted)
                print(f"✅ RFQ {rfq_id} → Missing_Door_Data. Reply sent.")
            elif action == 'need_port_data':
                sheet_row['status'] = 'Missing_Port_Data'
                p1._upsert_row(supabase, "master_rfqs", sheet_row)
                p1.send_port_data_reply(gmail_service, sender, thread_id, rfc_message_id, subject, current_details, missing_formatted)
                print(f"✅ RFQ {rfq_id} → Missing_Port_Data. Reply sent.")

            processed += 1

        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback; traceback.print_exc()

        print()

    print(f"Backfill complete! ✅ Processed {processed} new RFQ(s).")

run_backfill()
