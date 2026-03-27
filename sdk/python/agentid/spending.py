"""AgentID Spending Authority Client.

Authorization layer for agent spending. The agent's owner pre-funds and sets
limits via the AgentID dashboard; this client gates whether a specific agent
is allowed to spend a given amount, records transactions, and retrieves history.

Usage:
    import agentid
    from agentid.spending import SpendingClient

    spending = SpendingClient(api_key="agentid_sk_...")

    # Check if agent can spend $25
    auth = spending.check_spending_authority("agent_abc123", 25.00, "usd")
    print(auth.authorized, auth.remaining_daily_limit)

    # Record a spend
    receipt = spending.record_spend(
        "agent_abc123", 25.00, "usd",
        description="Purchase API credits",
        recipient="vendor_xyz",
    )
    print(receipt.transaction_id, receipt.receipt)

    # Get history
    history = spending.get_spending_history("agent_abc123", days=7)
    for txn in history:
        print(txn.amount, txn.recipient, txn.created_at)

    # Check remaining budget
    remaining = spending.get_daily_remaining("agent_abc123")
    print(f"${remaining} left today")
"""

import httpx
from typing import Optional, List

BASE_URL = "https://www.getagentid.dev/api/v1"


class SpendingResult:
    """Generic result wrapper that exposes dict keys as attributes."""

    def __init__(self, data: dict):
        self._data = data
        for k, v in data.items():
            setattr(self, k, v)

    def __repr__(self):
        return f"SpendingResult({self._data})"

    def __getattr__(self, name):
        # Return None instead of raising for missing keys
        return None


class SpendingClient:
    """Client for the AgentID spending authority API.

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
            raise SpendingError(error, status_code=res.status_code, response=body)
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
            raise SpendingError(error, status_code=res.status_code, response=body)
        return body

    def check_spending_authority(
        self,
        agent_id: str,
        amount: float,
        currency: str = "usd",
    ) -> SpendingResult:
        """Check whether an agent is authorized to spend a given amount.

        Does NOT record the spend. Use record_spend() to actually execute.

        Args:
            agent_id: The agent's unique identifier.
            amount: The amount to check (positive number).
            currency: Currency code (e.g. "usd").

        Returns:
            SpendingResult with authorized (bool), trust_level, daily_limit,
            spent_today, remaining_daily_limit. If not authorized, includes reason.

        Raises:
            SpendingError: If the API returns an error (agent not found, not owned, etc.).
        """
        # We use the spend endpoint's validation by posting a dry-run-like check.
        # Since we don't have a dedicated check endpoint, we call spending-history
        # to get the balance and do the math client-side.
        res = self._get("/agents/spending-history", params={
            "agent_id": agent_id,
            "days": "1",
        })
        balance = res.get("balance") or {}
        daily_limit = balance.get("daily_limit", 0)
        spent_today = balance.get("spent_today", 0)
        remaining = balance.get("remaining_daily_limit", 0)
        trust_level = balance.get("trust_level", 1)

        authorized = amount > 0 and amount <= remaining and trust_level >= 3
        reason = None
        if not authorized:
            if trust_level < 3:
                reason = f"Trust level L{trust_level} is insufficient. Spending requires L3 or higher."
            elif amount > remaining:
                reason = (
                    f"Exceeds daily spending limit. "
                    f"Limit: ${daily_limit}, spent today: ${spent_today:.2f}, "
                    f"remaining: ${remaining:.2f}, requested: ${amount:.2f}"
                )
            elif amount <= 0:
                reason = "Amount must be greater than zero"

        return SpendingResult({
            "authorized": authorized,
            "reason": reason,
            "trust_level": trust_level,
            "daily_limit": daily_limit,
            "spent_today": spent_today,
            "remaining_daily_limit": remaining,
        })

    def record_spend(
        self,
        agent_id: str,
        amount: float,
        currency: str,
        description: str,
        recipient: str,
    ) -> SpendingResult:
        """Record a spend transaction for an agent.

        The server validates trust level and daily limits before recording.

        Args:
            agent_id: The agent's unique identifier.
            amount: The amount to spend (positive number).
            currency: Currency code (e.g. "usd").
            description: Human-readable description of the spend.
            recipient: Who receives the payment.

        Returns:
            SpendingResult with authorized, transaction_id, amount, currency,
            description, recipient, trust_level, remaining_daily_limit,
            receipt (ECDSA-signed), and created_at.

        Raises:
            SpendingError: If the spend is not authorized or fails.
        """
        res = self._post("/agents/spend", {
            "agent_id": agent_id,
            "amount": amount,
            "currency": currency,
            "description": description,
            "recipient": recipient,
        })
        return SpendingResult(res)

    def get_spending_history(
        self,
        agent_id: str,
        days: int = 30,
    ) -> List[SpendingResult]:
        """Get spending history for an agent.

        Args:
            agent_id: The agent's unique identifier.
            days: Number of days of history to retrieve (1-365, default 30).

        Returns:
            List of SpendingResult objects, each with transaction_id, amount,
            currency, description, recipient, trust_level, created_at, receipt.
        """
        res = self._get("/agents/spending-history", params={
            "agent_id": agent_id,
            "days": str(days),
        })
        return [SpendingResult(txn) for txn in res.get("transactions", [])]

    def get_daily_remaining(self, agent_id: str) -> float:
        """Get the remaining daily spending budget for an agent.

        Convenience method that returns a single number.

        Args:
            agent_id: The agent's unique identifier.

        Returns:
            The remaining daily spending limit in USD.
        """
        res = self._get("/agents/spending-history", params={
            "agent_id": agent_id,
            "days": "1",
        })
        balance = res.get("balance") or {}
        return float(balance.get("remaining_daily_limit", 0))


class SpendingError(Exception):
    """Raised when the spending API returns an error."""

    def __init__(self, message: str, status_code: int = None, response: dict = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response or {}
