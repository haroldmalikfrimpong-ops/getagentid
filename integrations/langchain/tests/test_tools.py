"""Unit tests for AgentID LangChain tools.

Tests use respx to mock HTTP calls so no real API requests are made.
"""

from __future__ import annotations

import json
import pytest
import respx
import httpx

from agentid_langchain import (
    AgentIDRegisterTool,
    AgentIDVerifyTool,
    AgentIDDiscoverTool,
    AgentIDConnectTool,
    AgentIDToolkit,
)

BASE = "https://getagentid.dev/api/v1"


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

class TestRegisterTool:
    def test_schema(self):
        tool = AgentIDRegisterTool(api_key="sk_test")
        assert tool.name == "agentid_register"
        schema = tool.args_schema.model_json_schema()
        assert "name" in schema["properties"]
        assert "capabilities" in schema["properties"]

    @respx.mock
    def test_run_success(self):
        mock_response = {
            "agent_id": "agid_abc123",
            "name": "TestBot",
            "owner": "Acme",
            "certificate": "eyJ...",
            "public_key": "-----BEGIN PUBLIC KEY-----...",
            "private_key": "-----BEGIN PRIVATE KEY-----...",
            "issued_at": "2026-01-01T00:00:00Z",
            "expires_at": "2027-01-01T00:00:00Z",
        }
        respx.post(f"{BASE}/agents/register").mock(
            return_value=httpx.Response(201, json=mock_response)
        )

        tool = AgentIDRegisterTool(api_key="sk_test", base_url=BASE)
        result = json.loads(tool.run({"name": "TestBot", "capabilities": ["search"]}))
        assert result["agent_id"] == "agid_abc123"
        assert result["name"] == "TestBot"

    @respx.mock
    def test_run_error(self):
        respx.post(f"{BASE}/agents/register").mock(
            return_value=httpx.Response(403, json={"error": "Agent limit reached"})
        )
        tool = AgentIDRegisterTool(api_key="sk_test", base_url=BASE)
        with pytest.raises(RuntimeError, match="Agent limit reached"):
            tool.run({"name": "TestBot"})


# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------

class TestVerifyTool:
    def test_schema(self):
        tool = AgentIDVerifyTool()
        assert tool.name == "agentid_verify"
        schema = tool.args_schema.model_json_schema()
        assert "agent_id" in schema["properties"]

    @respx.mock
    def test_run_verified(self):
        mock_response = {
            "verified": True,
            "agent_id": "agid_abc123",
            "name": "TestBot",
            "trust_score": 85,
            "certificate_valid": True,
            "active": True,
            "message": "Agent verified",
        }
        respx.post(f"{BASE}/agents/verify").mock(
            return_value=httpx.Response(200, json=mock_response)
        )
        tool = AgentIDVerifyTool(base_url=BASE)
        result = json.loads(tool.run({"agent_id": "agid_abc123"}))
        assert result["verified"] is True
        assert result["trust_score"] == 85

    @respx.mock
    def test_run_not_found(self):
        mock_response = {
            "verified": False,
            "agent_id": "agid_fake",
            "message": "Agent not found",
        }
        respx.post(f"{BASE}/agents/verify").mock(
            return_value=httpx.Response(200, json=mock_response)
        )
        tool = AgentIDVerifyTool(base_url=BASE)
        result = json.loads(tool.run({"agent_id": "agid_fake"}))
        assert result["verified"] is False


# ---------------------------------------------------------------------------
# Discover
# ---------------------------------------------------------------------------

class TestDiscoverTool:
    def test_schema(self):
        tool = AgentIDDiscoverTool()
        assert tool.name == "agentid_discover"

    @respx.mock
    def test_run_with_capability(self):
        mock_response = {
            "agents": [
                {"agent_id": "agid_1", "name": "SearchBot", "capabilities": ["search"], "trust_score": 90},
                {"agent_id": "agid_2", "name": "FinderBot", "capabilities": ["search"], "trust_score": 70},
            ],
            "count": 2,
        }
        respx.get(f"{BASE}/agents/discover").mock(
            return_value=httpx.Response(200, json=mock_response)
        )
        tool = AgentIDDiscoverTool(base_url=BASE)
        result = json.loads(tool.run({"capability": "search"}))
        assert result["count"] == 2
        assert len(result["agents"]) == 2

    @respx.mock
    def test_run_empty(self):
        respx.get(f"{BASE}/agents/discover").mock(
            return_value=httpx.Response(200, json={"agents": [], "count": 0})
        )
        tool = AgentIDDiscoverTool(base_url=BASE)
        result = json.loads(tool.run({}))
        assert result["count"] == 0


# ---------------------------------------------------------------------------
# Connect
# ---------------------------------------------------------------------------

class TestConnectTool:
    def test_schema(self):
        tool = AgentIDConnectTool(api_key="sk_test")
        assert tool.name == "agentid_connect"
        schema = tool.args_schema.model_json_schema()
        assert "from_agent" in schema["properties"]
        assert "to_agent" in schema["properties"]
        assert "payload" in schema["properties"]

    @respx.mock
    def test_run_success(self):
        mock_response = {
            "message_id": 42,
            "status": "pending",
            "sender": {"agent_id": "agid_a", "name": "AlphaBot", "verified": True},
            "receiver": {"agent_id": "agid_b", "name": "BetaBot", "verified": True},
            "trust_check": {
                "both_verified": True,
                "sender_verified": True,
                "receiver_verified": True,
                "recommendation": "TRUSTED — both agents verified. Safe to exchange data.",
            },
        }
        respx.post(f"{BASE}/agents/connect").mock(
            return_value=httpx.Response(201, json=mock_response)
        )
        tool = AgentIDConnectTool(api_key="sk_test", base_url=BASE)
        result = json.loads(tool.run({
            "from_agent": "agid_a",
            "to_agent": "agid_b",
            "payload": {"task": "summarize", "text": "Hello world"},
        }))
        assert result["trust_check"]["both_verified"] is True
        assert result["message_id"] == 42


# ---------------------------------------------------------------------------
# Toolkit
# ---------------------------------------------------------------------------

class TestToolkit:
    def test_with_api_key(self):
        toolkit = AgentIDToolkit(api_key="sk_test")
        tools = toolkit.get_tools()
        names = {t.name for t in tools}
        assert names == {"agentid_verify", "agentid_discover", "agentid_register", "agentid_connect"}

    def test_without_api_key(self):
        toolkit = AgentIDToolkit()
        tools = toolkit.get_tools()
        names = {t.name for t in tools}
        assert names == {"agentid_verify", "agentid_discover"}
        # Authenticated tools should not be present
        assert "agentid_register" not in names
        assert "agentid_connect" not in names
