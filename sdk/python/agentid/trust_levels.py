"""
AgentID Trust Level System

Defines L0-L4 trust levels with permissions, spending limits, and level-up requirements.
"""

from enum import IntEnum
from datetime import datetime, timezone
from typing import Any, Optional


class TrustLevel(IntEnum):
    """Trust levels for AgentID agents."""
    L0_UNVERIFIED = 0      # Just registered. No access.
    L1_BASIC = 1           # Read-only. Can browse, search, discover.
    L2_VERIFIED = 2        # Can send messages, make API calls, interact with agents.
    L3_TRUSTED = 3         # Can handle sensitive data, access paid services, small payments.
    L4_FULL_AUTHORITY = 4  # Can make payments, sign contracts, manage funds, full autonomy.


# All possible actions in the system
ACTIONS = [
    "read",
    "discover",
    "verify",
    "send_message",
    "connect",
    "handle_data",
    "access_paid_service",
    "make_payment",
    "sign_contract",
    "manage_funds",
    "full_autonomy",
]

# Permission sets per trust level (cumulative)
PERMISSIONS: dict[TrustLevel, list[str]] = {
    TrustLevel.L0_UNVERIFIED: [],
    TrustLevel.L1_BASIC: ["read", "discover"],
    TrustLevel.L2_VERIFIED: ["read", "discover", "verify", "send_message", "connect"],
    TrustLevel.L3_TRUSTED: [
        "read", "discover", "verify", "send_message", "connect",
        "handle_data", "access_paid_service", "make_payment",
    ],
    TrustLevel.L4_FULL_AUTHORITY: [
        "read", "discover", "verify", "send_message", "connect",
        "handle_data", "access_paid_service", "make_payment",
        "sign_contract", "manage_funds", "full_autonomy",
    ],
}

# Daily spending limits in USD per trust level
SPENDING_LIMITS: dict[TrustLevel, int] = {
    TrustLevel.L0_UNVERIFIED: 0,
    TrustLevel.L1_BASIC: 0,
    TrustLevel.L2_VERIFIED: 0,
    TrustLevel.L3_TRUSTED: 100,
    TrustLevel.L4_FULL_AUTHORITY: 10000,
}

# Human-readable labels
TRUST_LEVEL_LABELS: dict[TrustLevel, str] = {
    TrustLevel.L0_UNVERIFIED: "L0 — Unverified",
    TrustLevel.L1_BASIC: "L1 — Basic",
    TrustLevel.L2_VERIFIED: "L2 — Verified",
    TrustLevel.L3_TRUSTED: "L3 — Trusted",
    TrustLevel.L4_FULL_AUTHORITY: "L4 — Full Authority",
}


