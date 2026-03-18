"""Cryptographic key generation and certificate signing for agents."""

import uuid
import json
import jwt
from datetime import datetime, timezone, timedelta
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from ..config import JWT_SECRET, AGENTID_DOMAIN


def generate_agent_id():
    """Generate a unique agent ID."""
    return f"agent_{uuid.uuid4().hex[:16]}"


def generate_keypair():
    """Generate an ECDSA keypair for an agent."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()

    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()

    return private_pem, public_pem


def issue_certificate(agent_id, name, owner, capabilities, public_key):
    """Issue a signed certificate for an agent."""
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=365)

    payload = {
        "iss": f"https://{AGENTID_DOMAIN}",
        "sub": agent_id,
        "name": name,
        "owner": owner,
        "capabilities": capabilities,
        "public_key_fingerprint": public_key[:64],
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }

    certificate = jwt.encode(payload, JWT_SECRET, algorithm="HS256")

    return {
        "certificate": certificate,
        "issued_at": now.isoformat(),
        "expires_at": expires.isoformat(),
    }


def verify_certificate(certificate):
    """Verify a certificate is valid and not expired."""
    try:
        payload = jwt.decode(certificate, JWT_SECRET, algorithms=["HS256"])
        return {"valid": True, "payload": payload}
    except jwt.ExpiredSignatureError:
        return {"valid": False, "error": "Certificate expired"}
    except jwt.InvalidTokenError as e:
        return {"valid": False, "error": str(e)}
