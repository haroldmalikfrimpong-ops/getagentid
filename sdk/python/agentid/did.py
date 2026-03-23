"""DID resolution and cross-verification for AgentID and APS.

Supports two DID methods:
  - did:agentid:<agent_id>   (AgentID native)
  - did:aps:<multibase>      (APS — base58btc-encoded Ed25519 public key)

APS multibase format: "z" prefix + base58btc encoding of the raw 32-byte
Ed25519 public key (matching the W3C DID multibase convention).

This module provides:
  - DID creation for both methods
  - DID resolution (extract Ed25519 public key)
  - Signing and cross-verification using DID-resolved keys
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Dict, Optional, Tuple

from .ed25519 import Ed25519Identity


# ---------------------------------------------------------------------------
# Base58btc codec (no external dependency)
# ---------------------------------------------------------------------------

_B58_ALPHABET = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
_B58_ALPHABET_STR = _B58_ALPHABET.decode("ascii")
_B58_BASE = 58
_B58_MAP: Dict[int, int] = {ch: idx for idx, ch in enumerate(_B58_ALPHABET)}


def _b58encode(data: bytes) -> str:
    """Encode *data* as a base58btc string (Bitcoin alphabet)."""
    if not data:
        return ""

    # Count leading zero bytes — each maps to "1"
    n_pad = 0
    for byte in data:
        if byte == 0:
            n_pad += 1
        else:
            break

    # Convert bytes to a big integer
    num = int.from_bytes(data, "big")

    # Repeatedly divmod by 58
    chars = []
    while num > 0:
        num, remainder = divmod(num, _B58_BASE)
        chars.append(_B58_ALPHABET_STR[remainder])

    return "1" * n_pad + "".join(reversed(chars))


def _b58decode(s: str) -> bytes:
    """Decode a base58btc string back to bytes."""
    if not s:
        return b""

    # Count leading '1' characters — each maps to a 0x00 byte
    n_pad = 0
    for ch in s:
        if ch == "1":
            n_pad += 1
        else:
            break

    num = 0
    for ch in s:
        if ord(ch) not in _B58_MAP:
            raise ValueError(f"Invalid base58btc character: {ch!r}")
        num = num * _B58_BASE + _B58_MAP[ord(ch)]

    if num == 0:
        return b"\x00" * n_pad

    result = num.to_bytes((num.bit_length() + 7) // 8, "big")
    return b"\x00" * n_pad + result


# ---------------------------------------------------------------------------
# DID patterns
# ---------------------------------------------------------------------------

_DID_AGENTID_RE = re.compile(r"^did:agentid:([a-zA-Z0-9_-]+)$")
_DID_APS_RE = re.compile(r"^did:aps:(z[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+)$")

# Internal registry: agent_id -> Ed25519 public key bytes
# Used for local/test resolution of did:agentid DIDs without an API call.
_LOCAL_AGENTID_REGISTRY: Dict[str, bytes] = {}


# ---------------------------------------------------------------------------
# Registry helpers (for testing without a live API)
# ---------------------------------------------------------------------------


def register_agentid_key(agent_id: str, public_key: bytes) -> None:
    """Register an Ed25519 public key for local did:agentid resolution.

    In production this would be replaced by an API call or certificate
    lookup.  For testing and local interop demos this in-memory registry
    is sufficient.
    """
    if len(public_key) != 32:
        raise ValueError(f"Ed25519 public key must be 32 bytes, got {len(public_key)}")
    _LOCAL_AGENTID_REGISTRY[agent_id] = public_key


def clear_agentid_registry() -> None:
    """Clear the local did:agentid resolution registry."""
    _LOCAL_AGENTID_REGISTRY.clear()


# ---------------------------------------------------------------------------
# DID creation
# ---------------------------------------------------------------------------


def create_did_agentid(agent_id: str) -> str:
    """Create a ``did:agentid:<agent_id>`` DID string.

    >>> create_did_agentid("agent-007")
    'did:agentid:agent-007'
    """
    if not agent_id:
        raise ValueError("agent_id must be a non-empty string")
    if not re.match(r"^[a-zA-Z0-9_-]+$", agent_id):
        raise ValueError(
            f"agent_id contains invalid characters: {agent_id!r}. "
            "Only alphanumeric, underscore, and hyphen are allowed."
        )
    return f"did:agentid:{agent_id}"


def create_did_aps(ed25519_public_key: bytes) -> str:
    """Create a ``did:aps:z<base58btc>`` DID from a 32-byte Ed25519 public key.

    The multibase encoding uses the 'z' prefix (base58btc) followed by the
    base58btc encoding of the raw 32-byte public key.

    >>> import bytes
    >>> create_did_aps(b'\\x00' * 32)
    'did:aps:z1111111111111111111111111111111111111111111'
    """
    if not isinstance(ed25519_public_key, bytes):
        raise TypeError(f"ed25519_public_key must be bytes, got {type(ed25519_public_key).__name__}")
    if len(ed25519_public_key) != 32:
        raise ValueError(f"Ed25519 public key must be 32 bytes, got {len(ed25519_public_key)}")
    encoded = _b58encode(ed25519_public_key)
    return f"did:aps:z{encoded}"


# ---------------------------------------------------------------------------
# DID resolution
# ---------------------------------------------------------------------------


def resolve_did_agentid(did_string: str) -> bytes:
    """Resolve a ``did:agentid:<agent_id>`` DID and return the Ed25519 public key.

    Looks up the agent_id in the local registry.  In production this would
    call the AgentID API or extract the key from the agent's certificate.

    Returns
    -------
    bytes
        The 32-byte Ed25519 public key.

    Raises
    ------
    ValueError
        If the DID format is invalid or the agent_id is not found.
    """
    match = _DID_AGENTID_RE.match(did_string)
    if not match:
        raise ValueError(
            f"Invalid did:agentid format: {did_string!r}. "
            "Expected 'did:agentid:<agent_id>'."
        )
    agent_id = match.group(1)
    if agent_id not in _LOCAL_AGENTID_REGISTRY:
        raise ValueError(
            f"Agent {agent_id!r} not found in local registry. "
            "Register it with register_agentid_key() or use the AgentID API."
        )
    return _LOCAL_AGENTID_REGISTRY[agent_id]


def resolve_did_aps(did_string: str) -> bytes:
    """Resolve a ``did:aps:z<base58btc>`` DID and return the Ed25519 public key.

    Decodes the multibase (base58btc) portion of the DID to recover the
    raw 32-byte Ed25519 public key.

    Returns
    -------
    bytes
        The 32-byte Ed25519 public key.

    Raises
    ------
    ValueError
        If the DID format is invalid or decoding fails.
    """
    match = _DID_APS_RE.match(did_string)
    if not match:
        raise ValueError(
            f"Invalid did:aps format: {did_string!r}. "
            "Expected 'did:aps:z<base58btc-encoded-public-key>'."
        )
    multibase = match.group(1)
    # Strip the 'z' multibase prefix
    b58_part = multibase[1:]
    try:
        raw_key = _b58decode(b58_part)
    except ValueError as exc:
        raise ValueError(f"Failed to decode base58btc from DID: {exc}") from exc

    if len(raw_key) != 32:
        raise ValueError(
            f"Decoded key is {len(raw_key)} bytes, expected 32. "
            f"DID: {did_string!r}"
        )
    return raw_key


def resolve_did(did_string: str) -> bytes:
    """Resolve any supported DID and return the Ed25519 public key.

    Dispatches to :func:`resolve_did_agentid` or :func:`resolve_did_aps`
    based on the DID method.
    """
    if did_string.startswith("did:agentid:"):
        return resolve_did_agentid(did_string)
    elif did_string.startswith("did:aps:"):
        return resolve_did_aps(did_string)
    else:
        raise ValueError(
            f"Unsupported DID method: {did_string!r}. "
            "Supported methods: did:agentid, did:aps."
        )


# ---------------------------------------------------------------------------
# Signing and verification
# ---------------------------------------------------------------------------


def sign_with_did(message: bytes, private_key: bytes) -> bytes:
    """Sign *message* with an Ed25519 private key (32-byte seed).

    Returns the 64-byte Ed25519 signature.  The private_key is the
    32-byte seed used to reconstruct the Ed25519Identity.
    """
    if not isinstance(message, bytes):
        raise TypeError(f"message must be bytes, got {type(message).__name__}")
    if not isinstance(private_key, bytes):
        raise TypeError(f"private_key must be bytes, got {type(private_key).__name__}")
    if len(private_key) != 32:
        raise ValueError(f"private_key must be 32 bytes (Ed25519 seed), got {len(private_key)}")
    identity = Ed25519Identity.from_seed(private_key)
    return identity.sign(message)


def verify_with_did(message: bytes, signature: bytes, did: str) -> bool:
    """Verify an Ed25519 *signature* over *message* using a DID-resolved key.

    Resolves the DID to obtain the Ed25519 public key, then verifies
    the signature.

    Returns True on success, False on failure (does not raise for
    cryptographic failures — only raises for DID resolution errors).
    """
    if not isinstance(message, bytes):
        raise TypeError(f"message must be bytes, got {type(message).__name__}")
    if not isinstance(signature, bytes):
        raise TypeError(f"signature must be bytes, got {type(signature).__name__}")

    public_key = resolve_did(did)
    return Ed25519Identity.verify(public_key, message, signature)


# ---------------------------------------------------------------------------
# Convenience: full round-trip helpers
# ---------------------------------------------------------------------------


def create_identity_with_dids(agent_id: str) -> Tuple[Ed25519Identity, str, str]:
    """Generate an Ed25519 identity and return both DID forms.

    Creates a new random Ed25519 keypair, registers it in the local
    registry for did:agentid resolution, and returns:

    - The :class:`Ed25519Identity` instance
    - The did:agentid DID string
    - The did:aps DID string

    Both DIDs reference the same underlying Ed25519 public key.
    """
    identity = Ed25519Identity.generate()
    did_agentid = create_did_agentid(agent_id)
    did_aps = create_did_aps(identity.ed25519_public_key)
    register_agentid_key(agent_id, identity.ed25519_public_key)
    return identity, did_agentid, did_aps


# ---------------------------------------------------------------------------
# Entity verification (Corpo API)
# ---------------------------------------------------------------------------

CORPO_API_BASE = "https://api.corpo.llc/api/v1"


def verify_entity(entity_id: str, base_url: str = CORPO_API_BASE) -> Dict[str, Any]:
    """Verify a legal entity via the Corpo staging API.

    Returns dict with entity_id, name, status, entity_type, authority_ceiling, verified_at.
    Raises RuntimeError if entity not found or API fails.
    """
    import httpx
    resp = httpx.get(f"{base_url}/entities/{entity_id}/verify", timeout=10)
    if resp.status_code != 200:
        raise RuntimeError(f"Entity verification failed: HTTP {resp.status_code}")
    return resp.json()


def verify_envelope_did(sender_key_id: bytes, did: str) -> bool:
    """Verify that a DID resolves to an Ed25519 key matching the sender key ID.

    sender_key_id is Trunc16(SHA-256(ed25519_pub)) — 16 bytes.
    Returns True if the DID's key matches.
    """
    pub_key = resolve_did(did)
    expected_key_id = hashlib.sha256(pub_key).digest()[:16]
    return expected_key_id == sender_key_id


def verify_agent_full(
    did: str,
    entity_id: Optional[str] = None,
    sender_key_id: Optional[bytes] = None,
) -> Dict[str, Any]:
    """Full agent verification: DID + optional sender key match + optional entity.

    Returns a dict with:
      - did: the DID string
      - did_valid: True if DID resolves to a valid Ed25519 key
      - ed25519_public_key: hex of the resolved key
      - sender_match: True/False/None (None if sender_key_id not provided)
      - entity: entity verification result or None
      - fully_verified: True only if all provided checks pass
    """
    result: Dict[str, Any] = {
        "did": did,
        "did_valid": False,
        "ed25519_public_key": None,
        "sender_match": None,
        "entity": None,
        "fully_verified": False,
    }

    # Step 1: Resolve DID
    try:
        pub_key = resolve_did(did)
        result["did_valid"] = True
        result["ed25519_public_key"] = pub_key.hex()
    except Exception:
        return result

    # Step 2: Verify sender key ID matches (if provided)
    if sender_key_id is not None:
        expected = hashlib.sha256(pub_key).digest()[:16]
        result["sender_match"] = (expected == sender_key_id)
    else:
        result["sender_match"] = None

    # Step 3: Verify legal entity (if provided)
    if entity_id is not None:
        try:
            entity = verify_entity(entity_id)
            result["entity"] = entity
        except Exception as e:
            result["entity"] = {"error": str(e)}

    # Fully verified = DID valid + sender matches (if checked) + entity active (if checked)
    checks = [result["did_valid"]]
    if result["sender_match"] is not None:
        checks.append(result["sender_match"])
    if result["entity"] is not None and "error" not in result["entity"]:
        checks.append(result["entity"].get("status") == "active")
    result["fully_verified"] = all(checks)

    return result
