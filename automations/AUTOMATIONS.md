# Automations Architecture Guide (n8n to Modal.com)

Welcome to your code-based automations architecture! This document explains how the visual n8n workflows have been translated into scalable, serverless Python code running on [Modal.com](https://modal.com).

## Why Modal.com?

Modal allows you to write standard Python scripts and execute them securely in the cloud without managing servers. It natively supports scaling, caching, cron jobs, and webhooks (web endpoints), making it the perfect platform to replace an infrastructure-heavy tool like n8n.

## Core Concepts Mapping

| n8n Concept | Modal Concept | Implementation Details |
| --- | --- | --- |
| **Webhook / Form Trigger** | `@modal.fastapi_endpoint()` | A Python function decorated with `@modal.fastapi_endpoint(method="POST")` acts just like an n8n webhook. It receives HTTP requests, parses the JSON body, and executes the logic. Note: `fastapi` must be explicitly installed via `pip_install` in the `modal.Image` definition. |
| **Schedule / Interval Trigger** | `@app.function(schedule=...)`| Using `modal.Cron("* * * * *")` or `modal.Period(minutes=1)`, you can set functions to run on an interval, replacing n8n Schedule or Polling triggers. |
| **Gmail Push Trigger** | Pub/Sub + `@modal.fastapi_endpoint()` | Gmail sends push notifications via Google Cloud Pub/Sub to a Modal webhook. Near-instant, no polling. |
| **Credentials** | `modal.Secret` | Instead of n8n's credential manager, you inject secrets using `modal.Secret.from_name("evo-logistics-env")` to load keys from a named Modal secret. Create this secret in the Modal dashboard with all required env vars. |
| **IF / Switch Nodes** | Standard Python `if/elif` | Visual routing becomes standard code routing, which is less visually cluttered and much easier to debug. |
| **AI Nodes / Langchain** | `openai` SDK + Pydantic | We use the official OpenAI Python SDK with structured JSON outputs (Pydantic models) to reliably extract or generate content. |

## Managing Secrets & Credentials

All automation scripts load secrets from a **named Modal secret** called `evo-logistics-env`. This must be created in the [Modal dashboard](https://modal.com/secrets).

### 1. Create the Modal Secret

Go to **modal.com/secrets** → **Create new secret** → **Custom** → name it `evo-logistics-env` and add:

| Key | Description |
|-----|-------------|
| `OPENAI_API_KEY` | OpenAI API key for AI extraction |
| `SUPABASE_URL` | Supabase project URL (e.g. `https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (write access) |
| `GOOGLE_PUBSUB_TOPIC` | Pub/Sub topic (e.g. `projects/YOUR_PROJECT_ID/topics/gmail-push-notifications`) |
| `MODAL_LLM_API_KEY` | Modal LLM API key (optional, Phase 1 classification fallback) |
| `OWN_EMAIL` | System's Gmail address (e.g. `yunapink05@gmail.com`) — used for self-reply guards and Gmail query filters |

### 2. Local Development (Optional)

For local testing with `modal run`, you can also create a `.env` file in the `automations/` folder with the same keys. The scripts will use the Modal secret in production.

### 3. Generate Google OAuth Token
Because Service Accounts cannot read free Gmail inboxes natively, you must authorize this app to read your personal email.
1. In Google Cloud Console, create an **OAuth 2.0 Client ID** (Web application type).
2. Under **Authorized redirect URIs**, add `https://your-vercel-domain.vercel.app/api/auth/callback/google`
3. Download the resulting `credentials.json` directly into the `automations/` folder.
4. Run the interactive login script:
   ```bash
   python3 automations/authenticate_google.py
   ```
5. This will open your web browser. Log in and authorize the app. A `token.json` file will be generated securely on your local machine.

The Modal scripts use `.add_local_file()` in the image definition to bundle `token.json` into the container at `/root/token.json`.

> **Important:** The `token.json` must be generated for the **monitored Gmail account**. If you re-authenticate, you must redeploy all phases to pick up the new token.

## Gmail Push Notifications (Pub/Sub)

Phase 1 and Phase 2 are triggered by Gmail push notifications instead of polling. When a new email arrives, Gmail notifies a Google Cloud Pub/Sub topic, which pushes to the Modal webhook endpoints.

### Setup Steps

1. **Enable Cloud Pub/Sub API** in [Google Cloud Console](https://console.cloud.google.com/apis/library/pubsub.googleapis.com)

2. **Create a Pub/Sub topic**:
   ```bash
   gcloud pubsub topics create gmail-push-notifications
   ```

3. **Grant Gmail publish access** to the topic:
   ```bash
   gcloud pubsub topics add-iam-policy-binding gmail-push-notifications \
     --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
     --role="roles/pubsub.publisher"
   ```

4. **Deploy both apps first** (to get webhook URLs):
   ```bash
   modal deploy automations/phase_1_request_analysis.py
   modal deploy automations/phase_2_quote_analysis.py
   ```
   Note the webhook URLs from the output (e.g., `https://username--app-name-gmail-push-phase1.modal.run`).

5. **Create push subscriptions** pointing to the Modal webhook URLs:
   ```bash
   gcloud pubsub subscriptions create gmail-push-phase1 \
     --topic=gmail-push-notifications \
     --push-endpoint=PHASE_1_WEBHOOK_URL

   gcloud pubsub subscriptions create gmail-push-phase2 \
     --topic=gmail-push-notifications \
     --push-endpoint=PHASE_2_WEBHOOK_URL
   ```

6. **Ensure `GOOGLE_PUBSUB_TOPIC` is set** in the `evo-logistics-env` Modal secret:
   ```
   GOOGLE_PUBSUB_TOPIC=projects/YOUR_PROJECT_ID/topics/gmail-push-notifications
   ```

7. **Activate the Gmail watch** (first time):
   ```bash
   modal run automations/phase_1_request_analysis.py::renew_gmail_watch
   ```
   This watch auto-renews every 6 days via a built-in cron. Gmail watches expire after 7 days.

## Key Implementation Details

### Email Classification (Phase 1)
Before processing, every incoming email is classified by AI (GPT-4o-mini) into:
- `customer_rfq` — New freight quote request → processed
- `customer_followup` — Reply to existing thread → processed
- `agent_rate_reply` — Agent quote reply → **re-marked as UNREAD** and skipped (so Phase 2 can pick it up)
- `booking_confirmation` — B/L or booking notice → skipped
- `out_of_scope` — Spam, newsletters → skipped

If classification fails (OpenAI error or unrecognized category), the default is `out_of_scope` to prevent spam from triggering agent outreach.

### RFQ ID Generation
Unique IDs are generated in format `RFQ-YYYYMMDD-XXX` using a hash of timestamp + threadId. All timestamps and date stamps use UAE timezone (UTC+4).

### Data Normalization (Phase 1)
AI-extracted data is normalized before routing:
- **Ports**: Uppercase, aliases resolved (Dubai→JEBEL ALI, Qatar→HAMAD PORT)
- **Containers**: Each shipment has a `containers` list of `{qty, type}` items. Types are alias-normalized (40HQ→40HC, 20GP→20FT). Qty coerced to int.
- **Dates**: Parsed to YYYY-MM-DD, validated year ≥ 2024
- **Service types**: Validated against `port-to-port`, `door-to-port`, `port-to-door`, `door-to-door`
- **Addresses**: Trimmed, null/N/A filtered

### Data Fields Extracted by AI (Phase 1)
The `master_rfqs` table stores the following AI-extracted fields. All are nullable except `thread_id`, `customer_email`, `rfq_id`, and `status`:

| Field | Type | Notes |
|-------|------|-------|
| `pol` | TEXT | Port of Loading. Newline-separated for multi-container entries (repeated per container within a shipment) |
| `pod` | TEXT | Port of Discharge. Same newline-separated format as `pol` |
| `container_type` | TEXT | e.g. `40FT\n20FT`. One line per container entry, newline-separated |
| `qty` | TEXT | e.g. `2\n1`. One line per container entry, index-aligned with `container_type` |
| `ready_date` | DATE | Cargo ready date. Repeated per container entry for index alignment |
| `delivery_deadline` | DATE | Customer's required delivery date (nullable) |
| `service_type` | service_type enum | port-to-port, door-to-port, port-to-door, door-to-door |
| `pickup_address` | TEXT | For door-from services |
| `delivery_address` | TEXT | For door-to services |

**Multi-container storage format:** All newline-separated fields are index-aligned. For a single-route RFQ with mixed containers (e.g., "2x40FT + 1x20FT from Shenzen to Jebel Ali"), the data is:
- `pol`: `SHENZHEN\nSHENZHEN`, `pod`: `JEBEL ALI\nJEBEL ALI`, `container_type`: `40FT\n20FT`, `qty`: `2\n1`

Route fields are repeated per container entry so Phase 2/3 can iterate by index without misalignment.

Null-safe helpers `_safe_date()` and `_safe_text()` convert "TBD"/empty/N/A values to `None` before upserting, preventing NOT NULL constraint violations for partial RFQs.

### Routing Logic (Phase 1)
After normalization, shipments are routed based on data completeness:
- `complete` → Log to `master_rfqs` → Send rate requests to all active agents
- `need_port_data` → Reply requesting missing port/container info
- `need_door_data` → Reply requesting delivery/pickup addresses
- `fallback` → Reply with format example + notify admin via HTML email

### Gmail Query Filter (Phase 1)
Phase 1 fetches only emails matching: `is:unread -subject:"Ref: RFQ-" -from:<system_email>`
- Excludes agent rate replies (handled by Phase 2 which looks for `subject:"Ref: RFQ-"`)
- Excludes auto-replies sent by the system itself (`-from:<system_email>`)

### Agent Outreach (Phase 1)
When data is complete, the system:
1. Reads active agents from the `agents` Supabase table
2. Sends personalized rate request emails with subject `RFQ: [details] [Ref:RFQ-ID]`
3. Logs each outreach to `agent_outbound_log` with status `Requested`

### Carrier Normalization (Phase 2)
Agent carrier names are normalized: COSCO SHIPPING→COSCO, Evergreen Marine→EVERGREEN, Mediterranean Shipping→MSC, Ocean Network Express→ONE, etc.

### Quote Threshold & Manager Notification (Phase 2)
After each quote is logged, the system checks if ≥2 valid quotes exist for the RFQ. When met, a rich HTML email is sent to the manager with:
- Gradient header, RFQ reference card
- Overall best rate card with agent/carrier/price
- Per-shipment comparison tables with BEST badges
- Link to Dashboard

### Duplicate Processing Prevention
Google Pub/Sub sends multiple push notifications per email event (retries, label changes). Multiple layers prevent duplicate processing:
1. **Immediate mark-as-read (Phase 1)**: Emails are marked as read **immediately** after fetching headers (before classification). This closes the race window where concurrent Pub/Sub invocations could both find the same unread email. Phase 2 uses the same pattern.
2. **In-flight deduplication (Phase 1)**: A `processed_msg_ids` set tracks message IDs within a single invocation so they are never processed twice in the same run. Added to set immediately after mark-as-read.
3. **Thread-level deduplication (Phase 1)**: At the start of each run, Phase 1 loads all known `thread_id → {rfq_id, status}` from `master_rfqs`. If a thread is already in a terminal state (`Processing`, `Parse_Error`, `Quoted`, `Customer_Replied`), the email is skipped without calling OpenAI. Threads with `Missing_Port_Data` or `Missing_Door_Data` status are still processed as followups, and reuse the existing RFQ ID.
4. **Always-200 webhook response**: Both Phase 1 and Phase 2 webhooks wrap `_process_*` in a try/except and always return `{status: ok}` to Pub/Sub. Returning a non-200 causes Pub/Sub to retry, which can cascade into a rate limit storm.

### Gmail Thread Threading
Reply emails use the RFC 2822 `Message-ID` header (e.g., `<CABxyz@mail.gmail.com>`) for `In-Reply-To` and `References` headers, ensuring replies appear in the same Gmail thread as the original email.

### Supabase Upsert Logic
All phases read and write exclusively to Supabase PostgreSQL. Google Sheets is not used anywhere in the pipeline.
- Phase 1: Upserts by `thread_id` (Primary Key) in `master_rfqs`
- Phase 2: Upserts by `match` key (`{rfq_id}_{agent_email}_{carrier}_{shipment_number}`) in `agent_outbound_log` — each agent/carrier/shipment combo gets its own row
- Phase 3, Scheduled Tasks: Use direct `.select().eq()` Supabase queries (dict-based, no Sheets shims)

**Pricing lookup tables** (`do_charges`, `destination_charges`, `transportation_charges`) are read from Supabase and returned as plain Python dicts.

### Gmail API Rate Limit Handling
All Gmail API calls in Phase 1 and Phase 2 go through `_gmail_call_with_backoff()`, which retries up to 4 times with exponential backoff (2s, 4s, 8s, 16s) on HTTP 429 or 403 quota errors. This prevents transient rate limit spikes (caused by Pub/Sub bursts) from crashing processing runs.

### Self-Reply Prevention
Both Phase 1 and Phase 2 include a self-reply guard that checks the `From` header of each email against the `OWN_EMAIL` environment variable. If the email was sent by the system itself (e.g., automated RFQ requests, quotation replies), it is silently skipped. This prevents infinite processing loops where Pub/Sub notifications for outgoing emails trigger re-processing.

### Python Runtime
All Modal apps use `modal.Image.debian_slim(python_version="3.11")` to run on Python 3.11. This avoids `FutureWarning` deprecation notices from Google's `google-auth`, `google-api-core`, and `google-auth-oauthlib` libraries which dropped support for Python 3.9.

### Email Body Extraction
Both Phase 1 and Phase 2 use a recursive MIME tree walker (`extract_email_body()`) that:
- Walks the entire `multipart/mixed → multipart/alternative → text/*` tree
- Collects all `text/plain` and `text/html` leaf nodes
- Prefers plain text; falls back to HTML with table-aware tag stripping (`</td>` → ` | `, `</tr>` → `\n`)
- Falls back to Gmail `snippet` if extraction returns empty

### Pydantic Models (Phase 1)
- `ContainerItem`: `{qty: Optional[int], type: Optional[str]}` — represents one container type within a shipment
- `ShipmentData`: `{pol, pod, pod_hint, containers: List[ContainerItem], date, ...}` — one per route
- `ExtractedRFQs`: `{extraction_reasoning, multi, count, shipments: List[ShipmentData]}`

A **shipment** is defined by its route (origin→destination). Mixed container types on the same route are stored as multiple `ContainerItem` entries within a single `ShipmentData`.

### Pydantic Type Coercion
OpenAI responses sometimes return wrong types. Field validators handle:
- `pod_hint`: string → single-element list (e.g. `"UAQ"` → `["UAQ"]`)
- `ContainerItem.qty`: string → int (e.g. `"1"` → `1`)
- `price`: string → float (e.g. `"1,200"` → `1200.0`)

### Classification Fallback (Phase 1)
Email classification uses Modal LLM (`zai-org/GLM-5-FP8`) as primary. If it returns `None` content, falls back to OpenAI `gpt-4o-mini`. If both return `None`, defaults to `out_of_scope`.

### Debug Logging
All phases log:
- Email body length and 300-char preview
- Raw OpenAI response (first 500 chars)
- Processing status and errors

## Deploying and Running

### 1. Local Testing

You don't have to deploy immediately to test. You can execute a function remotely right from your local machine:

```bash
# Install modal
pip install modal

# Authenticate with your Modal account
modal setup

# Run a specific script temporarily in the cloud
modal run automations/phase_1_request_analysis.py
```

### 2. Deploying to Production

```bash
modal deploy automations/phase_1_request_analysis.py
modal deploy automations/phase_2_quote_analysis.py
modal deploy automations/phase_3_select_and_quote.py
modal deploy automations/scheduled_tasks.py
```

Once deployed, Modal will automatically spin up identical Python environments in the cloud. It will output a confirmation message along with the live URL for your webhooks:

```
✓ App deployed in 13.016s!
View Deployment: https://modal.com/apps/hafisjavad/main/deployed/rfq-analyzer-phase-1
Function gmail_push_phase1 => https://hafisjavad--rfq-analyzer-phase-1-gmail-push-phase1.modal.run
```

## Folder Structure

```
automations/
├── AUTOMATIONS.md                   # This guide
├── requirements.txt                 # Dependencies required by these scripts
├── phase_1_request_analysis.py      # Webhook: processes incoming Gmail RFQs (via Pub/Sub push)
├── phase_2_quote_analysis.py        # Webhook: processes agent quote replies (via Pub/Sub push)
├── phase_3_select_and_quote.py      # Webhook: agent selection, pricing & quotation (via Dashboard POST)
├── scheduled_tasks.py               # Cron Jobs: Handles 3h China Time reminders and 24h follow-ups
└── authenticate_google.py           # Generates OAuth 2.0 token.json
```

## Phase 3: Select Agent & Quote (Dashboard-Triggered)

Unlike Phase 1 and 2 which are triggered by Gmail Pub/Sub push notifications, Phase 3 is triggered directly by the Dashboard UI when the pricing manager selects an agent.

**Trigger:** HTTP POST from Dashboard → Modal FastAPI endpoint

**Flow:**
1. Receives selection payload (rfq_id, agent, carrier, shipment)
2. Updates `master_rfqs` status to "Selected"
3. Looks up the selected quote from `agent_outbound_log`
4. Reads pricing tables (`do_charges`, `destination_charges`, `transportation_charges`)
5. Calculates full pricing with dynamic margin (from dashboard settings), rounded to nearest 10 AED
6. Updates `master_rfqs` with final prices and status "Quoted"
7. Sends quotation email on original Gmail thread
8. Notifies sales team

**Deploy:**
```bash
modal deploy automations/phase_3_select_and_quote.py
```

The deployed URL is configured in the dashboard's `.env.local` as `MODAL_WEBHOOK_SELECT_AGENT`.
