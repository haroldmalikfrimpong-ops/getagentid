"""Tests for the APS bridge module."""

import json
import time

import pytest
from nacl.encoding import Base64Encoder
from nacl.signing import SigningKey

from agentid.aps_bridge import (
    AgentIDPassportBridge,
    create_aps_metadata,
    create_delegation_request,
    from_aps_did,
    to_aps_did,
    verify_aps_passport,
)


# ── DID conversion ──────────────────────────────────────────────────────────


class TestToApsDid:
    def test_basic(self):
        assert to_aps_did("abc-123") == "did:agentid:abc-123"

    def test_alphanumeric(self):
        assert to_aps_did("agent_42") == "did:agentid:agent_42"

    def test_empty_raises(self):
        with pytest.raises(ValueError, match="non-empty"):
            to_aps_did("")


class TestFromApsDid:
    def test_basic(self):
        assert from_aps_did("did:agentid:abc-123") == "abc-123"

    def test_round_trip(self):
        agent_id = "my-agent-99"
        assert from_aps_did(to_aps_did(agent_id)) == agent_id

    def test_invalid_prefix(self):
        with pytest.raises(ValueError, match="Invalid APS DID format"):
            from_aps_did("did:example:abc-123")

    def test_missing_id(self):
        with pytest.raises(ValueError, match="Invalid APS DID format"):
            from_aps_did("did:agentid:")

    def test_completely_wrong(self):
        with pytest.raises(ValueError, match="Invalid APS DID format"):
            from_aps_did("not-a-did")


# ── APS metadata ────────────────────────────────────────────────────────────


class TestCreateApsMetadata:
    def test_fields_present(self):
        cert = {"id": "cert-1", "issued": "2025-01-01"}
        meta = create_aps_metadata("ag-1", cert, 0.85, ["read", "write"])

        assert meta["agent_did"] == "did:agentid:ag-1"
        assert meta["agentid_certificate"] is cert
        assert meta["reputation"] == 0.85
        assert meta["capabilities"] == ["read", "write"]
        assert meta["source"] == "agentid"
        assert isinstance(meta["created_at"], int)

    def test_default_capabilities(self):
        meta = create_aps_metadata("ag-2", {}, 0.5)
        assert meta["capabilities"] == []

    def test_trust_score_bounds(self):
        with pytest.raises(ValueError, match="trust_score"):
            create_aps_metadata("ag-3", {}, 1.5)
        with pytest.raises(ValueError, match="trust_score"):
            create_aps_metadata("ag-3", {}, -0.1)

    def test_edge_scores_accepted(self):
        create_aps_metadata("ag-4", {}, 0.0)
        create_aps_metadata("ag-5", {}, 1.0)


# ── Passport verification ──────────────────────────────────────────────────


def _make_signed_passport(payload: dict) -> dict:
    """Helper: create a real signed passport with a fresh Ed25519 keypair."""
    signing_key = SigningKey.generate()
    verify_key = signing_key.verify_key

    payload_bytes = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    signature = signing_key.sign(payload_bytes).signature

    return {
        "public_key": verify_key.encode(Base64Encoder).decode(),
        "signature": Base64Encoder.encode(signature).decode(),
        "payload": payload,
    }


