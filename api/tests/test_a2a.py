"""Tests for the enhanced A2A agent card endpoint."""

import pytest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

MOCK_AGENT_L3 = {
    "agent_id": "test-agent-001",
    "name": "Agent Laplace",
    "description": "Autonomous crypto intelligence agent",
    "owner": "laplace0x",
    "capabilities": ["market-analysis", "trading", "on-chain-investigation", "a2a-protocol"],
    "platform": "multi-chain",
    "endpoint": "https://laplace.example.com/a2a",
    "trust_score": 0.87,
    "trust_level": 3,
    "context_continuity_score": 0.92,
    "scarring_score": 0.05,
    "ed25519_key": "abc123deadbeef",
    "wallet_bindings": [
        {"chain": "ethereum", "chain_id": 1, "address": "0x036bE0c34dDd8B491c04F27bAd44bD8510e991f9"},
        {"chain": "base", "chain_id": 8453, "address": "0x036bE0c34dDd8B491c04F27bAd44bD8510e991f9"},
    ],
    "reputation_tradingYield": 0.15,
    "reputation_successRate": 0.68,
    "verified": True,
    "created_at": "2026-03-30T00:00:00Z",
}

MOCK_AGENT_L1 = {
    "agent_id": "test-agent-002",
    "name": "Basic Bot",
    "description": "A simple registered agent",
    "owner": "someone",
    "capabilities": ["chat"],
    "trust_score": 0.1,
    "trust_level": 1,
    "verified": True,
    "created_at": "2026-04-01T00:00:00Z",
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestAgentCardGeneration:
    """Test the /agent/{id}/agent-card.json endpoint."""

    def test_card_has_required_a2a_fields(self):
        """Agent card MUST contain all required A2A fields."""
        from api.src.routes.a2a import _map_capabilities_to_skills, _build_agentid_extension, _build_auth_schemes

        skills = _map_capabilities_to_skills(MOCK_AGENT_L3["capabilities"])
        ext = _build_agentid_extension(MOCK_AGENT_L3, "test-agent-001")
        auth = _build_auth_schemes(MOCK_AGENT_L3)

        # Skills should map all 4 capabilities
        assert len(skills) == 4
        skill_ids = [s["id"] for s in skills]
        assert "market-analysis" in skill_ids
        assert "trading" in skill_ids

        # Each cataloged skill should have inputModes and outputModes
        for skill in skills:
            assert "inputModes" in skill
            assert "outputModes" in skill

    def test_trust_extension_includes_level_and_score(self):
        """Extension must include trust_level, trust_level_name, and trust_score."""
        from api.src.routes.a2a import _build_agentid_extension

        ext = _build_agentid_extension(MOCK_AGENT_L3, "test-agent-001")

        config = ext["config"]
        assert config["trust_level"] == 3
        assert config["trust_level_name"] == "SECURED"
        assert config["trust_score"] == 0.87
        assert config["context_continuity_score"] == 0.92
        assert config["scarring_score"] == 0.05

    def test_erc8004_reputation_tags_surfaced(self):
        """ERC-8004 reputation tags should appear in the extension."""
        from api.src.routes.a2a import _build_agentid_extension

        ext = _build_agentid_extension(MOCK_AGENT_L3, "test-agent-001")
        rep = ext["config"]["erc8004_reputation"]

        assert rep["tradingYield"] == 0.15
        assert rep["successRate"] == 0.68

    def test_wallet_bindings_included(self):
        """Wallet bindings should appear in the extension for L3+ agents."""
        from api.src.routes.a2a import _build_agentid_extension

        ext = _build_agentid_extension(MOCK_AGENT_L3, "test-agent-001")
        wallets = ext["config"]["wallet_bindings"]

        assert len(wallets) == 2
        assert wallets[0]["chain"] == "ethereum"

    def test_ed25519_auth_scheme_for_l2_plus(self):
        """L2+ agents with ed25519_key should get challenge-response auth."""
        from api.src.routes.a2a import _build_auth_schemes

        schemes = _build_auth_schemes(MOCK_AGENT_L3)

        assert len(schemes) == 2
        assert schemes[0]["scheme"] == "apiKey"
        assert schemes[1]["scheme"] == "ed25519-challenge"
        assert "challengeEndpoint" in schemes[1]

    def test_l1_agent_no_ed25519_auth(self):
        """L1 agents without ed25519_key should only get apiKey auth."""
        from api.src.routes.a2a import _build_auth_schemes

        schemes = _build_auth_schemes(MOCK_AGENT_L1)

        assert len(schemes) == 1
        assert schemes[0]["scheme"] == "apiKey"

    def test_unknown_capability_gets_generic_skill(self):
        """Capabilities not in the catalog should still map to a skill."""
        from api.src.routes.a2a import _map_capabilities_to_skills

        skills = _map_capabilities_to_skills(["quantum-entanglement-analysis"])

        assert len(skills) == 1
        assert skills[0]["id"] == "quantum-entanglement-analysis"
        assert skills[0]["inputModes"] == ["text"]

    def test_no_reputation_tags_omits_section(self):
        """Agents without reputation data should not have erc8004_reputation."""
        from api.src.routes.a2a import _build_agentid_extension

        ext = _build_agentid_extension(MOCK_AGENT_L1, "test-agent-002")

        assert "erc8004_reputation" not in ext["config"]

    def test_none_values_stripped(self):
        """None values should be stripped from the extension config."""
        from api.src.routes.a2a import _build_agentid_extension

        ext = _build_agentid_extension(MOCK_AGENT_L1, "test-agent-002")

        for v in ext["config"].values():
            assert v is not None
