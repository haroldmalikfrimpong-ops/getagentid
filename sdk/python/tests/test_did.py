"""Tests for the DID resolution and cross-verification module."""

import json

import pytest

from agentid.ed25519 import Ed25519Identity
from agentid.did import (
    _b58encode,
    _b58decode,
    create_did_agentid,
    create_did_aps,
    resolve_did_agentid,
    resolve_did_aps,
    resolve_did,
    sign_with_did,
    verify_with_did,
    register_agentid_key,
    clear_agentid_registry,
    create_identity_with_dids,
)


# ── Fixtures ────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _clean_registry():
    """Ensure a fresh local registry for every test."""
    clear_agentid_registry()
    yield
    clear_agentid_registry()


# ── Base58btc codec ─────────────────────────────────────────────────────────


class TestBase58Codec:
    def test_round_trip_simple(self):
        data = b"hello"
        assert _b58decode(_b58encode(data)) == data

    def test_round_trip_32_bytes(self):
        data = bytes(range(32))
        assert _b58decode(_b58encode(data)) == data

    def test_leading_zeros_preserved(self):
        data = b"\x00\x00\x01"
        encoded = _b58encode(data)
        assert encoded.startswith("11")
        assert _b58decode(encoded) == data

    def test_invalid_character_raises(self):
        with pytest.raises(ValueError, match="Invalid base58btc character"):
            _b58decode("0OIl")  # 0, O, I, l are not in base58btc


# ── DID creation: did:agentid ───────────────────────────────────────────────


class TestCreateDidAgentid:
    def test_basic(self):
        assert create_did_agentid("agent-007") == "did:agentid:agent-007"

    def test_underscore(self):
        assert create_did_agentid("my_agent_42") == "did:agentid:my_agent_42"

    def test_empty_raises(self):
        with pytest.raises(ValueError, match="non-empty"):
            create_did_agentid("")

    def test_invalid_characters_raises(self):
        with pytest.raises(ValueError, match="invalid characters"):
            create_did_agentid("agent with spaces")

    def test_special_chars_rejected(self):
        with pytest.raises(ValueError, match="invalid characters"):
            create_did_agentid("agent@home")


# ── DID creation: did:aps ──────────────────────────────────────────────────


class TestCreateDidAps:
    def test_starts_with_prefix(self):
        key = Ed25519Identity.generate().ed25519_public_key
        did = create_did_aps(key)
        assert did.startswith("did:aps:z")

    def test_wrong_length_raises(self):
        with pytest.raises(ValueError, match="32 bytes"):
            create_did_aps(b"\x00" * 16)

    def test_wrong_type_raises(self):
        with pytest.raises(TypeError, match="must be bytes"):
            create_did_aps("not-bytes")  # type: ignore

    def test_deterministic(self):
        key = b"\xab" * 32
        did1 = create_did_aps(key)
        did2 = create_did_aps(key)
        assert did1 == did2


# ── DID resolution: did:agentid ────────────────────────────────────────────


class TestResolveDidAgentid:
    def test_resolve_registered_key(self):
        identity = Ed25519Identity.generate()
        register_agentid_key("test-agent", identity.ed25519_public_key)
        resolved = resolve_did_agentid("did:agentid:test-agent")
        assert resolved == identity.ed25519_public_key

    def test_unregistered_raises(self):
        with pytest.raises(ValueError, match="not found"):
            resolve_did_agentid("did:agentid:ghost")

    def test_invalid_format_raises(self):
        with pytest.raises(ValueError, match="Invalid did:agentid"):
            resolve_did_agentid("did:aps:zabc")

    def test_invalid_did_no_id(self):
        with pytest.raises(ValueError, match="Invalid did:agentid"):
            resolve_did_agentid("did:agentid:")


# ── DID resolution: did:aps ────────────────────────────────────────────────


class TestResolveDidAps:
    def test_round_trip(self):
        key = Ed25519Identity.generate().ed25519_public_key
        did = create_did_aps(key)
        resolved = resolve_did_aps(did)
        assert resolved == key

    def test_deterministic_key_round_trip(self):
        identity = Ed25519Identity.from_seed(b"\x42" * 32)
        did = create_did_aps(identity.ed25519_public_key)
        resolved = resolve_did_aps(did)
        assert resolved == identity.ed25519_public_key

    def test_invalid_format_raises(self):
        with pytest.raises(ValueError, match="Invalid did:aps"):
            resolve_did_aps("did:agentid:some-id")

    def test_wrong_prefix_raises(self):
        with pytest.raises(ValueError, match="Invalid did:aps"):
            resolve_did_aps("did:aps:a1234")  # missing 'z' multibase prefix

    def test_bad_base58_raises(self):
        # 'O' is not in base58btc alphabet
        with pytest.raises(ValueError):
            resolve_did_aps("did:aps:zOOOO")


# ── Generic resolve_did dispatcher ─────────────────────────────────────────


