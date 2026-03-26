"""AgentID challenge-response verification.

Proves an agent holds its Ed25519 private key RIGHT NOW by signing a
server-issued challenge.  This is stronger than certificate verification
alone, which only proves a key was bound at some point in the past.

Flow:
    1. request_challenge(client, agent_id) -> { challenge, expires_at }
    2. Sign the challenge bytes with the agent's Ed25519 private key
    3. respond_to_challenge(client, agent_id, challenge, private_key) -> { verified, challenge_passed, ... }
"""

from .client import Client
from .ed25519 import Ed25519Identity


def request_challenge(client: Client, agent_id: str) -> dict:
    """Request a challenge from the AgentID server.

    Args:
        client:   An authenticated agentid.Client instance.
        agent_id: The agent's unique identifier.

    Returns:
        Dict with 'challenge' (64-char hex) and 'expires_at' (ISO 8601).
        The challenge expires after 60 seconds.
    """
    return client._post("/agents/challenge", {"agent_id": agent_id})


def respond_to_challenge(
    client: Client,
    agent_id: str,
    challenge: str,
    private_key: Ed25519Identity,
) -> dict:
    """Sign the challenge and submit the proof to the AgentID server.

    Args:
        client:      An authenticated agentid.Client instance.
        agent_id:    The agent's unique identifier.
        challenge:   The 64-char hex challenge string from request_challenge().
        private_key: An Ed25519Identity holding the agent's private key.

    Returns:
        Dict with 'verified' (bool), 'challenge_passed' (bool), and 'message'.
    """
    # Sign the raw challenge bytes (32 bytes from hex)
    challenge_bytes = bytes.fromhex(challenge)
    signature = private_key.sign(challenge_bytes)

    return client._post("/agents/challenge/verify", {
        "agent_id": agent_id,
        "challenge": challenge,
        "signature": signature.hex(),
    })
