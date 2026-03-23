"""Tests for agentid.qntm_bridge — Ed25519 identity for qntm relays."""

import binascii
from unittest.mock import patch, MagicMock

import pytest
from nacl.signing import SigningKey, VerifyKey

from agentid.qntm_bridge import (
    QntmAgentIdentity,
    generate_qntm_identity,
    sign_challenge,
    create_subscribe_params,
    attach_certificate,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_identity() -> QntmAgentIdentity:
    """Create a real QntmAgentIdentity with a fresh keypair (no API call)."""
    signing_key = SigningKey.generate()
    x25519_private = signing_key.to_curve25519_private_key()
    return QntmAgentIdentity(
        agent_id="agent_test_123",
        ed25519_seed=bytes(signing_key),
        ed25519_public_key=bytes(signing_key.verify_key),
        x25519_public_key=bytes(x25519_private.public_key),
        agentid_certificate={"cert": "mock-cert-data", "agent_id": "agent_test_123"},
    )


# ---------------------------------------------------------------------------
# QntmAgentIdentity dataclass
# ---------------------------------------------------------------------------

class TestQntmAgentIdentity:
    def test_fields_stored(self):
        identity = _make_identity()
        assert identity.agent_id == "agent_test_123"
        assert len(identity.ed25519_seed) == 32
        assert len(identity.ed25519_public_key) == 32
        assert len(identity.x25519_public_key) == 32
        assert isinstance(identity.agentid_certificate, dict)

    def test_ed25519_public_hex(self):
        identity = _make_identity()
        hex_str = identity.ed25519_public_hex
        assert len(hex_str) == 64  # 32 bytes = 64 hex chars
        # round-trip
        assert binascii.unhexlify(hex_str) == identity.ed25519_public_key

    def test_x25519_public_hex(self):
        identity = _make_identity()
        hex_str = identity.x25519_public_hex
        assert len(hex_str) == 64
        assert binascii.unhexlify(hex_str) == identity.x25519_public_key


# ---------------------------------------------------------------------------
# generate_qntm_identity
# ---------------------------------------------------------------------------

class TestGenerateQntmIdentity:
    @patch("agentid.qntm_bridge.httpx.post")
    def test_success(self, mock_post):
        """Happy path: API returns 200 with a certificate."""
        fake_cert = {"certificate": "abc123", "agent_id": "agent_42"}
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = fake_cert
        mock_post.return_value = mock_response

        identity = generate_qntm_identity(
            api_key="agentid_sk_test",
            agent_id="agent_42",
            base_url="https://test.api/api/v1",
        )

        # Verify the API was called correctly
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args
        assert call_kwargs[0][0] == "https://test.api/api/v1/agents/bind-ed25519"
        sent_json = call_kwargs[1]["json"]
        assert sent_json["agent_id"] == "agent_42"
        assert len(sent_json["ed25519_public_key"]) == 64  # hex-encoded 32 bytes

        # Verify Authorization header
        assert call_kwargs[1]["headers"]["Authorization"] == "Bearer agentid_sk_test"

        # Verify returned identity
        assert identity.agent_id == "agent_42"
        assert len(identity.ed25519_seed) == 32
        assert len(identity.ed25519_public_key) == 32
        assert len(identity.x25519_public_key) == 32
        assert identity.agentid_certificate == fake_cert

    @patch("agentid.qntm_bridge.httpx.post")
    def test_api_error_raises(self, mock_post):
        """API returns 400+ -> should raise Exception."""
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {"error": "invalid agent_id"}
        mock_post.return_value = mock_response

        with pytest.raises(Exception, match="bind-ed25519 error.*invalid agent_id"):
            generate_qntm_identity(
                api_key="agentid_sk_test",
                agent_id="bad_agent",
            )

    @patch("agentid.qntm_bridge.httpx.post")
    def test_keypair_is_valid(self, mock_post):
        """The generated keypair should be a valid Ed25519 pair."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"cert": "ok"}
        mock_post.return_value = mock_response

        identity = generate_qntm_identity(
            api_key="agentid_sk_test",
            agent_id="agent_99",
        )

        # Reconstruct the signing key from the seed and verify it produces the same public key
        restored = SigningKey(identity.ed25519_seed)
        assert bytes(restored.verify_key) == identity.ed25519_public_key

    @patch("agentid.qntm_bridge.httpx.post")
    def test_unique_keys_per_call(self, mock_post):
        """Each call should generate a fresh keypair."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"cert": "ok"}
        mock_post.return_value = mock_response

        id1 = generate_qntm_identity("key", "agent_1")
        id2 = generate_qntm_identity("key", "agent_1")

        assert id1.ed25519_seed != id2.ed25519_seed
        assert id1.ed25519_public_key != id2.ed25519_public_key


# ---------------------------------------------------------------------------
# sign_challenge
# ---------------------------------------------------------------------------

class TestSignChallenge:
    def test_signature_is_valid(self):
        """Signature should verify against the public key."""
        identity = _make_identity()
        challenge_hex = binascii.hexlify(b"a" * 32).decode()  # 32-byte challenge

        sig_hex = sign_challenge(identity, challenge_hex)

        # Should be 64 bytes = 128 hex chars
        assert len(sig_hex) == 128

        # Verify the signature using PyNaCl
        verify_key = VerifyKey(identity.ed25519_public_key)
        sig_bytes = binascii.unhexlify(sig_hex)
        challenge_bytes = binascii.unhexlify(challenge_hex)
        # VerifyKey.verify returns the message on success, raises on failure
        result = verify_key.verify(challenge_bytes, sig_bytes)
        assert result == challenge_bytes

    def test_wrong_key_rejects(self):
        """Signature from one identity should NOT verify with a different key."""
        identity_a = _make_identity()
        identity_b = _make_identity()
        challenge_hex = binascii.hexlify(b"x" * 32).decode()

        sig_hex = sign_challenge(identity_a, challenge_hex)

        verify_key_b = VerifyKey(identity_b.ed25519_public_key)
        sig_bytes = binascii.unhexlify(sig_hex)
        challenge_bytes = binascii.unhexlify(challenge_hex)
        with pytest.raises(Exception):  # nacl.exceptions.BadSignatureError
            verify_key_b.verify(challenge_bytes, sig_bytes)

    def test_deterministic_signature(self):
        """Ed25519 signatures are deterministic — same input, same output."""
        identity = _make_identity()
        challenge_hex = binascii.hexlify(b"z" * 32).decode()

        sig1 = sign_challenge(identity, challenge_hex)
        sig2 = sign_challenge(identity, challenge_hex)
        assert sig1 == sig2

    def test_different_challenges_different_signatures(self):
        identity = _make_identity()
        c1 = binascii.hexlify(b"\x00" * 32).decode()
        c2 = binascii.hexlify(b"\x01" * 32).decode()

        assert sign_challenge(identity, c1) != sign_challenge(identity, c2)


# ---------------------------------------------------------------------------
# create_subscribe_params
# ---------------------------------------------------------------------------

class TestCreateSubscribeParams:
    def test_returns_correct_keys(self):
        identity = _make_identity()
        params = create_subscribe_params(identity, conv_id="conv_abc")

        assert params["conv_id"] == "conv_abc"
        assert params["pub_key"] == identity.ed25519_public_hex

    def test_pub_key_is_hex(self):
        identity = _make_identity()
        params = create_subscribe_params(identity, conv_id="conv_1")
        # Should be valid hex
        binascii.unhexlify(params["pub_key"])

    def test_only_expected_keys(self):
        identity = _make_identity()
        params = create_subscribe_params(identity, conv_id="conv_1")
        assert set(params.keys()) == {"conv_id", "pub_key"}


# ---------------------------------------------------------------------------
# attach_certificate
# ---------------------------------------------------------------------------

class TestAttachCertificate:
    def test_adds_agentid_key(self):
        cert = {"cert_id": "c1", "agent_id": "a1"}
        result = attach_certificate({}, cert)
        assert result["agentid"]["certificate"] == cert

    def test_preserves_existing_metadata(self):
        metadata = {"timestamp": 123, "sender": "bot"}
        cert = {"cert_id": "c1"}
        result = attach_certificate(metadata, cert)

        assert result["timestamp"] == 123
        assert result["sender"] == "bot"
        assert result["agentid"]["certificate"] == cert

    def test_does_not_mutate_input(self):
        metadata = {"key": "value"}
        original_copy = dict(metadata)
        attach_certificate(metadata, {"cert": "x"})
        assert metadata == original_copy

    def test_overwrites_existing_agentid_key(self):
        metadata = {"agentid": "old"}
        cert = {"cert_id": "new"}
        result = attach_certificate(metadata, cert)
        assert result["agentid"] == {"certificate": cert}
