"""qntm bridge — Ed25519 identity for AgentID agents on qntm relays.

Handles the qntm subscribe auth flow:
  1. Generate Ed25519 keypair and bind it to an AgentID agent
  2. Sign relay challenges to prove identity
  3. Attach AgentID certificates to message metadata
"""

from __future__ import annotations

import binascii
from dataclasses import dataclass, field
from typing import Dict, Optional

import httpx
from nacl.signing import SigningKey, VerifyKey
from nacl.public import PrivateKey as X25519PrivateKey
from nacl.encoding import HexEncoder, RawEncoder


BASE_URL = "https://www.getagentid.dev/api/v1"


@dataclass
class QntmAgentIdentity:
    """Holds all cryptographic material and the AgentID certificate for a qntm agent."""

    agent_id: str
    ed25519_seed: bytes          # 32-byte seed (private key material)
    ed25519_public_key: bytes    # 32-byte Ed25519 public key
    x25519_public_key: bytes     # 32-byte X25519 public key (for encryption)
    agentid_certificate: dict    # certificate returned by AgentID bind endpoint

    @property
    def ed25519_public_hex(self) -> str:
        return self.ed25519_public_key.hex()

    @property
    def x25519_public_hex(self) -> str:
        return self.x25519_public_key.hex()


def generate_qntm_identity(
    api_key: str,
    agent_id: str,
    base_url: str = BASE_URL,
) -> QntmAgentIdentity:
    """Generate an Ed25519 keypair, bind it to an AgentID agent, and return the identity.

    Steps:
      1. Create a fresh Ed25519 signing keypair via PyNaCl.
      2. Derive the corresponding X25519 public key (for future encryption use).
      3. POST the Ed25519 public key to the AgentID bind-ed25519 endpoint.
      4. Return a QntmAgentIdentity with keys + the certificate from the API.

    Args:
        api_key:  AgentID API key (``agentid_sk_...``).
        agent_id: The agent_id to bind the key to.
        base_url: AgentID API base URL (override for testing).

    Returns:
        QntmAgentIdentity with all key material and the API certificate.

    Raises:
        Exception: If the AgentID API returns an error.
    """
    # 1. Generate Ed25519 keypair
    signing_key = SigningKey.generate()
    verify_key = signing_key.verify_key

    ed25519_seed = bytes(signing_key)                        # 32-byte seed
    ed25519_pub = bytes(verify_key)                          # 32-byte public key

    # 2. Derive X25519 public key from the Ed25519 signing key
    #    PyNaCl: SigningKey.to_curve25519_private_key() -> X25519 private key
    x25519_private = signing_key.to_curve25519_private_key()
    x25519_pub = bytes(x25519_private.public_key)

    # 3. Call AgentID bind-ed25519 endpoint
    headers = {"Authorization": f"Bearer {api_key}"}
    payload = {
        "agent_id": agent_id,
        "ed25519_public_key": ed25519_pub.hex(),
    }

    res = httpx.post(
        f"{base_url}/agents/bind-ed25519",
        json=payload,
        headers=headers,
        timeout=10,
        follow_redirects=True,
    )

    if res.status_code >= 400:
        error = res.json().get("error", "Unknown error")
        raise Exception(f"AgentID bind-ed25519 error: {error}")

    certificate = res.json()

    # 4. Build identity
    return QntmAgentIdentity(
        agent_id=agent_id,
        ed25519_seed=ed25519_seed,
        ed25519_public_key=ed25519_pub,
        x25519_public_key=x25519_pub,
        agentid_certificate=certificate,
    )


def sign_challenge(identity: QntmAgentIdentity, challenge_hex: str) -> str:
    """Sign a qntm relay challenge with the agent's Ed25519 private key.

    The relay sends ``{"challenge": "<32-byte-hex>"}``.  This function signs
    the raw challenge bytes and returns the 64-byte signature as hex.

    Args:
        identity:      A QntmAgentIdentity (must contain ed25519_seed).
        challenge_hex: The hex-encoded challenge string from the relay.

    Returns:
        Hex-encoded Ed25519 signature (128 hex chars = 64 bytes).
    """
    challenge_bytes = binascii.unhexlify(challenge_hex)
    signing_key = SigningKey(identity.ed25519_seed)
    signed = signing_key.sign(challenge_bytes)
    # signed.signature is the 64-byte detached signature
    return signed.signature.hex()


def create_subscribe_params(identity: QntmAgentIdentity, conv_id: str) -> dict:
    """Build the query parameters for a qntm subscribe connection.

    The relay expects: GET /v1/subscribe?conv_id=X&pub_key=Y

    Args:
        identity: A QntmAgentIdentity.
        conv_id:  The conversation ID to subscribe to.

    Returns:
        Dict with ``conv_id`` and ``pub_key`` keys ready for URL params.
    """
    return {
        "conv_id": conv_id,
        "pub_key": identity.ed25519_public_hex,
    }


def attach_certificate(
    message_metadata: dict,
    certificate: dict,
) -> dict:
    """Attach an AgentID certificate to outgoing message metadata.

    This embeds the certificate so the receiving agent (or relay) can verify
    the sender's AgentID identity independently.

    Args:
        message_metadata: Existing metadata dict (will not be mutated).
        certificate:      The agentid_certificate from a QntmAgentIdentity.

    Returns:
        A new dict with the certificate merged under the ``agentid`` key.
    """
    result = dict(message_metadata)
    result["agentid"] = {
        "certificate": certificate,
    }
    return result
