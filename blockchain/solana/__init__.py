"""AgentID on-chain registry — Solana Memo-based identity publishing."""

from .registry import publish_agent_identity, verify_agent_onchain
from .config import SOLANA_RPC_URL, REGISTRY_KEYPAIR_PATH, MEMO_PROGRAM_ID, explorer_tx_url

__all__ = [
    "publish_agent_identity",
    "verify_agent_onchain",
    "SOLANA_RPC_URL",
    "REGISTRY_KEYPAIR_PATH",
    "MEMO_PROGRAM_ID",
    "explorer_tx_url",
]
