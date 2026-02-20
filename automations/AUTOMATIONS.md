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
| **Credentials** | `modal.Secret` | Instead of n8n's credential manager, you inject secrets using `modal.Secret.from_dotenv(__file__)` to securely pass your local `.env` keys into the remote execution container. |
| **IF / Switch Nodes** | Standard Python `if/elif` | Visual routing becomes standard code routing, which is less visually cluttered and much easier to debug. |
| **AI Nodes / Langchain** | `openai` SDK + Pydantic | We use the official OpenAI Python SDK with structured JSON outputs (Pydantic models) to reliably extract or generate content. |

## Managing Secrets & Credentials

To run these automations safely, we utilize a local `.env` file for API keys, and an OAuth 2.0 `token.json` for Google Authentication (required for standard `@gmail.com` accounts).

### 1. Configure the `.env` file
1. Create a `.env` file in the `automations/` folder:
   ```bash
   cp automations/.env.example automations/.env
   ```
2. Open `automations/.env` and paste your actual `OPENAI_API_KEY`.
3. Add the Pub/Sub topic (see Gmail Push Notifications section below):
   ```
   GOOGLE_PUBSUB_TOPIC=projects/YOUR_PROJECT_ID/topics/gmail-push-notifications
   ```

### 2. Generate Google OAuth Token
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

> **Important:** The `token.json` must be generated for the **monitored Gmail account** (currently `yunapink05@gmail.com`). If you re-authenticate, you must redeploy all 3 phases to pick up the new token.

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

6. **Add `GOOGLE_PUBSUB_TOPIC` to `.env`**:
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

### RFQ ID Generation
Unique IDs are generated in format `RFQ-YYYYMMDD-XXX` using a hash of timestamp + threadId.

### Data Normalization (Phase 1)
AI-extracted data is normalized before routing:
- **Ports**: Uppercase, aliases resolved (Dubai→JEBEL ALI, Qatar→HAMAD PORT)
- **Container types**: Aliases normalized (40HQ→40HC, 20GP→20FT)
- **Dates**: Parsed to YYYY-MM-DD, validated year ≥ 2024
- **Service types**: Validated against `port-to-port`, `door-to-port`, `port-to-door`, `door-to-door`
- **Addresses**: Trimmed, null/N/A filtered

### Routing Logic (Phase 1)
After normalization, shipments are routed based on data completeness:
- `complete` → Log to Master_RFQs → Send rate requests to all active agents
- `need_port_data` → Reply requesting missing port/container info
- `need_door_data` → Reply requesting delivery/pickup addresses
- `fallback` → Reply with format example + notify admin via HTML email

### Agent Outreach (Phase 1)
When data is complete, the system:
1. Reads active agents from the `Agents` Google Sheet
2. Sends personalized rate request emails with subject `RFQ: [details] [Ref:RFQ-ID]`
3. Logs each outreach to `Agent_Outbound_Log` with status `Requested`

### Carrier Normalization (Phase 2)
Agent carrier names are normalized: COSCO SHIPPING→COSCO, Evergreen Marine→EVERGREEN, Mediterranean Shipping→MSC, Ocean Network Express→ONE, etc.

### Quote Threshold & Manager Notification (Phase 2)
After each quote is logged, the system checks if ≥2 valid quotes exist for the RFQ. When met, a rich HTML email is sent to the manager with:
- Gradient header, RFQ reference card
- Overall best rate card with agent/carrier/price
- Per-shipment comparison tables with BEST badges
- Link to Google Sheets

### Duplicate Processing Prevention
Google Pub/Sub sends multiple push notifications per email event (retries, history updates). Two layers prevent duplicate processing:
1. **Mark-as-read**: Emails are marked as read **immediately** after fetching, before any AI processing. Subsequent Pub/Sub retries find no unread emails and return instantly.
2. **Thread-level deduplication**: At the start of each run, Phase 1 loads all known `thread_id → {rfq_id, status}` from `Master_RFQs`. If a thread is already in a terminal state (`Processing`, `Parse_Error`, `Quoted`), the email is skipped without calling OpenAI. Threads with `Missing_Port_Data` or `Missing_Door_Data` status are still processed as followups, and reuse the existing RFQ ID.

### Gmail Thread Threading
Reply emails use the RFC 2822 `Message-ID` header (e.g., `<CABxyz@mail.gmail.com>`) for `In-Reply-To` and `References` headers, ensuring replies appear in the same Gmail thread as the original email.

### Google Sheets Upsert Logic
Both Phase 1 and Phase 2 use `appendOrUpdate` (upsert) instead of simple append:
- Phase 1: Upserts by `thread_id` in `Master_RFQs`
- Phase 2: Upserts by `match` key (`{rfq_id}_{agent_email}`) in `Agent_Outbound_Log` — each agent gets one row per RFQ that is updated when new quotes arrive

### Email Body Extraction
Both Phase 1 and Phase 2 use a recursive MIME tree walker (`extract_email_body()`) that:
- Walks the entire `multipart/mixed → multipart/alternative → text/*` tree
- Collects all `text/plain` and `text/html` leaf nodes
- Prefers plain text; falls back to HTML with table-aware tag stripping (`</td>` → ` | `, `</tr>` → `\n`)
- Falls back to Gmail `snippet` if extraction returns empty

### Pydantic Type Coercion
OpenAI responses sometimes return wrong types. Field validators handle:
- `pod_hint`: string → single-element list (e.g. `"UAQ"` → `["UAQ"]`)
- `qty`: string → int (e.g. `"1"` → `1`)
- `price`: string → float (e.g. `"1,200"` → `1200.0`)

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
└── authenticate_google.py           # Generates OAuth 2.0 token.json
```

## Phase 3: Select Agent & Quote (Dashboard-Triggered)

Unlike Phase 1 and 2 which are triggered by Gmail Pub/Sub push notifications, Phase 3 is triggered directly by the Dashboard UI when the pricing manager selects an agent.

**Trigger:** HTTP POST from Dashboard → Modal FastAPI endpoint

**Flow:**
1. Receives selection payload (rfq_id, agent, carrier, shipment)
2. Updates Master_RFQs status to "Selected"
3. Looks up the selected quote from Agent_Outbound_Log
4. Reads pricing tables (DO Charges, Destination Charges, Transportation Charges)
5. Calculates full pricing with 13% margin, rounded to nearest 10 AED
6. Updates Master_RFQs with final prices and status "Quoted"
7. Sends quotation email on original Gmail thread
8. Notifies sales team

**Deploy:**
```bash
modal deploy automations/phase_3_select_and_quote.py
```

The deployed URL is configured in the dashboard's `.env.local` as `MODAL_WEBHOOK_SELECT_AGENT`.
