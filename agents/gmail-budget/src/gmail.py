"""Gmail API — connect, read, and search emails."""

import os
import base64
import json
from datetime import datetime
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
TOKEN_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "token.json")
CREDS_PATH = os.environ.get("GMAIL_CREDENTIALS_PATH", "credentials.json")


def get_service():
    """Authenticate and return Gmail API service."""
    creds = None

    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)

        os.makedirs(os.path.dirname(TOKEN_PATH), exist_ok=True)
        with open(TOKEN_PATH, "w") as f:
            f.write(creds.to_json())

    return build("gmail", "v1", credentials=creds)


def search_emails(service, query, max_results=50):
    """Search Gmail with a query string. Returns list of message metadata."""
    results = service.users().messages().list(
        userId="me", q=query, maxResults=max_results
    ).execute()

    messages = results.get("messages", [])
    return messages


def parse_date(date_str):
    """Normalize any email date format to ISO 8601 (YYYY-MM-DD HH:MM:SS)."""
    from email.utils import parsedate_to_datetime
    try:
        dt = parsedate_to_datetime(date_str)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        pass
    # Fallback: try common formats
    from datetime import datetime
    for fmt in ["%a, %d %b %Y %H:%M:%S %z", "%d %b %Y %H:%M:%S %z",
                "%a, %d %b %Y %H:%M:%S", "%Y-%m-%dT%H:%M:%S"]:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            continue
    return date_str


def get_email(service, msg_id):
    """Get full email by ID. Returns parsed headers + body."""
    import time
    for attempt in range(3):
        try:
            msg = service.users().messages().get(
                userId="me", id=msg_id, format="full"
            ).execute()
            break
        except ConnectionResetError:
            if attempt < 2:
                time.sleep(2)
                continue
            return None
        except Exception:
            return None

    headers = {h["name"]: h["value"] for h in msg["payload"]["headers"]}

    # Extract body text
    body = ""
    payload = msg["payload"]
    if "parts" in payload:
        for part in payload["parts"]:
            if part["mimeType"] == "text/plain" and "data" in part.get("body", {}):
                body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
                break
            elif part["mimeType"] == "text/html" and "data" in part.get("body", {}) and not body:
                body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="replace")
    elif "body" in payload and "data" in payload["body"]:
        body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")

    raw_date = headers.get("Date", "")
    normalized_date = parse_date(raw_date) if raw_date else ""

    return {
        "id": msg_id,
        "from": headers.get("From", ""),
        "to": headers.get("To", ""),
        "subject": headers.get("Subject", ""),
        "date": normalized_date,
        "raw_date": raw_date,
        "body": body[:3000],
        "snippet": msg.get("snippet", ""),
    }


def get_money_emails(service, days=None, max_per_query=100):
    """Search for money-related emails. If days=None, search all time."""
    queries = [
        # Subject-based
        "subject:(receipt OR invoice OR payment OR order confirmation OR order summary)",
        "subject:(subscription OR billing OR renewal OR charged OR your bill OR monthly bill)",
        "subject:(statement OR direct debit OR standing order OR transaction advice OR transaction alert)",
        "subject:(refund OR credit OR cashback)",
        "subject:(booking OR reservation OR flight OR hotel)",
        "subject:(deposit OR withdrawal OR withdraw OR confirmation)",
        "subject:(salary OR payslip OR wages OR paid OR you received)",
        "subject:(transfer OR sent you OR sell order OR buy order)",
        "subject:(plan will renew OR payment failed OR fee waiver)",
        # Sender-based — banks
        "from:(emiratesnbd.com OR omnibsic.com OR statement@emiratesnbd.com OR alert@emiratesnbd.com)",
        # Sender-based — crypto
        "from:(bybit OR okx OR binance OR mexc OR coinbase)",
        # Sender-based — payments & fintech
        "from:(paypal OR stripe OR wise OR revolut OR link.com)",
        # Sender-based — shopping & delivery
        "from:(amazon OR apple OR namecheap OR noon)",
        "from:(uber OR deliveroo OR careem OR talabat)",
        # Sender-based — subscriptions & services
        "from:(netflix OR spotify OR google OR microsoft OR runway)",
        "from:(digitalocean OR oracle OR expo.dev OR vercel OR supabase)",
        # Sender-based — bills & utilities
        "from:(dewa.gov.ae OR ducustomercare OR virginmobile)",
        # Sender-based — travel
        "from:(airbnb OR booking.com OR emirates OR flydubai OR skyscanner)",
    ]

    seen_ids = set()
    emails = []

    for q in queries:
        if days:
            q = f"{q} newer_than:{days}d"
        results = search_emails(service, q, max_results=max_per_query)
        for msg in results:
            if msg["id"] not in seen_ids:
                seen_ids.add(msg["id"])
                email = get_email(service, msg["id"])
                if email:
                    emails.append(email)

    return emails
