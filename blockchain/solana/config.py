"""Solana on-chain registry configuration for AgentID."""

import os

# ---------------------------------------------------------------------------
# RPC
# ---------------------------------------------------------------------------
# Default to Solana devnet.  Override with SOLANA_RPC_URL env var for mainnet
# or a custom RPC provider (e.g. Helius, QuickNode).
SOLANA_RPC_URL = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")

# ---------------------------------------------------------------------------
# Registry Keypair
# ---------------------------------------------------------------------------
# Path to a JSON file containing the registry authority's keypair
# (64-byte secret key exported by `solana-keygen new`).
# All memo transactions are signed by this key so verifiers know the source.
REGISTRY_KEYPAIR_PATH = os.getenv(
    "AGENTID_REGISTRY_KEYPAIR",
    os.path.expanduser("~/.config/agentid/registry-keypair.json"),
)

# ---------------------------------------------------------------------------
# Memo Program
# ---------------------------------------------------------------------------
# The Solana Memo Program v2 — deployed on every cluster (devnet, testnet, mainnet).
# No custom smart contract needed; we just attach a JSON memo to a transaction.
MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"

# ---------------------------------------------------------------------------
# Explorer
# ---------------------------------------------------------------------------
# Which cluster to link in Solana Explorer URLs.
SOLANA_CLUSTER = os.getenv("SOLANA_CLUSTER", "devnet")

def explorer_tx_url(signature: str) -> str:
    """Return a Solana Explorer URL for a transaction signature."""
    base = "https://explorer.solana.com/tx"
    if SOLANA_CLUSTER == "mainnet-beta":
        return f"{base}/{signature}"
    return f"{base}/{signature}?cluster={SOLANA_CLUSTER}"
