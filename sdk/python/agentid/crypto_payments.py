"""AgentID Crypto Payment Client — Agent-to-Agent and Agent-to-Human.

Authorization layer for agent crypto payments. Trust levels gate spending
authority — L1-L2 cannot pay ($0 limit, no wallet bound), L3 up to
$10,000/day (default, user can lower), L4 up to $100,000/day (default, user can lower).

This is the AUTHORIZATION layer. The actual on-chain transfer is a separate
step — we build the trust/authorization layer that sits BEFORE the crypto
transfer happens.

Agent-to-Agent Flow:
    1. Agent A wants to pay Agent B $50
    2. System checks Agent A's trust level and daily spending limits
    3. System verifies both Agent A and Agent B are registered with AgentID
    4. Creates a payment intent (off-chain authorization record)
    5. Agent A signs the transaction with their wallet key (external step)
    6. System records the payment and updates spending history

Agent-to-Human Flow (additional security):
    1. Owner pre-approves destination wallet (allowlist)
    2. First payment to a new wallet has a 24-hour cooling period
    3. Duplicate detection (same amount + same wallet within 10 min)
    4. Per-recipient daily limit ($50/day for L3, $1000/day for L4)
    5. Large payments require owner dual-approval
    6. Owner can freeze/unfreeze any agent's payments instantly

Usage:
    from agentid.crypto_payments import PaymentClient

    payments = PaymentClient(api_key="agentid_sk_...")

    # Agent-to-agent payment
    intent = payments.create_payment_intent(
        from_agent_id="agent_abc123",
        to_agent_id="agent_def456",
        amount_usd=50.00,
        chain="solana",
    )

    # Agent-to-human payment (wallet must be on allowlist first)
    payments.add_to_allowlist(
        wallet_address="0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
        chain="ethereum",
        label="Freelancer - Alice",
    )
    intent = payments.pay_human(
        from_agent_id="agent_abc123",
        to_wallet="0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
        amount_usd=25.00,
        chain="ethereum",
    )

    # Execute after signing (pass the signed tx from your wallet)
    result = payments.execute_payment(
        payment_intent_id=intent.payment_id,
        signed_transaction="<hex-encoded-signed-tx>",
    )

    # Get payment history
    history = payments.get_payment_history("agent_abc123")
    for p in history:
        print(p.amount, p.status, p.created_at)
"""

import httpx
from typing import Optional, List

from .spending import SpendingResult, SpendingError

BASE_URL = "https://www.getagentid.dev/api/v1"

# Supported chains for payments
SUPPORTED_CHAINS = ("solana", "ethereum", "polygon")


class PaymentIntent:
    """Represents an authorized (or denied) payment intent."""

    def __init__(self, data: dict):
        self._data = data
        for k, v in data.items():
            setattr(self, k, v)

    def __repr__(self):
        return f"PaymentIntent({self._data})"

    def __getattr__(self, name):
        return None

    @property
    def is_authorized(self) -> bool:
        return self._data.get("status") == "authorized"

    @property
    def is_pending_approval(self) -> bool:
        return self._data.get("status") == "pending_approval"

    @property
    def is_cooling(self) -> bool:
        return self._data.get("status") == "cooling"


class PaymentRecord:
    """A completed or pending payment record."""

    def __init__(self, data: dict):
        self._data = data
        for k, v in data.items():
            setattr(self, k, v)

    def __repr__(self):
        return f"PaymentRecord({self._data})"

    def __getattr__(self, name):
        return None


class AllowlistEntry:
    """A wallet on the owner's payment allowlist."""

    def __init__(self, data: dict):
        self._data = data
        for k, v in data.items():
            setattr(self, k, v)

    def __repr__(self):
        return f"AllowlistEntry({self._data})"

    def __getattr__(self, name):
        return None