class TestResolveDid:
    def test_dispatches_to_aps(self):
        key = Ed25519Identity.generate().ed25519_public_key
        did = create_did_aps(key)
        assert resolve_did(did) == key

    def test_dispatches_to_agentid(self):
        identity = Ed25519Identity.generate()
        register_agentid_key("dispatch-test", identity.ed25519_public_key)
        assert resolve_did("did:agentid:dispatch-test") == identity.ed25519_public_key

    def test_unsupported_method_raises(self):
        with pytest.raises(ValueError, match="Unsupported DID method"):
            resolve_did("did:example:foo")


# ── Signing ─────────────────────────────────────────────────────────────────


class TestSignWithDid:
    def test_produces_64_byte_signature(self):
        identity = Ed25519Identity.generate()
        sig = sign_with_did(b"hello", identity.seed)
        assert len(sig) == 64

    def test_wrong_key_length_raises(self):
        with pytest.raises(ValueError, match="32 bytes"):
            sign_with_did(b"msg", b"\x00" * 16)

    def test_non_bytes_message_raises(self):
        with pytest.raises(TypeError, match="message must be bytes"):
            sign_with_did("not bytes", b"\x00" * 32)  # type: ignore


# ── Cross-verification ─────────────────────────────────────────────────────


class TestVerifyWithDid:
    def test_verify_via_aps_did(self):
        identity = Ed25519Identity.generate()
        did = create_did_aps(identity.ed25519_public_key)
        msg = b"cross-verify-aps"
        sig = identity.sign(msg)
        assert verify_with_did(msg, sig, did) is True

    def test_verify_via_agentid_did(self):
        identity = Ed25519Identity.generate()
        register_agentid_key("verify-agent", identity.ed25519_public_key)
        did = create_did_agentid("verify-agent")
        msg = b"cross-verify-agentid"
        sig = identity.sign(msg)
        assert verify_with_did(msg, sig, did) is True

    def test_wrong_signature_returns_false(self):
        identity = Ed25519Identity.generate()
        did = create_did_aps(identity.ed25519_public_key)
        msg = b"original"
        sig = identity.sign(b"different message")
        assert verify_with_did(msg, sig, did) is False

    def test_wrong_key_returns_false(self):
        id1 = Ed25519Identity.generate()
        id2 = Ed25519Identity.generate()
        did = create_did_aps(id2.ed25519_public_key)
        msg = b"cross-key-test"
        sig = id1.sign(msg)
        assert verify_with_did(msg, sig, did) is False


# ── Full cross-verification round-trip ──────────────────────────────────────


class TestCrossVerificationRoundTrip:
    def test_same_key_both_dids_verify(self):
        """The core interop test: one key, two DIDs, both verify the same sig."""
        identity = Ed25519Identity.generate()
        agent_id = "interop-agent"
        register_agentid_key(agent_id, identity.ed25519_public_key)

        did_agentid = create_did_agentid(agent_id)
        did_aps = create_did_aps(identity.ed25519_public_key)

        challenge = json.dumps({
            "challenge": "did-interop-test",
            "systems": ["agentid", "aps"],
        }, sort_keys=True, separators=(",", ":")).encode()

        sig = sign_with_did(challenge, identity.seed)

        # Both DID methods must verify the same signature
        assert verify_with_did(challenge, sig, did_agentid) is True
        assert verify_with_did(challenge, sig, did_aps) is True

    def test_two_agents_cannot_cross_verify(self):
        """Two different agents' signatures must NOT cross-verify."""
        id1 = Ed25519Identity.generate()
        id2 = Ed25519Identity.generate()

        register_agentid_key("agent-A", id1.ed25519_public_key)

        did_A = create_did_agentid("agent-A")
        did_B_aps = create_did_aps(id2.ed25519_public_key)

        msg = b"identity-separation-test"
        sig_B = sign_with_did(msg, id2.seed)

        assert verify_with_did(msg, sig_B, did_A) is False
        assert verify_with_did(msg, sig_B, did_B_aps) is True

    def test_create_identity_with_dids_helper(self):
        """The convenience helper creates both DIDs and they cross-verify."""
        identity, did_agentid, did_aps = create_identity_with_dids("helper-agent")
        msg = b"convenience-test"
        sig = identity.sign(msg)

        assert verify_with_did(msg, sig, did_agentid) is True
        assert verify_with_did(msg, sig, did_aps) is True

    def test_aps_only_agent_verified_by_agentid(self):
        """AgentID can resolve a did:aps DID and verify its signature."""
        aps_identity = Ed25519Identity.generate()
        aps_did = create_did_aps(aps_identity.ed25519_public_key)
        msg = b"aps-only-challenge"
        sig = aps_identity.sign(msg)

        # AgentID side extracts key from did:aps and verifies
        extracted_key = resolve_did_aps(aps_did)
        assert extracted_key == aps_identity.ed25519_public_key
        assert verify_with_did(msg, sig, aps_did) is True
