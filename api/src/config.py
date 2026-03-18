"""AgentID API configuration."""

import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
JWT_SECRET = os.getenv("JWT_SECRET", "agentid-dev-secret")
AGENTID_DOMAIN = os.getenv("AGENTID_DOMAIN", "getagentid.dev")
