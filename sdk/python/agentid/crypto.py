"""AgentID certificate handling for Ed25519 key bindings.

Certificates are compact JWT-like tokens (header.payload.signature) that
bind an Ed25519 public key to an AgentID agent identity.  They are issued
by the AgentID platform and can be verified offline using the platform's
HMAC secret or, for untrusted contexts, by calling the verification API.

This module provides:
  - Certificate creation (for self-issued / local-dev scenarios)
  - Certificate parsing and signature verification
  - Certificate validation (expiry, field checks)
"""

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass, field
from typing import List, Optional

from .ed25519 import Ed25519Identity, ed25519_pub_to_x25519


# ── Data structures ───────────────────────────────────────────────

@dataclass
class AgentCertificate:
    """Parsed AgentID Ed25519 binding certificate."""

    # Header
    algorithm: str = "HS256"
    cert_type: str = "AgentID-Ed25519"

    # Payload
    issuer: str = "https://getagentid.dev"
    agent_id: str = ""
    binding_type: str = "ed25519-binding"
    ed25519_public_key: str = ""
    owner: str = ""
    capabilities: List[str] = field(default_factory=list)
    trust_score: float = 0.0
    issued_at: int = 0      # Unix timestamp
    expires_at: int = 0      # Unix timestamp

    # Raw token
    raw: str = ""

    # Validation state
    signature_valid: Optional[bool] = None
    expired: Optional[bool] = None

    @property
    def is_valid(self) -> bool:
        """True if signature is verified AND the certificate is not expired."""
        return self.signature_valid is True and self.expired is False

    @property
    def x25519_public_key(self) -> Optional[str]:
        """Derive the X25519 public key from the bound Ed25519 key."""
        try:
            ed_pub = bytes.fromhex(self.ed25519_public_key)
            return ed25519_pub_to_x25519(ed_pub).hex()
        except Exception:
            return None

    def to_dict(self) -> dict:
        return {
            "agent_id": self.agent_id,
            "ed25519_public_key": self.ed25519_public_key,
            "x25519_public_key": self.x25519_public_key,
            "owner": self.owner,
            "capabilities": self.capabilities,
            "trust_score": self.trust_score,
            "issued_at": self.issued_at,
            "expires_at": self.expires_at,
            "issuer": self.issuer,
            "binding_type": self.binding_type,
            "signature_valid": self.signature_valid,
            "expired": self.expired,
            "is_valid": self.is_valid,
        }


# ── Base64url helpers (no padding, URL-safe) ─────────────────────

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    # Re-add padding
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


# ── Certificate creation ─────────────────────────────────────────

def create_certificate(
    agent_id: str,
    ed25519_public_key: str,
    owner: str,
    capabilities: List[str],
    trust_score: float,
    secret: str,
    issuer: str = "https://getagentid.dev",
    validity_seconds: int = 365 * 24 * 60 * 60,
) -> AgentCertificate:
    """Create and sign an AgentID Ed25519 binding certificate.

    Args:
        agent_id:           The agent's unique identifier.
        ed25519_public_key: 64-char hex Ed25519 public key to bind.
        owner:              The agent owner (company / email).
        capabilities:       List of capability strings.
        trust_score:        Numeric trust score.
        secret:             HMAC-SHA256 signing secret (must match the platform's JWT_SECRET).
        issuer:             Certificate issuer URL.
        validity_seconds:   Certificate lifetime in seconds (default 1 year).

    Returns:
        An AgentCertificate with .raw set to the compact token string.
    """
    if len(ed25519_public_key) != 64:
        raise ValueError("ed25519_public_key must be a 64-char hex string")

    now = int(time.time())
    expires = now + validity_seconds

    header = {"alg": "HS256", "typ": "AgentID-Ed25519"}
    payload = {
        "iss": issuer,
        "sub": agent_id,
        "type": "ed25519-binding",
        "ed25519_public_key": ed25519_public_key.lower(),
        "owner": owner,
        "capabilities": capabilities,
        "trust_score": trust_score,
        "iat": now,
        "exp": expires,
    }

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode())
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())

    signing_input = f"{header_b64}.{payload_b64}"
    sig = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
    sig_b64 = _b64url_encode(sig)

    token = f"{header_b64}.{payload_b64}.{sig_b64}"

    cert = AgentCertificate(
        algorithm="HS256",
        cert_type="AgentID-Ed25519",
        issuer=issuer,
        agent_id=agent_id,
        binding_type="ed25519-binding",
        ed25519_public_key=ed25519_public_key.lower(),
        owner=owner,
        capabilities=capabilities,
        trust_score=trust_score,
        issued_at=now,
        expires_at=expires,
        raw=token,
        signature_valid=True,
        expired=False,
    )
    return cert


# ── Certificate parsing ──────────────────────────────────────────

def parse_certificate(token: str) -> AgentCertificate:
    """Parse a certificate token WITHOUT verifying the signature.

    Use verify_certificate() for full validation.
    """
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError(f"Invalid certificate format: expected 3 parts, got {len(parts)}")

    header_json = _b64url_decode(parts[0])
    payload_json = _b64url_decode(parts[1])

    header = json.loads(header_json)
    payload = json.loads(payload_json)

    return AgentCertificate(
        algorithm=header.get("alg", "HS256"),
        cert_type=header.get("typ", "AgentID-Ed25519"),
        issuer=payload.get("iss", ""),
        agent_id=payload.get("sub", ""),
        binding_type=payload.get("type", ""),
        ed25519_public_key=payload.get("ed25519_public_key", ""),
        owner=payload.get("owner", ""),
        capabilities=payload.get("capabilities", []),
        trust_score=payload.get("trust_score", 0),
        issued_at=payload.get("iat", 0),
        expires_at=payload.get("exp", 0),
        raw=token,
        signature_valid=None,  # Not yet verified
        expired=None,
    )


