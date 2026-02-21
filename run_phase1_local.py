import os
import sys

# Add automations to path to import phase_1
sys.path.append(os.path.join(os.path.dirname(__file__), 'automations'))

from dotenv import load_dotenv
load_dotenv('automations/.env')
# Also fake the token.json path for local testing
import automations.phase_1_request_analysis as p1

# Monkeypatch get_google_services to use the local token.json
def local_get_google_services():
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    credentials = Credentials.from_authorized_user_file(
        "automations/token.json",
        scopes=["https://www.googleapis.com/auth/gmail.modify"]
    )
    return build('gmail', 'v1', credentials=credentials)

p1.get_google_services = local_get_google_services

print("Running _process_incoming_rfqs locally...")
p1._process_incoming_rfqs()
print("Done!")
