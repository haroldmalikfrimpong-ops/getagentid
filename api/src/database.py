"""Supabase database connection — central hub for all agents."""

from supabase import create_client
from .config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY

_client = None
_admin = None


def get_client():
    """Get Supabase client (anon key — for public API calls)."""
    global _client
    if not _client and SUPABASE_URL and SUPABASE_KEY:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def get_admin():
    """Get Supabase admin client (service key — for internal operations)."""
    global _admin
    if not _admin and SUPABASE_URL and SUPABASE_SERVICE_KEY:
        _admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _admin