class PaymentSettings:
    """Current payment security settings for the owner."""

    def __init__(self, data: dict):
        self._data = data
        self.allowlist = [
            AllowlistEntry(w)
            for w in data.get("allowlist", {}).get("wallets", [])
        ]
        self.frozen_agents = data.get("frozen_agents", {}).get("agent_ids", [])
        self.pending_approvals = [
            PaymentRecord(p)
            for p in data.get("pending_approvals", {}).get("payments", [])
        ]

    def __repr__(self):
        return (
            f"PaymentSettings(allowlist={len(self.allowlist)}, "
            f"frozen={len(self.frozen_agents)}, "
            f"pending={len(self.pending_approvals)})"
        )


class PaymentClient:
    """Client for the AgentID crypto payment API.

    Supports both agent-to-agent and agent-to-human payments with full
    security controls.

    Args:
        api_key: Your AgentID API key (agentid_sk_...).
        base_url: Override the API base URL (defaults to production).
    """

    def __init__(self, api_key: str, base_url: str = None):
        if not api_key:
            raise ValueError("api_key is required")
        self._api_key = api_key
        self._base_url = base_url or BASE_URL

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._api_key}"}

    def _post(self, path: str, data: dict) -> dict:
        res = httpx.post(
            f"{self._base_url}{path}",
            json=data,
            headers=self._headers(),
            timeout=15,
            follow_redirects=True,
        )
        body = res.json()
        if res.status_code >= 400:
            error = body.get("error") or body.get("reason") or "Unknown error"
            raise PaymentError(error, status_code=res.status_code, response=body)
        return body

    def _get(self, path: str, params: dict = None) -> dict:
        res = httpx.get(
            f"{self._base_url}{path}",
            params=params,
            headers=self._headers(),
            timeout=15,
            follow_redirects=True,
        )
        body = res.json()
        if res.status_code >= 400:
            error = body.get("error") or body.get("reason") or "Unknown error"
            raise PaymentError(error, status_code=res.status_code, response=body)
        return body

    # ── Agent-to-Agent Payments ───────────────────────────────────────────────

    def create_payment_intent(
        self,
        from_agent_id: str,
        to_agent_id: str,
        amount_usd: float,
        chain: str = "solana",
    ) -> PaymentIntent:
        """Create a payment intent — checks trust level spending authority first.

        Verifies both agents exist and are registered with AgentID, checks the
        sender's trust level against daily spending limits, and creates an
        off-chain payment intent record.

        Args:
            from_agent_id: The sending agent's unique identifier.
            to_agent_id: The receiving agent's unique identifier.
            amount_usd: The amount to pay in USD (positive number).
            chain: Blockchain to use ("solana", "ethereum", "polygon"). Default "solana".

        Returns:
            PaymentIntent with: payment_id, from_agent_id, to_agent_id, amount,
            chain, status ("authorized" or "denied"), reason (if denied),
            trust_level, remaining_daily_limit, created_at.

        Raises:
            PaymentError: If the API returns an error.
        """
        if chain not in SUPPORTED_CHAINS:
            raise PaymentError(
                f'Unsupported chain "{chain}". Supported: {", ".join(SUPPORTED_CHAINS)}',
                status_code=400,
            )

        if amount_usd <= 0:
            raise PaymentError("Amount must be greater than zero", status_code=400)

        if from_agent_id == to_agent_id:
            raise PaymentError("Cannot pay yourself", status_code=400)

        res = self._post("/agents/pay", {
            "from_agent_id": from_agent_id,
            "to_agent_id": to_agent_id,
            "amount": amount_usd,
            "currency": "usd",
            "chain": chain,
        })
        return PaymentIntent(res)

    # ── Agent-to-Human Payments ───────────────────────────────────────────────

    def pay_human(
        self,
        from_agent_id: str,
        to_wallet: str,
        amount_usd: float,
        chain: str = "solana",
        currency: str = "usd",
    ) -> PaymentIntent:
        """Pay a human wallet address from an agent.

        The destination wallet MUST be on the owner's allowlist. Additional
        security checks apply:
        - 24-hour cooling period on first payment to a new wallet
        - Duplicate detection (same amount + wallet within 10 min)
        - Per-recipient daily limit ($50/day for L3, $1000/day for L4)
        - Large payments require owner dual-approval

        Args:
            from_agent_id: The sending agent's unique identifier.
            to_wallet: The destination wallet address (must be allowlisted).
            amount_usd: The amount to pay in USD (positive number).
            chain: Blockchain to use ("solana", "ethereum", "polygon"). Default "solana".
            currency: Currency code. Default "usd".

        Returns:
            PaymentIntent with status:
            - "authorized": Payment approved and ready for execution.
            - "pending_approval": Large payment — owner must approve within 1 hour.
            - "cooling": First payment to new wallet — 24-hour cooling period.

        Raises:
            PaymentError: If the wallet is not allowlisted, agent is frozen,
            duplicate detected, limits exceeded, etc.
        """
        if chain not in SUPPORTED_CHAINS:
            raise PaymentError(
                f'Unsupported chain "{chain}". Supported: {", ".join(SUPPORTED_CHAINS)}',
                status_code=400,
            )

        if amount_usd <= 0:
            raise PaymentError("Amount must be greater than zero", status_code=400)

        if not to_wallet or not to_wallet.strip():
            raise PaymentError("to_wallet is required", status_code=400)

        res = self._post("/agents/pay", {
            "from_agent_id": from_agent_id,
            "to_wallet": to_wallet.strip(),
            "amount": amount_usd,
            "currency": currency,
            "chain": chain,
        })
        return PaymentIntent(res)

    # ── Execute Payment ───────────────────────────────────────────────────────

    def execute_payment(
        self,
        payment_intent_id: str,
        signed_transaction: str,
    ) -> PaymentRecord:
        """Execute a payment after the sending agent signs the transaction.

        Submits the signed on-chain transaction for a previously authorized
        payment intent. The system verifies the intent is still valid, then
        records the execution.

        Works for both agent-to-agent and agent-to-human payments.

        Note: This records the signed transaction reference against the payment
        intent. The actual on-chain submission and confirmation is handled by
        the caller or a separate relay service.

        Args:
            payment_intent_id: The payment intent ID returned by
                create_payment_intent() or pay_human().
            signed_transaction: The hex-encoded signed transaction from the
                agent's wallet.

        Returns:
            PaymentRecord with: payment_id, status ("executed"),
            signed_transaction, receipt, executed_at.

        Raises:
            PaymentError: If the intent is expired, already executed, or invalid.
        """
        if not payment_intent_id:
            raise PaymentError("payment_intent_id is required", status_code=400)
        if not signed_transaction:
            raise PaymentError("signed_transaction is required", status_code=400)

        res = self._post("/agents/pay", {
            "action": "execute",
            "payment_id": payment_intent_id,
            "signed_transaction": signed_transaction,
        })
        return PaymentRecord(res)

    # ── Payment History ───────────────────────────────────────────────────────

    def get_payment_history(
        self,
        agent_id: str,
        days: int = 30,
        direction: str = "all",
    ) -> List[PaymentRecord]:
        """Get payment history for an agent.

        Returns both agent-to-agent and agent-to-human payments.

        Args:
            agent_id: The agent's unique identifier.
            days: Number of days of history to retrieve (1-365, default 30).
            direction: Filter by direction — "sent", "received", or "all" (default).

        Returns:
            List of PaymentRecord objects, each with payment_id, from_agent_id,
            to_agent_id or to_wallet, amount, chain, status, trust_level,
            created_at, receipt.
        """
        params = {
            "agent_id": agent_id,
            "days": str(days),
        }
        if direction in ("sent", "received"):
            params["direction"] = direction

        res = self._get("/agents/pay", params=params)
        return [PaymentRecord(p) for p in res.get("payments", [])]

    # ── Allowlist Management ──────────────────────────────────────────────────

    def add_to_allowlist(
        self,
        wallet_address: str,
        chain: str,
        label: str = "",
    ) -> dict:
        """Add a wallet address to the payment allowlist.

        Agents can only pay wallets that are on the owner's allowlist. The
        wallet address format is validated against the specified chain.

        Args:
            wallet_address: The wallet address to allowlist.
            chain: The blockchain ("solana", "ethereum", "polygon").
            label: A human-readable label for this wallet (e.g., "Freelancer - Alice").

        Returns:
            Dict with success status and confirmation message.

        Raises:
            PaymentError: If the address format is invalid or already on the list.
        """
        return self._post("/agents/payment-settings", {
            "action": "add_allowlist",
            "wallet_address": wallet_address.strip(),
            "chain": chain,
            "label": label,
        })

    def remove_from_allowlist(self, wallet_address: str) -> dict:
        """Remove a wallet address from the payment allowlist.

        After removal, agents can no longer pay this wallet.

        Args:
            wallet_address: The wallet address to remove.

        Returns:
            Dict with success status and confirmation message.
        """
        return self._post("/agents/payment-settings", {
            "action": "remove_allowlist",
            "wallet_address": wallet_address.strip(),
        })

    def get_allowlist(self) -> List[AllowlistEntry]:
        """Get all wallets on the owner's payment allowlist.

        Returns:
            List of AllowlistEntry objects with wallet_address, chain, label,
            created_at.
        """
        settings = self.get_payment_settings()
        return settings.allowlist

    # ── Freeze / Unfreeze ─────────────────────────────────────────────────────

    def freeze_agent(self, agent_id: str) -> dict:
        """Freeze all payments for an agent. Immediate kill-switch.

        When frozen, the agent cannot create or execute any payments (both
        agent-to-agent and agent-to-human).

        Args:
            agent_id: The agent to freeze.

        Returns:
            Dict with success status and confirmation message.

        Raises:
            PaymentError: If the agent is not found or not owned by the caller.
        """
        return self._post("/agents/payment-settings", {
            "action": "freeze",
            "agent_id": agent_id,
        })

    def unfreeze_agent(self, agent_id: str) -> dict:
        """Unfreeze payments for an agent.

        Args:
            agent_id: The agent to unfreeze.

        Returns:
            Dict with success status and confirmation message.
        """
        return self._post("/agents/payment-settings", {
            "action": "unfreeze",
            "agent_id": agent_id,
        })

    # ── Approval Management ───────────────────────────────────────────────────

    def approve_payment(self, payment_id: str) -> dict:
        """Approve a payment that requires dual-approval.

        Large payments (over $50 for L3, over $5000 for L4) require explicit
        owner approval before they can be executed.

        Args:
            payment_id: The payment ID to approve.

        Returns:
            Dict with success status and confirmation message.

        Raises:
            PaymentError: If the payment is not found, not pending, or expired.
        """
        return self._post("/agents/payment-settings", {
            "action": "approve_payment",
            "payment_id": payment_id,
        })

    def deny_payment(self, payment_id: str) -> dict:
        """Deny a payment that requires dual-approval.

        Args:
            payment_id: The payment ID to deny.

        Returns:
            Dict with success status and confirmation message.
        """
        return self._post("/agents/payment-settings", {
            "action": "deny_payment",
            "payment_id": payment_id,
        })

    def get_pending_approvals(self) -> List[PaymentRecord]:
        """Get all payments waiting for owner approval.

        Returns:
            List of PaymentRecord objects with pending_approval status.
        """
        settings = self.get_payment_settings()
        return settings.pending_approvals

    # ── Payment Settings ──────────────────────────────────────────────────────

    def get_payment_settings(self) -> PaymentSettings:
        """Get all payment security settings.

        Returns:
            PaymentSettings with allowlist, frozen_agents, pending_approvals.
        """
        res = self._get("/agents/payment-settings")
        return PaymentSettings(res)


class PaymentError(Exception):
    """Raised when the payment API returns an error."""

    def __init__(self, message: str, status_code: int = None, response: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response or {}
