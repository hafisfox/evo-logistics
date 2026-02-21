import os.path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

# The APIs and specific permissions our app needs
SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",       # Needed to read and send emails
    "https://www.googleapis.com/auth/spreadsheets",       # Needed to log RFQs to Google Sheets
    "https://www.googleapis.com/auth/drive.file",         # Needed for Service Started workflow
    "https://www.googleapis.com/auth/documents"           # Needed for Service Started workflow
]

def main():
    """Run an interactive browser login to generate token.json"""
    creds = None
    
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
        
    # If there are no valid credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("Refreshing existing token...")
            creds.refresh(Request())
        else:
            if not os.path.exists("credentials.json"):
                print("=========================================================")
                print("ERROR: credentials.json not found!")
                print("Please download credentials.json from Google Cloud Console")
                print("and place it in this folder before running this script.")
                print("=========================================================")
                return
                
            print("Opening web browser window for Google Login...")
            flow = InstalledAppFlow.from_client_secrets_file(
                "credentials.json", SCOPES
            )
            # This opens a web server on a fixed port so the redirect URI is deterministic
            creds = flow.run_local_server(port=8080)
            
        # Save the credentials for the next run
        with open("token.json", "w") as token:
            token.write(creds.to_json())
            print("\\nSUCCESS! Saved encrypted credentials to token.json.")
            print("You can now securely upload token.json to Modal or use it locally.")

if __name__ == "__main__":
    main()
