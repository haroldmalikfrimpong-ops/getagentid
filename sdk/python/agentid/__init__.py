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
from .did import (
    create_did_agentid,
    create_did_aps,
    resolve_did_agentid,
    resolve_did_aps,
    resolve_did,
    sign_with_did,
    verify_with_did,
    register_agentid_key,
    clear_agentid_registry,
    create_identity_with_dids,
)
from .trust_levels import (
    TrustLevel,
    PERMISSIONS as TRUST_PERMISSIONS,
    ACTIONS as TRUST_ACTIONS,
    calculate_trust_level,
    check_permission,
    get_spending_limit,
    level_up_requirements,
)
from .spending import SpendingClient, SpendingError, SpendingResult
from .crypto_payments import PaymentClient, PaymentIntent, PaymentRecord, PaymentError
from .challenge import request_challenge, respond_to_challenge
from .wallet import bind_wallet, get_wallet, build_binding_message
from .agent_wallet import AgentWallet, ed25519_pub_to_solana_address
from .daemon import DaemonAgent

__version__ = "0.5.0"
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
    "create_did_agentid",
    "create_did_aps",
    "resolve_did_agentid",
    "resolve_did_aps",
    "resolve_did",
    "sign_with_did",
    "verify_with_did",
    "register_agentid_key",
    "clear_agentid_registry",
    "create_identity_with_dids",
    "TrustLevel",
    "TRUST_PERMISSIONS",
    "TRUST_ACTIONS",
    "calculate_trust_level",
    "check_permission",
    "get_spending_limit",
    "level_up_requirements",
    "SpendingClient",
    "SpendingError",
    "SpendingResult",
    "PaymentClient",
    "PaymentIntent",
    "PaymentRecord",
    "PaymentError",
    "request_challenge",
    "respond_to_challenge",
    "bind_wallet",
    "get_wallet",
    "build_binding_message",
    "AgentWallet",
    "ed25519_pub_to_solana_address",
    "DaemonAgent",
]
