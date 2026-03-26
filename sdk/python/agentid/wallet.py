"""AgentID Wallet Binding — bind and retrieve crypto wallets for agents.

Supports Ethereum, Solana, and Polygon wallet bindings. The agent owner
signs a binding message with their wallet private key to prove ownership,
then the signature + address are stored on the agent record.

Usage:
    import agentid

    client = agentid.Client(api_key="agentid_sk_...")

    # Bind an Ethereum wallet
    result = client.agents.bind_wallet(
        agent_id="agent_abc123",
        wallet_address="0x1234...abcd",
        chain="ethereum",
        signature="0xdeadbeef...",
    )
    print(result.bound, result.wallet_address, result.chain)

    # Retrieve wallet info
    wallet = client.agents.get_wallet("agent_abc123")
    print(wallet.wallet_bound, wallet.wallet_address, wallet.chain)

Standalone functions (for use without the Client class):

    from agentid.wallet import bind_wallet, get_wallet

    result = bind_wallet(client, "agent_abc123", "0x...", "ethereum", "0x...")
    wallet = get_wallet(client, "agent_abc123")

Signing convention:
    The message to sign is: "AgentID:bind:{agent_id}:{wallet_address}"
    - Ethereum/Polygon: personal_sign or eth_sign the message
    - Solana: Ed25519 sign the UTF-8 encoded message bytes
"""

import httpx
from typing import Optional

BASE_URL = "https://www.getagentid.dev/api/v1"

SUPPORTED_CHAINS = ("ethereum", "solana", "polygon")


def build_binding_message(agent_id: str, wallet_address: str) -> str:
    """Build the canonical message that must be signed for wallet binding.

    Args:
        agent_id: The agent's unique identifier.
        wallet_address: The wallet address to bind.

    Returns:
        The message string: "AgentID:bind:{agent_id}:{wallet_address}"
    """
    return f"AgentID:bind:{agent_id}:{wallet_address}"


def bind_wallet(client, agent_id: str, wallet_address: str, chain: str, signature: str) -> dict:
    """Bind a crypto wallet to an AgentID agent.

    The caller must have already signed the binding message
    ("AgentID:bind:{agent_id}:{wallet_address}") with the wallet's private key.

    Args:
        client: An agentid.Client instance (must have an API key set).
        agent_id: The agent's unique identifier.
        wallet_address: The wallet address to bind (0x-prefixed for ETH/Polygon,
                        base58 for Solana).
        chain: The blockchain — one of "ethereum", "solana", "polygon".
        signature: Hex-encoded signature of the binding message.

    Returns:
        dict with keys: bound (bool), agent_id, wallet_address, chain.

    Raises:
        ValueError: If chain is not supported.
        Exception: If the API returns an error.
    """
    if chain not in SUPPORTED_CHAINS:
        raise ValueError(f"Unsupported chain '{chain}'. Must be one of: {', '.join(SUPPORTED_CHAINS)}")

    return client._post("/agents/bind-wallet", {
        "agent_id": agent_id,
        "wallet_address": wallet_address,
        "chain": chain,
        "signature": signature,
    })


def get_wallet(client, agent_id: str) -> dict:
    """Get the bound wallet for an agent.

    This is a public endpoint — no API key is required, but one is
    accepted if present.

    Args:
        client: An agentid.Client instance.
        agent_id: The agent's unique identifier.

    Returns:
        dict with keys: agent_id, wallet_bound (bool).
        If wallet_bound is True, also includes: wallet_address, chain, bound_at.
    """
    res = httpx.get(
        f"{client._base_url}/agents/wallet",
        params={"agent_id": agent_id},
        timeout=10,
        follow_redirects=True,
    )
    if res.status_code >= 400:
        error = res.json().get("error", "Unknown error")
        raise Exception(f"AgentID API error: {error}")
    return res.json()
