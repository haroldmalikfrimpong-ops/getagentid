"""APS (Agent Passport System) bridge for AgentID.

Bridges AgentID identity data into APS-compatible formats:
- DID conversion (did:agentid:{agent_id})
- APS execution envelope metadata
- Ed25519 passport signature verification
- Delegation request creation
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from nacl.encoding import Base64Encoder, RawEncoder
from nacl.exceptions import BadSignatureError
from nacl.signing import VerifyKey

# ---------------------------------------------------------------------------
# DID helpers
# ---------------------------------------------------------------------------

_DID_PREFIX = "did:agentid:"
_DID_RE = re.compile(r"^did:agentid:([a-zA-Z0-9_-]+)$")


def to_aps_did(agent_id: str) -> str:
    """Convert an AgentID agent_id to APS DID format.

    >>> to_aps_did("abc-123")
    'did:agentid:abc-123'
    """
    if not agent_id:
        raise ValueError("agent_id must be a non-empty string")
    return f"{_DID_PREFIX}{agent_id}"


def from_aps_did(did_string: str) -> str:
    """Extract agent_id from an APS DID string.

    >>> from_aps_did("did:agentid:abc-123")
    'abc-123'
    """
    match = _DID_RE.match(did_string)
    if not match:
        raise ValueError(
            f"Invalid APS DID format: {did_string!r}. "
            f"Expected 'did:agentid:<agent_id>'."
        )
    return match.group(1)


# ---------------------------------------------------------------------------
# APS metadata helpers
# ---------------------------------------------------------------------------


def create_aps_metadata(
    agent_id: str,
    certificate: Dict[str, Any],
    trust_score: float,
    capabilities: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Format AgentID data for the ``agent_did`` field of an APS execution envelope.

    Parameters
    ----------
    agent_id:
        The AgentID identifier.
    certificate:
        The AgentID certificate dict (as returned by ``client.agents.register``).
    trust_score:
        Numeric trust/reputation score (0.0 - 1.0).
    capabilities:
        Optional list of capability strings.

    Returns
    -------
    dict
        APS-compatible metadata ready to embed in an execution envelope.
    """
    if not 0.0 <= trust_score <= 1.0:
        raise ValueError("trust_score must be between 0.0 and 1.0")

    return {
        "agent_did": to_aps_did(agent_id),
        "agentid_certificate": certificate,
        "reputation": trust_score,
        "capabilities": capabilities or [],
        "source": "agentid",
        "created_at": int(time.time()),
    }


# ---------------------------------------------------------------------------
# Ed25519 passport verification
# ---------------------------------------------------------------------------


def verify_aps_passport(passport_json: str | dict) -> Dict[str, Any]:
    """Verify an APS passport's Ed25519 signature.

    The passport is expected to contain at minimum:

    - ``public_key`` (base64-encoded Ed25519 public key)
    - ``signature`` (base64-encoded Ed25519 signature over the payload)
    - ``payload`` — the signed data (dict). This is the canonical content
      that was signed.

    Parameters
    ----------
    passport_json:
        Either a JSON string or an already-parsed dict representing the passport.

    Returns
    -------
    dict
        ``{"valid": True, "payload": <dict>}`` on success.

    Raises
    ------
    ValueError
        If required fields are missing or the signature is invalid.
    """
    if isinstance(passport_json, str):
        try:
            passport = json.loads(passport_json)
        except json.JSONDecodeError as exc:
            raise ValueError(f"passport_json is not valid JSON: {exc}") from exc
    else:
        passport = passport_json

    for key in ("public_key", "signature", "payload"):
        if key not in passport:
            raise ValueError(f"Passport missing required field: {key!r}")

    public_key_bytes = Base64Encoder.decode(passport["public_key"].encode())
    signature_bytes = Base64Encoder.decode(passport["signature"].encode())
    payload_bytes = json.dumps(passport["payload"], sort_keys=True, separators=(",", ":")).encode()

    verify_key = VerifyKey(public_key_bytes)

    try:
        verify_key.verify(payload_bytes, signature_bytes)
    except BadSignatureError as exc:
        raise ValueError(f"Invalid passport signature: {exc}") from exc

    return {"valid": True, "payload": passport["payload"]}


# ---------------------------------------------------------------------------
# Delegation requests
# ---------------------------------------------------------------------------


def create_delegation_request(
    parent_agent_id: str,
    child_ed25519_pubkey: str,
    scope: List[str],
    expiry_hours: float = 24,
) -> Dict[str, Any]:
    """Create a delegation request for an APS parent to sign.

    In the APS delegation model a parent agent grants a subset of its
    authority to a child by signing a delegation document. This function
    produces the *unsigned* request that the parent would review and sign
    with its Ed25519 key.

    Parameters
    ----------
    parent_agent_id:
        AgentID of the parent (delegator).
    child_ed25519_pubkey:
        Base64-encoded Ed25519 public key of the child agent.
    scope:
        List of capability/scope strings being delegated.
    expiry_hours:
        Delegation lifetime in hours (default 24).

    Returns
    -------
    dict
        Unsigned delegation request document.
    """
    if not parent_agent_id:
        raise ValueError("parent_agent_id must be non-empty")
    if not child_ed25519_pubkey:
        raise ValueError("child_ed25519_pubkey must be non-empty")
    if not scope:
        raise ValueError("scope must be a non-empty list")
    if expiry_hours <= 0:
        raise ValueError("expiry_hours must be positive")

    now = int(time.time())
    expiry = now + int(expiry_hours * 3600)

    return {
        "type": "aps_delegation_request",
        "parent_did": to_aps_did(parent_agent_id),
        "child_public_key": child_ed25519_pubkey,
        "scope": scope,
        "issued_at": now,
        "expires_at": expiry,
        "depth": 1,
        "status": "unsigned",
    }


# ---------------------------------------------------------------------------
# Bridge dataclass
# ---------------------------------------------------------------------------


@dataclass
class AgentIDPassportBridge:
    """Bundles AgentID identity data with its APS-compatible representation.

    Attributes
    ----------
    agent_id:
        The AgentID identifier string.
    did:
        APS DID derived from agent_id (``did:agentid:<agent_id>``).
    ed25519_public_key:
        Base64-encoded Ed25519 public key for the agent.
    agentid_certificate:
        The certificate dict returned by AgentID registration.
    aps_compatible_metadata:
        Pre-built APS metadata dict (see :func:`create_aps_metadata`).
    """

    agent_id: str
    did: str = field(init=False)
    ed25519_public_key: str = ""
    agentid_certificate: Dict[str, Any] = field(default_factory=dict)
    aps_compatible_metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.did = to_aps_did(self.agent_id)

    def build_metadata(
        self,
        trust_score: float,
        capabilities: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Build and store APS-compatible metadata on this bridge instance."""
        self.aps_compatible_metadata = create_aps_metadata(
            agent_id=self.agent_id,
            certificate=self.agentid_certificate,
            trust_score=trust_score,
            capabilities=capabilities,
        )
        return self.aps_compatible_metadata