def _days_since(iso_timestamp: str) -> float:
    """Calculate days elapsed since an ISO timestamp."""
    created = datetime.fromisoformat(iso_timestamp.replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    return (now - created).total_seconds() / 86400


def calculate_trust_level(agent_data: dict[str, Any]) -> TrustLevel:
    """
    Calculate the trust level for an agent based on its data.

    Expected keys in agent_data:
        trust_score (float): 0.0 to 1.0
        verified (bool): has been verified at least once
        certificate_valid (bool): current certificate is not expired
        entity_verified (bool, optional): legal entity binding confirmed
        owner_email_verified (bool, optional): owner has verified their email
        created_at (str): ISO timestamp
        successful_verifications (int, optional): count of successful verifications
    """
    trust_score = agent_data.get("trust_score", 0)
    certificate_valid = agent_data.get("certificate_valid", False)
    entity_verified = agent_data.get("entity_verified", False)
    owner_email_verified = agent_data.get("owner_email_verified", False)
    created_at = agent_data.get("created_at", datetime.now(timezone.utc).isoformat())
    successful_verifications = agent_data.get("successful_verifications", 0)

    days_active = _days_since(created_at)

    # L4: trust_score >= 0.9, entity verified, 30 days active, 50+ successful verifications
    if (
        trust_score >= 0.9
        and entity_verified
        and days_active >= 30
        and successful_verifications >= 50
        and certificate_valid
    ):
        return TrustLevel.L4_FULL_AUTHORITY

    # L3: trust_score >= 0.7, 10+ successful verifications, 7 days active
    if (
        trust_score >= 0.7
        and successful_verifications >= 10
        and days_active >= 7
        and certificate_valid
    ):
        return TrustLevel.L3_TRUSTED

    # L2: certificate issued + at least 1 successful verification
    if certificate_valid and successful_verifications >= 1:
        return TrustLevel.L2_VERIFIED

    # L1: agent exists + owner verified email
    if owner_email_verified:
        return TrustLevel.L1_BASIC

    # L0: default
    return TrustLevel.L0_UNVERIFIED


def check_permission(level: TrustLevel, action: str) -> bool:
    """Check whether a given trust level grants permission for a specific action."""
    allowed = PERMISSIONS.get(level, [])
    return action in allowed


def get_spending_limit(level: TrustLevel) -> int:
    """Get the maximum daily spending limit in USD for a trust level."""
    return SPENDING_LIMITS.get(level, 0)


def level_up_requirements(
    current_level: TrustLevel,
    agent_data: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    Return what an agent needs to reach the next trust level.
    Includes which requirements are already met based on the agent's current data.
    """
    if current_level >= TrustLevel.L4_FULL_AUTHORITY:
        return {
            "current_level": int(current_level),
            "next_level": None,
            "requirements": ["Already at maximum trust level"],
            "met": {"max_level": True},
        }

    days_active = 0.0
    successful_verifications = 0
    if agent_data:
        created_at = agent_data.get("created_at", datetime.now(timezone.utc).isoformat())
        days_active = _days_since(created_at)
        successful_verifications = agent_data.get("successful_verifications", 0)

    if current_level == TrustLevel.L0_UNVERIFIED:
        return {
            "current_level": int(current_level),
            "next_level": int(TrustLevel.L1_BASIC),
            "requirements": [
                "Agent must exist (registered)",
                "Owner must verify their email address",
            ],
            "met": {
                "agent_exists": True,
                "owner_email_verified": bool(agent_data.get("owner_email_verified", False)) if agent_data else False,
            },
        }

    if current_level == TrustLevel.L1_BASIC:
        return {
            "current_level": int(current_level),
            "next_level": int(TrustLevel.L2_VERIFIED),
            "requirements": [
                "Valid certificate must be issued",
                "At least 1 successful verification",
            ],
            "met": {
                "certificate_valid": bool(agent_data.get("certificate_valid", False)) if agent_data else False,
                "has_verification": successful_verifications >= 1,
            },
        }

    if current_level == TrustLevel.L2_VERIFIED:
        return {
            "current_level": int(current_level),
            "next_level": int(TrustLevel.L3_TRUSTED),
            "requirements": [
                "Trust score >= 0.7",
                "At least 10 successful verifications",
                "At least 7 days active",
            ],
            "met": {
                "trust_score_sufficient": (agent_data.get("trust_score", 0) if agent_data else 0) >= 0.7,
                "enough_verifications": successful_verifications >= 10,
                "days_active_sufficient": days_active >= 7,
            },
        }

    if current_level == TrustLevel.L3_TRUSTED:
        return {
            "current_level": int(current_level),
            "next_level": int(TrustLevel.L4_FULL_AUTHORITY),
            "requirements": [
                "Trust score >= 0.9",
                "Entity verified (legal entity binding)",
                "At least 30 days active",
                "At least 50 successful verifications",
            ],
            "met": {
                "trust_score_sufficient": (agent_data.get("trust_score", 0) if agent_data else 0) >= 0.9,
                "entity_verified": bool(agent_data.get("entity_verified", False)) if agent_data else False,
                "days_active_sufficient": days_active >= 30,
                "enough_verifications": successful_verifications >= 50,
            },
        }

    return {
        "current_level": int(current_level),
        "next_level": None,
        "requirements": [],
        "met": {},
    }
