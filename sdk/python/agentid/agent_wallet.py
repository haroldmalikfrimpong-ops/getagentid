"""AgentID Agent Wallet — the agent IS the wallet.

When an agent binds an Ed25519 key, the 32-byte public key in base58
becomes the agent's Solana wallet address automatically.  No separate
wallet generation needed — the identity key IS the wallet key.

This module wraps the balance, send, and receive operations.

Usage:
    import agentid
    from agentid.agent_wallet import AgentWallet

    client = agentid.Client(api_key="agentid_sk_...")
    wallet = AgentWallet(client, "agent_abc123")

    # Check address
    print(wallet.get_address())       # => "5Zzg..."  (base58 Solana address)

    # Check balances
    print(wallet.get_balance())       # => {"sol": "0.5", "usdc": "100.00", ...}

    # Send funds (trust-level gated)
    receipt = wallet.send("5Zzg...", 10.0, token="usdc")
    print(receipt)                    # => dual receipt with hash + blockchain

    # Get receive address
    print(wallet.receive_address())   # => same as get_address()
"""

from __future__ import annotations

import base64
import hashlib
from typing import Optional, TYPE_CHECKING

import httpx

if TYPE_CHECKING:
    from .client import Client

BASE_URL = "https://www.getagentid.dev/api/v1"


def ed25519_pub_to_solana_address(ed25519_public_key_hex: str) -> str:
    """Convert a 64-char hex Ed25519 public key to a Solana base58 address.

    Solana uses Ed25519 natively. The 32-byte public key encoded as base58
    IS a valid Solana address. No derivation needed.

    Args:
        ed25519_public_key_hex: 64-char hex string (32 bytes).

    Returns:
        Base58-encoded Solana address string.
    """
    raw_bytes = bytes.fromhex(ed25519_public_key_hex)
    if len(raw_bytes) != 32:
        raise ValueError(f"Ed25519 public key must be 32 bytes, got {len(raw_bytes)}")

    # Base58 encoding (Bitcoin/Solana alphabet)
    ALPHABET = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

    n = int.from_bytes(raw_bytes, "big")
    result = bytearray()
    while n > 0:
        n, remainder = divmod(n, 58)
        result.append(ALPHABET[remainder])
    # Add leading zeros
    for byte in raw_bytes:
        if byte == 0:
            result.append(ALPHABET[0])
        else:
            break

    return bytes(reversed(result)).decode("ascii")


class AgentWallet:
    """The agent IS the wallet.

    Wraps the AgentID API to provide wallet operations for an agent.
    The agent's Ed25519 identity key doubles as a Solana wallet address.

    Args:
        client: An agentid.Client instance with API key.
        agent_id: The agent's unique identifier.
    """

    def __init__(self, client: "Client", agent_id: str):
        self.client = client
        self.agent_id = agent_id
        self._cached_address: Optional[str] = None
        self._cached_balance: Optional[dict] = None

    def get_address(self) -> str:
        """Get the agent's Solana wallet address.

        This is the base58 encoding of the agent's Ed25519 public key.
        Returns the cached address if available, otherwise fetches from API.

        Returns:
            Base58-encoded Solana address.

        Raises:
            Exception: If agent has no Ed25519 key bound.
        """
        if self._cached_address:
            return self._cached_address

        res = httpx.get(
            f"{self.client._base_url}/agents/balance",
            params={"agent_id": self.agent_id},
            timeout=10,
            follow_redirects=True,
        )
        data = res.json()

        if res.status_code >= 400:
            raise Exception(
                f"AgentID API error: {data.get('error', 'Unknown error')}. "
                "Make sure the agent has an Ed25519 key bound."
            )

        self._cached_address = data.get("solana_address")
        return self._cached_address

    def get_balance(self) -> dict:
        """Get SOL and USDC balances for the agent's wallet.

        Returns:
            Dict with keys: agent_id, solana_address, cluster, balances
            (sol, usdc), explorer_url.
        """
        res = httpx.get(
            f"{self.client._base_url}/agents/balance",
            params={"agent_id": self.agent_id},
            timeout=15,
            follow_redirects=True,
        )
        data = res.json()

        if res.status_code >= 400:
            raise Exception(f"AgentID API error: {data.get('error', 'Unknown error')}")

        # Cache the address
        self._cached_address = data.get("solana_address")
        return data

    def send(
        self,
        to_address: str,
        amount: float,
        token: str = "usdc",
        currency: str = "usd",
    ) -> dict:
        """Send funds from the agent's wallet. Trust-level gated.

        This creates a payment intent via the AgentID pay endpoint.
        The payment is authorized based on the agent's trust level and
        daily spending limits.

        Args:
            to_address: Destination Solana wallet address (base58).
            amount: Amount to send.
            token: Token to send — "sol" or "usdc" (default "usdc").
            currency: Currency denomination (default "usd").

        Returns:
            Dict with payment intent including dual receipt
            (hash receipt + blockchain receipt).

        Raises:
            Exception: If payment is denied or agent is not authorized.
        """
        res = self.client._post("/agents/pay", {
            "from_agent_id": self.agent_id,
            "to_wallet": to_address,
            "amount": amount,
            "currency": currency,
            "chain": "solana",
        })
        return res

    def receive_address(self) -> str:
        """Get the address others should send funds to.

        This is the agent's Solana address — the same as get_address().

        Returns:
            Base58-encoded Solana address.
        """
        return self.get_address()

    def explorer_url(self) -> str:
        """Get the Solana Explorer URL for this agent's wallet.

        Returns:
            URL string to view the wallet on Solana Explorer.
        """
        balance_data = self.get_balance()
        return balance_data.get("explorer_url", "")

    def __repr__(self) -> str:
        addr = self._cached_address or "not loaded"
        return f"AgentWallet(agent_id={self.agent_id!r}, address={addr})"
