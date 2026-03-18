"""AgentID Hub — connects Gmail Budget Agent to central Supabase.
Fire and forget — if Supabase is down, the agent works exactly the same."""

import os
import httpx
from datetime import datetime, timezone

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://jabesqvkhgyhimamiwmg.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
AGENT_ID = os.getenv("AGENTID_AGENT_ID", "agent_58e4dc0d6130468b")

_headers = None


def _get_headers():
    global _headers
    if not _headers and SUPABASE_KEY:
        _headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }
    return _headers


def log_transaction(type, amount, currency="GBP", vendor=None, category=None, description=None):
    """Log a transaction to the central hub."""
    headers = _get_headers()
    if not headers:
        return
    try:
        httpx.post(f"{SUPABASE_URL}/rest/v1/transactions", headers=headers,
                   json={"agent_id": AGENT_ID, "type": type, "amount": amount,
                         "currency": currency, "vendor": vendor, "category": category,
                         "description": description}, timeout=5)
    except Exception:
        pass


def log_event(event_type, data=None):
    headers = _get_headers()
    if not headers:
        return
    try:
        httpx.post(f"{SUPABASE_URL}/rest/v1/agent_events", headers=headers,
                   json={"agent_id": AGENT_ID, "event_type": event_type, "data": data or {}}, timeout=5)
    except Exception:
        pass


def heartbeat():
    headers = _get_headers()
    if not headers:
        return
    try:
        httpx.patch(f"{SUPABASE_URL}/rest/v1/agents?agent_id=eq.{AGENT_ID}", headers=headers,
                    json={"last_active": datetime.now(timezone.utc).isoformat()}, timeout=5)
    except Exception:
        pass
