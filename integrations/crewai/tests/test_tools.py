"""Unit tests for AgentID CrewAI tools.

These tests verify tool construction, input validation, and the HTTP calls
made to the AgentID API (mocked via ``httpx``).
"""

from __future__ import annotations

import json
import os
from unittest.mock import patch, MagicMock

import pytest

from agentid_crewai.tools import (
    AgentIDRegisterTool,
    AgentIDVerifyTool,
    AgentIDDiscoverTool,
    AgentIDConnectTool,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _set_api_key(monkeypatch):
    """Ensure every test has a valid API key in the environment."""
    monkeypatch.setenv("AGENTID_API_KEY", "agentid_sk_test_key_123")


def _mock_response(data: dict, status_code: int = 200):
    """Return a fake httpx.Response-like object."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = data
    return resp


# ---------------------------------------------------------------------------
# Register Tool
# ---------------------------------------------------------------------------

class TestRegisterTool:
    def test_metadata(self):
        tool = AgentIDRegisterTool()
        assert tool.name == "agentid_register"
        assert "register" in tool.description.lower()

    @patch("agentid_crewai.client.httpx.post")
    def test_register_success(self, mock_post):
        mock_post.return_value = _mock_response({
            "agent_id": "agent_abc123",
            "name": "TestBot",
            "owner": "TestCo",
            "certificate": "eyJ...",
            "public_key": "-----BEGIN PUBLIC KEY-----\n...",
            "private_key": "-----BEGIN PRIVATE KEY-----\n...",
            "issued_at": "2026-03-22T00:00:00Z",
            "expires_at": "2027-03-22T00:00:00Z",
        }, status_code=201)

        tool = AgentIDRegisterTool()
        result = tool._run(name="TestBot", description="A test bot")
        data = json.loads(result)

        assert data["agent_id"] == "agent_abc123"
        assert data["name"] == "TestBot"
        mock_post.assert_called_once()

    @patch("agentid_crewai.client.httpx.post")
    def test_register_api_error(self, mock_post):
        mock_post.return_value = _mock_response(
            {"error": "Agent limit reached"}, status_code=403
        )

        tool = AgentIDRegisterTool()
        result = tool._run(name="TestBot")
        assert "Error" in result
        assert "Agent limit reached" in result


# ---------------------------------------------------------------------------
# Verify Tool
# ---------------------------------------------------------------------------

class TestVerifyTool:
    def test_metadata(self):
        tool = AgentIDVerifyTool()
        assert tool.name == "agentid_verify"

    @patch("agentid_crewai.client.httpx.post")
    def test_verify_success(self, mock_post):
        mock_post.return_value = _mock_response({
            "verified": True,
            "agent_id": "agent_abc123",
            "name": "TestBot",
            "owner": "TestCo",
            "trust_score": 85,
            "certificate_valid": True,
            "active": True,
            "message": "Agent verified",
        })

        tool = AgentIDVerifyTool()
        result = tool._run(agent_id="agent_abc123")
        data = json.loads(result)

        assert data["verified"] is True
        assert data["trust_score"] == 85

    @patch("agentid_crewai.client.httpx.post")
    def test_verify_not_found(self, mock_post):
        mock_post.return_value = _mock_response({
            "verified": False,
            "agent_id": "agent_unknown",
            "message": "Agent not found",
        })

        tool = AgentIDVerifyTool()
        result = tool._run(agent_id="agent_unknown")
        data = json.loads(result)

        assert data["verified"] is False


# ---------------------------------------------------------------------------
# Discover Tool
# ---------------------------------------------------------------------------

class TestDiscoverTool:
    def test_metadata(self):
        tool = AgentIDDiscoverTool()
        assert tool.name == "agentid_discover"

    @patch("agentid_crewai.client.httpx.get")
    def test_discover_by_capability(self, mock_get):
        mock_get.return_value = _mock_response({
            "agents": [
                {"agent_id": "agent_1", "name": "Summarizer", "capabilities": ["summarization"]},
                {"agent_id": "agent_2", "name": "Translator", "capabilities": ["summarization", "translation"]},
            ],
            "count": 2,
        })

        tool = AgentIDDiscoverTool()
        result = tool._run(capability="summarization")
        data = json.loads(result)

        assert data["count"] == 2
        assert len(data["agents"]) == 2

    @patch("agentid_crewai.client.httpx.get")
    def test_discover_empty(self, mock_get):
        mock_get.return_value = _mock_response({"agents": [], "count": 0})

        tool = AgentIDDiscoverTool()
        result = tool._run(capability="nonexistent")
        data = json.loads(result)

        assert data["count"] == 0
        assert data["agents"] == []


# ---------------------------------------------------------------------------
# Connect Tool
# ---------------------------------------------------------------------------

class TestConnectTool:
    def test_metadata(self):
        tool = AgentIDConnectTool()
        assert tool.name == "agentid_connect"

    @patch("agentid_crewai.client.httpx.post")
    def test_connect_success(self, mock_post):
        mock_post.return_value = _mock_response({
            "message_id": 42,
            "status": "pending",
            "sender": {"agent_id": "agent_a", "name": "Sender", "verified": True},
            "receiver": {"agent_id": "agent_b", "name": "Receiver", "verified": True},
            "trust_check": {
                "both_verified": True,
                "sender_verified": True,
                "receiver_verified": True,
                "recommendation": "TRUSTED",
            },
        }, status_code=201)

        tool = AgentIDConnectTool()
        result = tool._run(
            from_agent="agent_a",
            to_agent="agent_b",
            payload={"task": "summarize", "text": "Hello world"},
        )
        data = json.loads(result)

        assert data["message_id"] == 42
        assert data["trust_check"]["both_verified"] is True

    @patch("agentid_crewai.client.httpx.post")
    def test_connect_forbidden(self, mock_post):
        mock_post.return_value = _mock_response(
            {"error": "You do not own the sending agent"}, status_code=403
        )

        tool = AgentIDConnectTool()
        result = tool._run(
            from_agent="agent_other",
            to_agent="agent_b",
            payload={"task": "test"},
        )
        assert "Error" in result


# ---------------------------------------------------------------------------
# API key resolution
# ---------------------------------------------------------------------------

class TestAPIKeyResolution:
    def test_missing_api_key_raises(self, monkeypatch):
        monkeypatch.delenv("AGENTID_API_KEY", raising=False)
        tool = AgentIDRegisterTool()
        result = tool._run(name="TestBot")
        assert "API key is required" in result

    def test_explicit_api_key_overrides_env(self, monkeypatch):
        monkeypatch.setenv("AGENTID_API_KEY", "env_key")
        tool = AgentIDRegisterTool(api_key="explicit_key")
        # We can't easily test the header without a deeper mock, but
        # we verify the tool accepts the parameter without error.
        assert tool.api_key == "explicit_key"
