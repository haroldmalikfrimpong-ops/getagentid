"""AgentID SDK — Identity & Verification for AI Agents."""

from .client import Client
from .ed25519 import Ed25519Identity, ed25519_pub_to_x25519
from .crypto import (
    AgentCertificate,
    create_certificate,
    parse_certificate,
    verify_certificate,
    create_ownership_proof,
    verify_ownership_proof,
)
from .qntm_bridge import (
    QntmAgentIdentity,
    generate_qntm_identity,
    sign_challenge,
    create_subscribe_params,
    attach_certificate,
)
from .aps_bridge import (
    AgentIDPassportBridge,
    to_aps_did,
    from_aps_did,
    create_aps_metadata,
    verify_aps_passport,
    create_delegation_request,
)

__version__ = "0.3.0"
__all__ = [
    "Client",
    "Ed25519Identity",
    "ed25519_pub_to_x25519",
    "AgentCertificate",
    "create_certificate",
    "parse_certificate",
    "verify_certificate",
    "create_ownership_proof",
    "verify_ownership_proof",
    "QntmAgentIdentity",
    "generate_qntm_identity",
    "sign_challenge",
    "create_subscribe_params",
    "attach_certificate",
    "AgentIDPassportBridge",
    "to_aps_did",
    "from_aps_did",
    "create_aps_metadata",
    "verify_aps_passport",
    "create_delegation_request",
]
