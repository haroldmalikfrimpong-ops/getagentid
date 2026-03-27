"""
AgentID Trust Level System

Security layer with user control. No gated governance — you register, you're in.
Levels are based on what security capabilities you've set up, not time or score.
"""

from enum import IntEnum
from datetime import datetime, timezone
from typing import Any, Optional


class TrustLevel(IntEnum):
    """Trust levels for AgentID agents."""
    L1_REGISTERED = 1    # registered, certificate issued
    L2_VERIFIED = 2      # Ed25519 key bound
    L3_SECURED = 3       # wallet bound, payments enabled
    L4_CERTIFIED = 4     # entity verified


# Backward compatibility: old L0 agents map to L1 (they're registered — that's enough)
LEGACY_L0_MAPS_TO = TrustLevel.L1_REGISTERED


# All possible actions in the system
ACTIONS = [
    "read",
    "discover",
    "verify",
    "send_message",
    "connect",
    "challenge_response",
    "handle_data",
    "access_paid_service",
    "make_payment",
    "sign_contract",
    "manage_funds",
    "full_autonomy",
]

# Permission sets per trust level (cumulative)
PERMISSIONS: dict[TrustLevel, list[str]] = {
    TrustLevel.L1_REGISTERED: ["read", "discover", "verify", "send_message", "connect"],
    TrustLevel.L2_VERIFIED: [
        "read", "discover", "verify", "send_message", "connect",
        "challenge_response", "handle_data",
    ],
    TrustLevel.L3_SECURED: [
        "read", "discover", "verify", "send_message", "connect",
        "challenge_response", "handle_data", "make_payment", "access_paid_service",
    ],
    TrustLevel.L4_CERTIFIED: [
        "read", "discover", "verify", "send_message", "connect",
        "challenge_response", "handle_data", "make_payment", "access_paid_service",
        "sign_contract", "manage_funds", "full_autonomy",
    ],
}

# Daily spending limits in USD per trust level
# These are DEFAULTS — the user can LOWER these, not us.
SPENDING_LIMITS: dict[TrustLevel, int] = {
    TrustLevel.L1_REGISTERED: 0,       # no wallet bound yet
    TrustLevel.L2_VERIFIED: 0,         # no wallet bound yet
    TrustLevel.L3_SECURED: 10000,      # default — user can lower this
    TrustLevel.L4_CERTIFIED: 100000,   # default — user can lower this
}

# Human-readable labels
TRUST_LEVEL_LABELS: dict[TrustLevel, str] = {
    TrustLevel.L1_REGISTERED: "L1 — Registered",
    TrustLevel.L2_VERIFIED: "L2 — Verified",
    TrustLevel.L3_SECURED: "L3 — Secured",
    TrustLevel.L4_CERTIFIED: "L4 — Certified",
}


def normalize_trust_level(level: int) -> TrustLevel:
    """
    Normalize a trust level value, mapping legacy L0 to L1.
    Use this when reading trust_level from the database to handle old agents.
    """
    if level == 0:
        return TrustLevel.L1_REGISTERED
    if 1 <= level <= 4:
        return TrustLevel(level)
    return TrustLevel.L1_REGISTERED


def calculate_trust_level(agent_data: dict[str, Any]) -> TrustLevel:
    """
    Calculate the trust level for an agent based on what security capabilities are set up.
    No time requirements. No verification count requirements. You complete the step, you get the level.

    Expected keys in agent_data:
        trust_score (float): 0.0 to 1.0 (informational only — does NOT gate levels)
        verified (bool): has been verified at least once
        certificate_valid (bool): current certificate is not expired
        entity_verified (bool, optional): legal entity binding confirmed
        owner_email_verified (bool, optional): owner has verified their email
        created_at (str): ISO timestamp
        successful_verifications (int, optional): count of successful verifications
        ed25519_key (str or None, optional): Ed25519 public key (if bound)
        wallet_address (str or None, optional): crypto wallet address (if bound)
    """
    entity_verified = agent_data.get("entity_verified", False)
    wallet_address = agent_data.get("wallet_address", None)
    ed25519_key = agent_data.get("ed25519_key", None)

    # L4: entity verified
    if entity_verified:
        return TrustLevel.L4_CERTIFIED

    # L3: wallet bound (wallet_address is not null/empty)
    if wallet_address is not None and wallet_address != "":
        return TrustLevel.L3_SECURED

    # L2: Ed25519 key bound (ed25519_key is not null/empty)
    if ed25519_key is not None and ed25519_key != "":
        return TrustLevel.L2_VERIFIED

    # L1: default for all registered agents
    return TrustLevel.L1_REGISTERED


def check_permission(level: TrustLevel | int, action: str) -> bool:
    """Check whether a given trust level grants permission for a specific action."""
    normalized = normalize_trust_level(int(level))
    allowed = PERMISSIONS.get(normalized, [])
    return action in allowed


def get_spending_limit(level: TrustLevel | int) -> int:
    """Get the maximum daily spending limit in USD for a trust level."""
    normalized = normalize_trust_level(int(level))
    return SPENDING_LIMITS.get(normalized, 0)


def level_up_requirements(
    current_level: TrustLevel | int,
    agent_data: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    Return what an agent needs to reach the next trust level.
    Clear, actionable steps — not time-based gates.
    """
    normalized = normalize_trust_level(int(current_level))

    if normalized >= TrustLevel.L4_CERTIFIED:
        return {
            "current_level": int(normalized),
            "next_level": None,
            "requirements": ["Already at maximum trust level"],
            "met": {"max_level": True},
        }

    if normalized == TrustLevel.L1_REGISTERED:
        ed25519_key = agent_data.get("ed25519_key", None) if agent_data else None
        return {
            "current_level": int(normalized),
            "next_level": int(TrustLevel.L2_VERIFIED),
            "requirements": [
                "Bind an Ed25519 key (POST /agents/bind-ed25519)",
            ],
            "met": {
                "ed25519_key_bound": ed25519_key is not None and ed25519_key != "",
            },
        }

    if normalized == TrustLevel.L2_VERIFIED:
        wallet_address = agent_data.get("wallet_address", None) if agent_data else None
        return {
            "current_level": int(normalized),
            "next_level": int(TrustLevel.L3_SECURED),
            "requirements": [
                "Bind a crypto wallet (POST /agents/bind-wallet)",
            ],
            "met": {
                "wallet_bound": wallet_address is not None and wallet_address != "",
            },
        }

    if normalized == TrustLevel.L3_SECURED:
        return {
            "current_level": int(normalized),
            "next_level": int(TrustLevel.L4_CERTIFIED),
            "requirements": [
                "Complete entity verification",
            ],
            "met": {
                "entity_verified": bool(agent_data.get("entity_verified", False)) if agent_data else False,
            },
        }

    return {
        "current_level": int(normalized),
        "next_level": None,
        "requirements": [],
        "met": {},
    }
