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


def get_email(service, msg_id):
    """Get full email by ID. Returns parsed headers + body."""
    msg = service.users().messages().get(
        userId="me", id=msg_id, format="full"
    ).execute()

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

    return {
        "id": msg_id,
        "from": headers.get("From", ""),
        "to": headers.get("To", ""),
        "subject": headers.get("Subject", ""),
        "date": headers.get("Date", ""),
        "body": body[:3000],  # Cap body length for AI parsing
        "snippet": msg.get("snippet", ""),
    }


def get_money_emails(service, days=7):
    """Search for money-related emails from the last N days."""
    queries = [
        "subject:(receipt OR invoice OR payment OR order OR subscription OR billing OR statement)",
        "from:(paypal OR stripe OR amazon OR apple OR google OR netflix OR spotify)",
        "subject:(direct debit OR standing order OR bank transfer)",
    ]

    seen_ids = set()
    emails = []

    for q in queries:
        q_with_date = f"{q} newer_than:{days}d"
        results = search_emails(service, q_with_date, max_results=30)
        for msg in results:
            if msg["id"] not in seen_ids:
                seen_ids.add(msg["id"])
                email = get_email(service, msg["id"])
                emails.append(email)

    return emails