class TestVerifyApsPassport:
    def test_valid_passport_dict(self):
        payload = {"agentId": "a1", "name": "TestBot", "owner": "alice"}
        passport = _make_signed_passport(payload)

        result = verify_aps_passport(passport)
        assert result["valid"] is True
        assert result["payload"] == payload

    def test_valid_passport_json_string(self):
        payload = {"agentId": "a2", "name": "Bot2"}
        passport = _make_signed_passport(payload)

        result = verify_aps_passport(json.dumps(passport))
        assert result["valid"] is True
        assert result["payload"] == payload

    def test_tampered_payload_fails(self):
        payload = {"agentId": "a3", "name": "Bot3"}
        passport = _make_signed_passport(payload)
        passport["payload"]["name"] = "TAMPERED"

        with pytest.raises(ValueError, match="Invalid passport signature"):
            verify_aps_passport(passport)

    def test_wrong_key_fails(self):
        payload = {"agentId": "a4"}
        passport = _make_signed_passport(payload)

        # Replace public key with a different one
        other_key = SigningKey.generate().verify_key
        passport["public_key"] = other_key.encode(Base64Encoder).decode()

        with pytest.raises(ValueError, match="Invalid passport signature"):
            verify_aps_passport(passport)

    def test_missing_field_raises(self):
        with pytest.raises(ValueError, match="missing required field"):
            verify_aps_passport({"public_key": "x", "signature": "y"})

    def test_bad_json_string(self):
        with pytest.raises(ValueError, match="not valid JSON"):
            verify_aps_passport("{broken")


# ── Delegation request ──────────────────────────────────────────────────────


class TestCreateDelegationRequest:
    def test_basic_structure(self):
        pubkey = SigningKey.generate().verify_key.encode(Base64Encoder).decode()
        req = create_delegation_request("parent-1", pubkey, ["execute", "read"], expiry_hours=48)

        assert req["type"] == "aps_delegation_request"
        assert req["parent_did"] == "did:agentid:parent-1"
        assert req["child_public_key"] == pubkey
        assert req["scope"] == ["execute", "read"]
        assert req["depth"] == 1
        assert req["status"] == "unsigned"
        assert req["expires_at"] > req["issued_at"]

    def test_expiry_calculation(self):
        pubkey = SigningKey.generate().verify_key.encode(Base64Encoder).decode()
        before = int(time.time())
        req = create_delegation_request("p", pubkey, ["s"], expiry_hours=1)
        after = int(time.time())

        assert before <= req["issued_at"] <= after
        expected_expiry = req["issued_at"] + 3600
        assert req["expires_at"] == expected_expiry

    def test_empty_parent_raises(self):
        with pytest.raises(ValueError, match="parent_agent_id"):
            create_delegation_request("", "key", ["scope"])

    def test_empty_pubkey_raises(self):
        with pytest.raises(ValueError, match="child_ed25519_pubkey"):
            create_delegation_request("p", "", ["scope"])

    def test_empty_scope_raises(self):
        with pytest.raises(ValueError, match="scope"):
            create_delegation_request("p", "key", [])

    def test_negative_expiry_raises(self):
        with pytest.raises(ValueError, match="expiry_hours"):
            create_delegation_request("p", "key", ["s"], expiry_hours=-1)


# ── AgentIDPassportBridge dataclass ─────────────────────────────────────────


class TestAgentIDPassportBridge:
    def test_did_auto_derived(self):
        bridge = AgentIDPassportBridge(agent_id="bot-7")
        assert bridge.did == "did:agentid:bot-7"

    def test_full_construction(self):
        cert = {"id": "cert-5"}
        bridge = AgentIDPassportBridge(
            agent_id="bot-8",
            ed25519_public_key="base64key==",
            agentid_certificate=cert,
        )
        assert bridge.agent_id == "bot-8"
        assert bridge.did == "did:agentid:bot-8"
        assert bridge.ed25519_public_key == "base64key=="
        assert bridge.agentid_certificate is cert
        assert bridge.aps_compatible_metadata == {}

    def test_build_metadata(self):
        cert = {"id": "cert-6"}
        bridge = AgentIDPassportBridge(agent_id="bot-9", agentid_certificate=cert)
        meta = bridge.build_metadata(trust_score=0.9, capabilities=["chat"])

        assert meta["agent_did"] == "did:agentid:bot-9"
        assert meta["reputation"] == 0.9
        assert meta["capabilities"] == ["chat"]
        assert bridge.aps_compatible_metadata is meta

    def test_build_metadata_validates_score(self):
        bridge = AgentIDPassportBridge(agent_id="bot-10")
        with pytest.raises(ValueError, match="trust_score"):
            bridge.build_metadata(trust_score=2.0)