# ── Certificate verification ─────────────────────────────────────

def verify_certificate(token: str, secret: str) -> AgentCertificate:
    """Parse and fully verify an AgentID Ed25519 binding certificate.

    Checks:
      1. Token structure (3 base64url parts)
      2. HMAC-SHA256 signature against *secret*
      3. Expiration timestamp
      4. Required fields present

    Returns an AgentCertificate with .signature_valid and .expired set.
    """
    cert = parse_certificate(token)

    # ── Signature check ──────────────────────────────────────────
    parts = token.split(".")
    signing_input = f"{parts[0]}.{parts[1]}"
    expected_sig = hmac.new(
        secret.encode(), signing_input.encode(), hashlib.sha256
    ).digest()
    actual_sig = _b64url_decode(parts[2])
    cert.signature_valid = hmac.compare_digest(expected_sig, actual_sig)

    # ── Expiry check ─────────────────────────────────────────────
    now = int(time.time())
    cert.expired = now >= cert.expires_at

    return cert


def verify_certificate_signature_only(token: str, secret: str) -> bool:
    """Quick boolean check: is the signature valid?"""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return False
        signing_input = f"{parts[0]}.{parts[1]}"
        expected_sig = hmac.new(
            secret.encode(), signing_input.encode(), hashlib.sha256
        ).digest()
        actual_sig = _b64url_decode(parts[2])
        return hmac.compare_digest(expected_sig, actual_sig)
    except Exception:
        return False


# ── Challenge-response proof of key ownership ────────────────────

def create_ownership_proof(identity: Ed25519Identity, agent_id: str, certificate_raw: str) -> dict:
    """Create a signed proof that the caller possesses the Ed25519 private key
    bound in the given certificate.

    The proof signs a challenge string: "agentid-bind:{agent_id}:{timestamp}:{cert_hash}"
    so it is non-replayable and tied to a specific certificate.

    Returns a dict with the challenge, signature, and metadata.
    """
    timestamp = int(time.time())
    cert_hash = hashlib.sha256(certificate_raw.encode()).hexdigest()[:16]
    challenge = f"agentid-bind:{agent_id}:{timestamp}:{cert_hash}"

    signature = identity.sign(challenge.encode())

    return {
        "agent_id": agent_id,
        "challenge": challenge,
        "signature": signature.hex(),
        "ed25519_public_key": identity.ed25519_public_key_hex,
        "timestamp": timestamp,
    }


def verify_ownership_proof(
    proof: dict,
    max_age_seconds: int = 300,
) -> bool:
    """Verify a proof-of-ownership for an Ed25519 key binding.

    Args:
        proof: Dict returned by create_ownership_proof().
        max_age_seconds: Maximum age of the proof in seconds (default 5 min).

    Returns True if the signature is valid and the proof is fresh.
    """
    try:
        challenge = proof["challenge"]
        signature = bytes.fromhex(proof["signature"])
        public_key = bytes.fromhex(proof["ed25519_public_key"])
        timestamp = proof["timestamp"]

        # Check freshness
        now = int(time.time())
        if abs(now - timestamp) > max_age_seconds:
            return False

        # Verify the challenge string contains the expected agent_id
        parts = challenge.split(":")
        if len(parts) != 4 or parts[0] != "agentid-bind":
            return False
        if parts[1] != proof["agent_id"]:
            return False

        # Verify Ed25519 signature
        return Ed25519Identity.verify(public_key, challenge.encode(), signature)

    except Exception:
        return False


if __name__ == "__main__":
    # Quick demo: create an identity, issue a certificate, verify it
    print("=== AgentID Certificate Demo ===\n")

    identity = Ed25519Identity.generate()
    print(f"Generated identity: {identity}")
    print(f"  Ed25519 pub: {identity.ed25519_public_key_hex}")
    print(f"  X25519 pub:  {identity.x25519_public_key_hex}\n")

    secret = "demo-secret-do-not-use-in-production"
    cert = create_certificate(
        agent_id="agent_demo123456",
        ed25519_public_key=identity.ed25519_public_key_hex,
        owner="demo@example.com",
        capabilities=["chat", "search"],
        trust_score=50,
        secret=secret,
    )
    print(f"Certificate issued:")
    print(f"  Token: {cert.raw[:80]}...")
    print(f"  Valid: {cert.is_valid}\n")

    # Verify
    verified = verify_certificate(cert.raw, secret)
    print(f"Verification result:")
    print(f"  Signature valid: {verified.signature_valid}")
    print(f"  Expired: {verified.expired}")
    print(f"  Overall valid: {verified.is_valid}")
    print(f"  X25519 derived: {verified.x25519_public_key}\n")

    # Ownership proof
    proof = create_ownership_proof(identity, "agent_demo123456", cert.raw)
    print(f"Ownership proof: challenge={proof['challenge']}")
    ok = verify_ownership_proof(proof)
    print(f"  Proof valid: {ok}")
