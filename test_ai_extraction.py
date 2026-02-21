import os
import json
import openai
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv('automations/.env')

AI_SYSTEM_PROMPT = """You are an expert logistics data extractor specializing in container shipping. Extract shipment details from emails and return ONLY a valid JSON object.

**OUTPUT FORMAT** (return exactly this structure):

{"multi":false,"count":1,"shipments":[{"pol":null,"pod":null,"pod_hint":[],"qty":null,"type":null,"date":null,"delivery_deadline":null,"service_type":"port-to-port","pickup_address":null,"delivery_address":null}]}

## FIELD RULES

### pol — Port of Loading
- Always UPPERCASE port or city name
- Only extract if a port is explicitly stated (e.g. "FOB Yantian", "loading from Shanghai port")
- If the email only provides a pickup address or city name, set pol to null
- Exception: if a well-known FOB term is used (e.g. "FOB Shenzhen"), use that port directly

### pod — Port of Discharge
- Always UPPERCASE port or city name
- Only set if the customer explicitly confirms a single port destination
- If the customer mentions destination ports as options, set pod to null and capture in pod_hint

### pod_hint — Port of Discharge Options
- Array of UPPERCASE port name strings
- Populate when customer mentions multiple possible ports but hasn't confirmed one

### qty — Container Quantity
- Container count as INTEGER
- Parse: 3X40FT → 3, three containers → 3
- null if no quantity mentioned

### type — Container Type
Must be one of: 20FT, 40FT, 40HC, 40HQ, 45FT, 20OT, 40OT

### date — Cargo Ready Date
- Format: YYYY-MM-DD, must be year 2024 or later
- Parse natural language dates

### delivery_deadline — Required Delivery Date
- Format: YYYY-MM-DD
- Trigger phrases: "delivered before", "must arrive by", "need it by", "deadline"

### service_type
- port-to-port (default), door-to-port, port-to-door, door-to-door
- Triggers for door-to-port: EXW, ex-works, collect from, pick up from
- Triggers for port-to-door: deliver to, door delivery, trucking to, to our warehouse
- Triggers for door-to-door: both above present

### pickup_address / delivery_address
- Full address as written, do NOT convert to a port name
- null if no physical address exists

## PORT CONVERSIONS (pod and pod_hint only)

| Mentioned | Resolves To |
|---|---|
| Dubai / Jebel Ali / Al Quoz | JEBEL ALI |
| Qatar / Doha | HAMAD PORT |
| UAQ / Umm Al Quwain | UMM AL QUWAIN |
| Abu Dhabi / Musaffah | KHALIFA PORT |
| Oman / Muscat / Sohar | SOHAR |
| Baghdad / Iraq / Basra | UMM QASR |
| Sharjah | SHARJAH |
| Ras Al Khaimah / RAK | RAS AL KHAIMAH |
| Fujairah | FUJAIRAH |
| Ajman | AJMAN |
| Jeddah | JEDDAH |
| Dammam | DAMMAM |
| Riyadh (no port specified) | null — set pod_hint: ["JEDDAH", "DAMMAM"] |

## MULTI-SHIPMENT RULES
- Mixed container types on same shipment → separate shipment objects
- Multiple containers of same type → single object with that qty

## OUTPUT RULES
- Return ONLY raw JSON — no markdown, no backticks
- Use null for unknown values — never "TBD", "N/A", or ""
- qty must be integer or null
- pod_hint must always be an array
- shipments array must always contain at least one object"""

email_subject = "shipping"
email_sender = "Hafis Javad <hafisjavad@gmail.com>"
email_body = """Dear Niyas,

We have several upcoming shipments from China and Malaysia and would appreciate your best ocean freight rates as per the details below.
China Shipments (All cargo ready for loading):
- Origin Ports:
  - Nansha Port, China
  - Shenzhen Port (Yantian / Shekou)
We have shipments from 5 different suppliers.
Kindly provide the rates separately for:
- Nansha Port
- Shenzhen Port (Yantian / Shekou)
Please advise rates for 40ft HQ including Local Charges, transit time and validity.

Malaysia Shipment:
- Origin Ports: Pasir Gudang or Tanjung Pelepas, Malaysia
- Cargo Ready Date: First week of January
Please share your best available rates 40ft HQ along with sailing schedule and transit time.
Let us know if you require any additional information from our side.
Looking forward to your quotation.

Thank you,
Best Regards"""

prompt = (
    f"EXTRACT SHIPMENT DATA FROM THIS EMAIL:\n\n"
    f"Subject: {email_subject}\n"
    f"From: {email_sender}\n\n"
    f"--- EMAIL BODY ---\n{email_body}\n--- END ---"
)

print('Firing OpenAI request...')
openai_client = openai.Client(api_key=os.environ.get("OPENAI_API_KEY"))
response = openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": AI_SYSTEM_PROMPT},
        {"role": "user", "content": prompt}
    ],
    response_format={"type": "json_object"}
)
raw_content = response.choices[0].message.content
print("AI Extracted JSON:")
print(raw_content)
