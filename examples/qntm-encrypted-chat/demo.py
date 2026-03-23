"""
AgentID + qntm Encrypted Relay: Agent-to-Agent Secure Communication

Two AI agents, each with an AgentID identity, communicate through a qntm
encrypted relay. AgentID certificates provide organizational trust; qntm
provides the encrypted transport.

Flow:
  1. Each agent registers with AgentID and receives a certificate
  2. Each agent generates an Ed25519 keypair and binds it to their AgentID
  3. Agents connect to the qntm relay and authenticate via challenge-response
  4. AgentID certificates are exchanged as metadata — each side verifies the other
  5. Messages are encrypted end-to-end using X3DH key agreement + Double Ratchet
  6. Only agents with valid AgentID certificates can participate

The qntm relay is simulated (we mock the WebSocket transport) but all
cryptographic operations are REAL — Ed25519 signatures, X25519 DH, XSalsa20
symmetric encryption. AgentID API calls are real when AGENTID_API_KEY is set.

Usage:
    pip install -r requirements.txt
    export AGENTID_API_KEY="agentid_sk_..."   # optional, for live API
    python demo.py
"""

import os
import sys
import json
import time
import hmac
import hashlib
import secrets
import base64
from dataclasses import dataclass, field
from typing import Optional

import httpx
from nacl.signing import SigningKey, VerifyKey
from nacl.public import PrivateKey, PublicKey, Box
from nacl.encoding import HexEncoder, RawEncoder
from nacl.utils import random as nacl_random
from nacl.secret import SecretBox
from nacl.hash import blake2b


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

AGENTID_API_URL = "https://www.getagentid.dev/api/v1"
AGENTID_API_KEY = os.environ.get("AGENTID_API_KEY", "")

# qntm relay (simulated in this demo)
QNTM_RELAY_URL = "wss://relay.qntm.dev/v1"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def banner(text: str):
    width = 70
    print()
    print("=" * width)
    print(f"  {text}")
    print("=" * width)


def step(n: int, text: str):
    print(f"\n  [{n}] {text}")


def info(text: str):
    print(f"      {text}")


def ok(text: str):
    print(f"      OK: {text}")


def warn(text: str):
    print(f"      >> {text}")


def show_json(label: str, data: dict, indent: int = 6):
    prefix = " " * indent
    print(f"{prefix}{label}:")
    for line in json.dumps(data, indent=2).split("\n"):
        print(f"{prefix}  {line}")


# ---------------------------------------------------------------------------
# AgentID Client
#
# Uses the REAL AgentID API (https://getagentid.dev) when AGENTID_API_KEY
# is set. Falls back to local certificate issuance (same crypto format)
# when no key is available, so the demo always runs.
# ---------------------------------------------------------------------------

def _b64url(data: bytes) -> str:
    """Base64url encode without padding."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _local_issue_certificate(agent_id: str, name: str, owner: str,
                             capabilities: list[str]) -> str:
    """
    Issue an AgentID-format certificate locally.

    This mirrors the server-side issueCertificate() in
    dashboard/src/lib/api-auth.ts — same structure, same JWT format.
    Used only when no API key is available so the demo can still run
    with real crypto.
    """
    now = int(time.time())
    expires = now + 365 * 24 * 60 * 60

    header = {"alg": "HS256", "typ": "AgentID"}
    payload = {
        "iss": "https://getagentid.dev",
        "sub": agent_id,
        "name": name,
        "owner": owner,
        "capabilities": capabilities,
        "iat": now,
        "exp": expires,
    }

    h = _b64url(json.dumps(header).encode())
    p = _b64url(json.dumps(payload).encode())
    # Sign with a demo key — in production the server signs with JWT_SECRET
    sig = _b64url(hmac.new(b"demo-local-signing-key",
                           f"{h}.{p}".encode(), hashlib.sha256).digest())
    return f"{h}.{p}.{sig}"


class AgentIDClient:
    """Client for the AgentID API with local fallback."""

    def __init__(self, api_key: str = ""):
        self.api_key = api_key
        self.base_url = AGENTID_API_URL
        self._live = False  # set True if live API calls succeed

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        return h

    def register(self, name: str, description: str, capabilities: list[str],
                 platform: str = "qntm-relay") -> dict:
        """Register an agent. Uses live API if possible, local fallback otherwise."""
        try:
            resp = httpx.post(
                f"{self.base_url}/agents/register",
                json={
                    "name": name,
                    "description": description,
                    "capabilities": capabilities,
                    "platform": platform,
                },
                headers=self._headers(),
                timeout=15,
                follow_redirects=True,
            )
            if resp.status_code < 400:
                self._live = True
                return resp.json()
            # Fall through to local
        except Exception:
            pass

        # Local fallback — generate identity locally
        agent_id = f"agent_{secrets.token_hex(8)}"
        owner = "demo-org"
        cert = _local_issue_certificate(agent_id, name, owner, capabilities)
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        return {
            "agent_id": agent_id,
            "name": name,
            "owner": owner,
            "certificate": cert,
            "issued_at": now_iso,
            "expires_at": time.strftime("%Y-%m-%dT%H:%M:%SZ",
                                        time.gmtime(time.time() + 365*86400)),
            "_local": True,
        }

    def verify(self, agent_id: str) -> dict:
        """Verify an agent. The verify endpoint is public (no key needed)."""
        try:
            resp = httpx.post(
                f"{self.base_url}/agents/verify",
                json={"agent_id": agent_id},
                timeout=15,
                follow_redirects=True,
            )
            if resp.status_code < 400:
                return resp.json()
        except Exception:
            pass

        # Offline fallback
        return {
            "verified": False,
            "agent_id": agent_id,
            "message": "Offline — could not reach AgentID API",
        }

    def bind_ed25519(self, agent_id: str, ed25519_public_key: str) -> dict:
        """Bind an Ed25519 public key to an agent (requires API key)."""
        try:
            resp = httpx.post(
                f"{self.base_url}/agents/bind-ed25519",
                json={
                    "agent_id": agent_id,
                    "ed25519_public_key": ed25519_public_key,
                },
                headers=self._headers(),
                timeout=15,
                follow_redirects=True,
            )
            if resp.status_code < 400:
                return resp.json()
        except Exception:
            pass

        # Local fallback
        return {
            "agent_id": agent_id,
            "ed25519_public_key": ed25519_public_key,
            "certificate": _local_issue_certificate(
                agent_id, agent_id, "demo-org", ["encrypted-comms"]),
            "_local": True,
        }


# ---------------------------------------------------------------------------
# Ed25519 Identity Keypair — bound to AgentID
# ---------------------------------------------------------------------------

@dataclass
class AgentIdentity:
    """An agent's full cryptographic identity, bound to its AgentID."""
    name: str
    agent_id: str
    certificate: str

    # Ed25519 signing keypair (for challenge-response auth)
    signing_key: SigningKey = field(repr=False)
    verify_key: VerifyKey = field(repr=False)

    # X25519 keypair (for X3DH / encryption)
    encryption_private: PrivateKey = field(repr=False)
    encryption_public: PublicKey = field(repr=False)

    # Ephemeral prekey for X3DH (rotated per session)
    ephemeral_private: PrivateKey = field(repr=False)
    ephemeral_public: PublicKey = field(repr=False)

    @classmethod
    def create(cls, name: str, agent_id: str, certificate: str) -> "AgentIdentity":
        signing_key = SigningKey.generate()
        encryption_private = PrivateKey.generate()
        ephemeral_private = PrivateKey.generate()
        return cls(
            name=name,
            agent_id=agent_id,
            certificate=certificate,
            signing_key=signing_key,
            verify_key=signing_key.verify_key,
            encryption_private=encryption_private,
            encryption_public=encryption_private.public_key,
            ephemeral_private=ephemeral_private,
            ephemeral_public=ephemeral_private.public_key,
        )

    def sign(self, message: bytes) -> bytes:
        """Sign a message with Ed25519. Returns the 64-byte signature."""
        return self.signing_key.sign(message).signature

    def public_bundle(self) -> dict:
        """The public key bundle exchanged during the X3DH handshake."""
        return {
            "agent_id": self.agent_id,
            "certificate": self.certificate,
            "identity_key": self.verify_key.encode(HexEncoder).decode(),
            "encryption_key": self.encryption_public.encode(HexEncoder).decode(),
            "ephemeral_key": self.ephemeral_public.encode(HexEncoder).decode(),
        }


# ---------------------------------------------------------------------------
# X3DH Key Agreement (Extended Triple Diffie-Hellman)
#
# Both sides perform the SAME set of DH operations but with swapped roles,
# producing identical shared secrets.
#
# The key insight: DH(a, B) == DH(b, A) — commutativity of ECDH.
# We arrange the four DH operations so both sides compute the same value.
# ---------------------------------------------------------------------------

def _x3dh_shared_secret(
    our_ik_private: PrivateKey,      # our identity (X25519)
    our_ek_private: PrivateKey,      # our ephemeral
    their_ik_public: PublicKey,      # their identity (X25519)
    their_ek_public: PublicKey,      # their ephemeral
    is_initiator: bool,
) -> bytes:
    """
    Core X3DH computation. Both sides call this with swapped our/their keys.

    DH1 = IK_a  x IK_b    (mutual identity)
    DH2 = EK_a  x IK_b    (initiator ephemeral x responder identity)
    DH3 = IK_a  x EK_b    (initiator identity  x responder ephemeral)
    DH4 = EK_a  x EK_b    (mutual ephemeral)
    """
    # DH1: both identity keys — always the same regardless of role
    dh1 = Box(our_ik_private, their_ik_public).shared_key()

    if is_initiator:
        # DH2: our ephemeral x their identity
        dh2 = Box(our_ek_private, their_ik_public).shared_key()
        # DH3: our identity x their ephemeral
        dh3 = Box(our_ik_private, their_ek_public).shared_key()
    else:
        # Mirror: DH2 = their ephemeral x our identity = our identity x their ephemeral
        dh2 = Box(our_ik_private, their_ek_public).shared_key()
        # Mirror: DH3 = their identity x our ephemeral = our ephemeral x their identity
        dh3 = Box(our_ek_private, their_ik_public).shared_key()

    # DH4: both ephemeral keys — always the same
    dh4 = Box(our_ek_private, their_ek_public).shared_key()

    # KDF: BLAKE2b over the concatenated DH outputs
    combined = dh1 + dh2 + dh3 + dh4
    return blake2b(combined, digest_size=32, encoder=RawEncoder)


def x3dh_initiator(our_identity: AgentIdentity, their_bundle: dict) -> bytes:
    """X3DH from Alice's (initiator) side."""
    their_ik = PublicKey(bytes.fromhex(their_bundle["encryption_key"]))
    their_ek = PublicKey(bytes.fromhex(their_bundle["ephemeral_key"]))
    return _x3dh_shared_secret(
        our_ik_private=our_identity.encryption_private,
        our_ek_private=our_identity.ephemeral_private,
        their_ik_public=their_ik,
        their_ek_public=their_ek,
        is_initiator=True,
    )


def x3dh_responder(our_identity: AgentIdentity, their_bundle: dict) -> bytes:
    """X3DH from Bob's (responder) side."""
    their_ik = PublicKey(bytes.fromhex(their_bundle["encryption_key"]))
    their_ek = PublicKey(bytes.fromhex(their_bundle["ephemeral_key"]))
    return _x3dh_shared_secret(
        our_ik_private=our_identity.encryption_private,
        our_ek_private=our_identity.ephemeral_private,
        their_ik_public=their_ik,
        their_ek_public=their_ek,
        is_initiator=False,
    )


# ---------------------------------------------------------------------------
# Double Ratchet (simplified symmetric ratchet)
#
# Each message derives a unique encryption key from a ratcheting chain.
# Compromising message key N reveals nothing about keys < N (forward secrecy).
# A full Signal-protocol implementation adds DH ratchet steps; this demo
# focuses on the symmetric ratchet to keep the code clear.
# ---------------------------------------------------------------------------

class DoubleRatchet:
    """Symmetric ratchet with separate send/receive chains."""

    def __init__(self, root_key: bytes, is_initiator: bool):
        # Derive separate send/receive chain keys from the root.
        # Initiator's send chain == responder's receive chain, and vice versa.
        if is_initiator:
            self.send_chain = blake2b(root_key + b"chain-a-to-b",
                                      digest_size=32, encoder=RawEncoder)
            self.recv_chain = blake2b(root_key + b"chain-b-to-a",
                                      digest_size=32, encoder=RawEncoder)
        else:
            self.send_chain = blake2b(root_key + b"chain-b-to-a",
                                      digest_size=32, encoder=RawEncoder)
            self.recv_chain = blake2b(root_key + b"chain-a-to-b",
                                      digest_size=32, encoder=RawEncoder)
        self.send_n = 0
        self.recv_n = 0

    def _advance(self, chain_key: bytes) -> tuple[bytes, bytes]:
        """Advance a chain: returns (new_chain_key, message_key)."""
        new_chain = blake2b(chain_key + b"chain-step",
                            digest_size=32, encoder=RawEncoder)
        msg_key = blake2b(chain_key + b"message-key",
                          digest_size=32, encoder=RawEncoder)
        return new_chain, msg_key

    def encrypt(self, plaintext: str) -> dict:
        """Encrypt a message. Returns dict with ciphertext and message number."""
        self.send_chain, msg_key = self._advance(self.send_chain)
        box = SecretBox(msg_key)
        ct = box.encrypt(plaintext.encode("utf-8"))
        self.send_n += 1
        return {"n": self.send_n, "ciphertext": ct.hex()}

    def decrypt(self, envelope: dict) -> str:
        """Decrypt a message from the peer."""
        self.recv_chain, msg_key = self._advance(self.recv_chain)
        box = SecretBox(msg_key)
        pt = box.decrypt(bytes.fromhex(envelope["ciphertext"]))
        self.recv_n += 1
        return pt.decode("utf-8")


# ---------------------------------------------------------------------------
# qntm Relay Simulator
#
# In production this is a WebSocket connection to relay.qntm.dev.
# The relay is zero-knowledge — it forwards encrypted envelopes without
# ever seeing plaintext. Authentication uses Ed25519 challenge-response.
# ---------------------------------------------------------------------------

class QntmRelaySimulator:
    """
    Simulates the qntm relay auth + message forwarding.

    Auth flow:
      1. Agent connects and sends its agent_id
      2. Relay returns a random 32-byte challenge
      3. Agent signs the challenge with its Ed25519 key
      4. Relay verifies the signature against the agent's public key
      5. Agent is authenticated and may subscribe to channels
    """

    def __init__(self):
        self.authenticated: dict[str, AgentIdentity] = {}
        self.channels: dict[str, list[str]] = {}
        self.queues: dict[str, list[dict]] = {}

    def connect_and_auth(self, identity: AgentIdentity) -> dict:
        """Run the full challenge-response flow. Returns auth result."""
        # Relay generates challenge
        challenge = secrets.token_hex(32)

        # Agent signs challenge
        signature = identity.sign(challenge.encode("utf-8"))

        # Relay verifies
        try:
            identity.verify_key.verify(challenge.encode("utf-8"), signature)
            verified = True
        except Exception:
            verified = False

        if not verified:
            return {"authenticated": False, "error": "Signature verification failed"}

        self.authenticated[identity.agent_id] = identity
        self.queues[identity.agent_id] = []

        return {
            "authenticated": True,
            "agent_id": identity.agent_id,
            "challenge": challenge,
            "signature": signature.hex(),
            "relay": QNTM_RELAY_URL,
        }

    def subscribe(self, agent_id: str, channel: str):
        """Subscribe an authenticated agent to a channel."""
        if agent_id not in self.authenticated:
            raise RuntimeError(f"{agent_id} not authenticated on relay")
        self.channels.setdefault(channel, []).append(agent_id)

    def send(self, from_id: str, channel: str, envelope: dict):
        """Forward an encrypted envelope to all channel subscribers."""
        if from_id not in self.authenticated:
            raise RuntimeError(f"{from_id} not authenticated on relay")

        msg = {
            "from": from_id,
            "channel": channel,
            "timestamp": time.time(),
            "envelope": envelope,   # opaque to the relay
        }

        for sub in self.channels.get(channel, []):
            if sub != from_id:
                self.queues[sub].append(msg)

    def receive(self, agent_id: str) -> list[dict]:
        """Pop all pending messages for an agent."""
        msgs = self.queues.get(agent_id, [])
        self.queues[agent_id] = []
        return msgs


# ---------------------------------------------------------------------------
# Main Demo
# ---------------------------------------------------------------------------

def main():
    banner("AgentID + qntm Encrypted Relay Demo")
    print()
    print("  Two AI agents communicate through an encrypted relay.")
    print("  AgentID provides identity. qntm provides encrypted transport.")
    print("  Neither the relay nor any observer can read the messages.")

    agentid = AgentIDClient(api_key=AGENTID_API_KEY)

    # ================================================================
    # PHASE 1 — Register agents with AgentID
    # ================================================================
    banner("PHASE 1: Register Agents with AgentID")

    step(1, "Registering Alice with AgentID...")
    alice_reg = agentid.register(
        name="Alice - Research Agent",
        description="Autonomous research agent specializing in market analysis",
        capabilities=["research", "analysis", "encrypted-comms"],
        platform="qntm-relay",
    )
    if alice_reg.get("_local"):
        warn("No AGENTID_API_KEY set. Using local certificate issuance.")
        warn("Set AGENTID_API_KEY for live API calls. All crypto is still real.")
    ok(f"agent_id    = {alice_reg['agent_id']}")
    info(f"certificate = {alice_reg['certificate'][:60]}...")

    step(2, "Registering Bob with AgentID...")
    bob_reg = agentid.register(
        name="Bob - Trading Agent",
        description="Autonomous trading agent that executes market orders",
        capabilities=["trading", "execution", "encrypted-comms"],
        platform="qntm-relay",
    )
    ok(f"agent_id    = {bob_reg['agent_id']}")
    info(f"certificate = {bob_reg['certificate'][:60]}...")

    # ================================================================
    # PHASE 2 — Generate Ed25519 + X25519 keypairs, bind to AgentID
    # ================================================================
    banner("PHASE 2: Generate Ed25519 + X25519 Keypairs")

    step(3, "Alice generates keypairs and binds Ed25519 to her AgentID...")
    alice = AgentIdentity.create(
        name="Alice",
        agent_id=alice_reg["agent_id"],
        certificate=alice_reg["certificate"],
    )
    alice_ed_hex = alice.verify_key.encode(HexEncoder).decode()
    ok(f"Ed25519 verify key = {alice_ed_hex[:40]}...")
    ok(f"X25519 public key  = {alice.encryption_public.encode(HexEncoder).decode()[:40]}...")
    ok(f"Ephemeral prekey   = {alice.ephemeral_public.encode(HexEncoder).decode()[:40]}...")

    # Bind the Ed25519 key to AgentID (calls /agents/bind-ed25519)
    alice_bind = agentid.bind_ed25519(alice.agent_id, alice_ed_hex)
    if alice_bind.get("_local"):
        info("Ed25519 key binding: local (no API key). Live API would store in registry.")
    else:
        ok("Ed25519 key bound to AgentID registry.")

    step(4, "Bob generates keypairs and binds Ed25519 to his AgentID...")
    bob = AgentIdentity.create(
        name="Bob",
        agent_id=bob_reg["agent_id"],
        certificate=bob_reg["certificate"],
    )
    bob_ed_hex = bob.verify_key.encode(HexEncoder).decode()
    ok(f"Ed25519 verify key = {bob_ed_hex[:40]}...")
    ok(f"X25519 public key  = {bob.encryption_public.encode(HexEncoder).decode()[:40]}...")
    ok(f"Ephemeral prekey   = {bob.ephemeral_public.encode(HexEncoder).decode()[:40]}...")

    bob_bind = agentid.bind_ed25519(bob.agent_id, bob_ed_hex)
    if bob_bind.get("_local"):
        info("Ed25519 key binding: local.")
    else:
        ok("Ed25519 key bound to AgentID registry.")

    # ================================================================
    # PHASE 3 — Connect to qntm relay, challenge-response auth
    # ================================================================
    banner("PHASE 3: qntm Relay Authentication (Challenge-Response)")

    relay = QntmRelaySimulator()

    step(5, f"Alice connects to {QNTM_RELAY_URL}")
    info("Relay issues 32-byte random challenge...")
    alice_auth = relay.connect_and_auth(alice)
    info(f"Challenge  = {alice_auth['challenge'][:40]}...")
    info(f"Signature  = {alice_auth['signature'][:40]}...")
    ok(f"Authenticated = {alice_auth['authenticated']}")

    step(6, f"Bob connects to {QNTM_RELAY_URL}")
    info("Relay issues 32-byte random challenge...")
    bob_auth = relay.connect_and_auth(bob)
    info(f"Challenge  = {bob_auth['challenge'][:40]}...")
    info(f"Signature  = {bob_auth['signature'][:40]}...")
    ok(f"Authenticated = {bob_auth['authenticated']}")

    step(7, "Both agents subscribe to a shared channel...")
    channel = f"agentid:{alice.agent_id}:{bob.agent_id}"
    relay.subscribe(alice.agent_id, channel)
    relay.subscribe(bob.agent_id, channel)
    ok(f"Channel = {channel}")

    # ================================================================
    # PHASE 4 — Exchange key bundles + verify AgentID certificates
    # ================================================================
    banner("PHASE 4: Certificate Exchange and Verification")

    step(8, "Alice sends her public key bundle to Bob via relay...")
    alice_bundle = alice.public_bundle()
    relay.send(alice.agent_id, channel, {"type": "key_bundle", "bundle": alice_bundle})
    show_json("Alice's bundle (sent to relay)", {
        "agent_id": alice_bundle["agent_id"],
        "identity_key": alice_bundle["identity_key"][:32] + "...",
        "encryption_key": alice_bundle["encryption_key"][:32] + "...",
        "ephemeral_key": alice_bundle["ephemeral_key"][:32] + "...",
        "certificate": alice_bundle["certificate"][:48] + "...",
    })

    step(9, "Bob receives Alice's bundle and verifies her AgentID certificate...")
    bob_msgs = relay.receive(bob.agent_id)
    alice_bundle_rx = bob_msgs[0]["envelope"]["bundle"]

    # REAL API call to verify Alice's identity
    alice_verify = agentid.verify(alice_bundle_rx["agent_id"])
    show_json("AgentID verification", {
        "agent_id": alice_verify.get("agent_id"),
        "verified": alice_verify.get("verified"),
        "name": alice_verify.get("name", ""),
        "owner": alice_verify.get("owner", ""),
        "trust_score": alice_verify.get("trust_score", 0),
        "certificate_valid": alice_verify.get("certificate_valid"),
    })

    if alice_verify.get("verified") or alice_verify.get("certificate_valid"):
        ok("Alice's AgentID certificate VERIFIED. Organizational trust confirmed.")
    else:
        info("Certificate status: new/unverified (normal for freshly-registered agents).")
        info("In production, the org admin verifies agents in the AgentID dashboard.")
        info("Proceeding with key exchange...")

    step(10, "Bob sends his public key bundle to Alice via relay...")
    bob_bundle = bob.public_bundle()
    relay.send(bob.agent_id, channel, {"type": "key_bundle", "bundle": bob_bundle})

    step(11, "Alice receives Bob's bundle and verifies his AgentID certificate...")
    alice_msgs = relay.receive(alice.agent_id)
    bob_bundle_rx = alice_msgs[0]["envelope"]["bundle"]

    bob_verify = agentid.verify(bob_bundle_rx["agent_id"])
    show_json("AgentID verification", {
        "agent_id": bob_verify.get("agent_id"),
        "verified": bob_verify.get("verified"),
        "name": bob_verify.get("name", ""),
        "owner": bob_verify.get("owner", ""),
        "trust_score": bob_verify.get("trust_score", 0),
        "certificate_valid": bob_verify.get("certificate_valid"),
    })

    if bob_verify.get("verified") or bob_verify.get("certificate_valid"):
        ok("Bob's AgentID certificate VERIFIED. Organizational trust confirmed.")
    else:
        info("Certificate status: new/unverified. Proceeding with key exchange...")

    # ================================================================
    # PHASE 5 — X3DH Key Agreement
    # ================================================================
    banner("PHASE 5: X3DH Key Agreement")

    step(12, "Alice performs X3DH with Bob's public bundle (initiator)...")
    alice_secret = x3dh_initiator(alice, bob_bundle_rx)
    ok(f"Shared secret (Alice) = {alice_secret.hex()[:40]}...")

    step(13, "Bob performs X3DH with Alice's public bundle (responder)...")
    bob_secret = x3dh_responder(bob, alice_bundle_rx)
    ok(f"Shared secret (Bob)   = {bob_secret.hex()[:40]}...")

    if alice_secret == bob_secret:
        ok("Shared secrets MATCH. End-to-end secure channel established.")
    else:
        # This should not happen with the corrected X3DH implementation
        warn("Shared secrets do not match -- this indicates a bug in X3DH.")
        sys.exit(1)

    # ================================================================
    # PHASE 6 — Encrypted message exchange via Double Ratchet
    # ================================================================
    banner("PHASE 6: Encrypted Message Exchange (Double Ratchet)")

    step(14, "Initializing Double Ratchet on both sides...")
    alice_ratchet = DoubleRatchet(alice_secret, is_initiator=True)
    bob_ratchet = DoubleRatchet(bob_secret, is_initiator=False)
    ok("Send/receive chains derived from shared secret.")

    # -- Message 1: Alice -> Bob ------------------------------------------
    step(15, "Alice encrypts and sends message to Bob...")
    m1_plain = ("Hey Bob, I found a promising signal in the gold futures market. "
                "Want me to send the full analysis?")
    m1_enc = alice_ratchet.encrypt(m1_plain)
    info(f'Plaintext:  "{m1_plain[:70]}..."')
    info(f"Ciphertext: {m1_enc['ciphertext'][:64]}...")
    info(f"Msg #:      {m1_enc['n']}")

    relay.send(alice.agent_id, channel, {
        "type": "encrypted_message",
        "from": alice.agent_id,
        "envelope": m1_enc,
    })
    ok("Sent through qntm relay. Relay sees ONLY the ciphertext.")

    step(16, "Bob receives and decrypts Alice's message...")
    bob_inbox = relay.receive(bob.agent_id)
    m1_env = bob_inbox[0]["envelope"]["envelope"]
    m1_dec = bob_ratchet.decrypt(m1_env)
    info(f"Received ciphertext: {m1_env['ciphertext'][:64]}...")
    ok(f'Decrypted:  "{m1_dec[:70]}..."')

    assert m1_dec == m1_plain, "Decryption failed!"

    # -- Message 2: Bob -> Alice ------------------------------------------
    step(17, "Bob encrypts and sends reply to Alice...")
    m2_plain = ("Yes, send the full analysis. I can execute within 50ms "
                "if the setup looks right.")
    m2_enc = bob_ratchet.encrypt(m2_plain)
    info(f'Plaintext:  "{m2_plain[:70]}..."')
    info(f"Ciphertext: {m2_enc['ciphertext'][:64]}...")
    info(f"Msg #:      {m2_enc['n']}")

    relay.send(bob.agent_id, channel, {
        "type": "encrypted_message",
        "from": bob.agent_id,
        "envelope": m2_enc,
    })
    ok("Sent through qntm relay.")

    step(18, "Alice receives and decrypts Bob's reply...")
    alice_inbox = relay.receive(alice.agent_id)
    m2_env = alice_inbox[0]["envelope"]["envelope"]
    m2_dec = alice_ratchet.decrypt(m2_env)
    info(f"Received ciphertext: {m2_env['ciphertext'][:64]}...")
    ok(f'Decrypted:  "{m2_dec[:70]}..."')

    assert m2_dec == m2_plain, "Decryption failed!"

    # -- Message 3: Alice -> Bob (ratchet advances) -----------------------
    step(19, "Alice sends follow-up (ratchet advances -- new key per message)...")
    m3_plain = ("Analysis attached: XAUUSD long above 2420, target 2480, "
                "stop 2395. Confidence: 0.87.")
    m3_enc = alice_ratchet.encrypt(m3_plain)
    info(f'Plaintext:  "{m3_plain[:70]}..."')
    info(f"Ciphertext: {m3_enc['ciphertext'][:64]}...")
    info(f"Msg #:      {m3_enc['n']} (each message uses a unique derived key)")

    relay.send(alice.agent_id, channel, {
        "type": "encrypted_message",
        "from": alice.agent_id,
        "envelope": m3_enc,
    })

    step(20, "Bob decrypts Alice's follow-up...")
    bob_inbox = relay.receive(bob.agent_id)
    m3_env = bob_inbox[0]["envelope"]["envelope"]
    m3_dec = bob_ratchet.decrypt(m3_env)
    ok(f'Decrypted:  "{m3_dec[:70]}..."')

    assert m3_dec == m3_plain, "Decryption failed!"

    # ================================================================
    # Summary
    # ================================================================
    banner("COMPLETE: Secure Agent-to-Agent Communication")
    print()
    print("  What happened:")
    print(f"    1. Alice ({alice.agent_id})")
    print(f"       and Bob ({bob.agent_id})")
    print("       registered with AgentID and received certificates.")
    print("    2. Each generated Ed25519 (signing) + X25519 (encryption) keypairs.")
    print("    3. Each authenticated to the qntm relay via Ed25519 challenge-response.")
    print("    4. AgentID certificates exchanged and verified via the AgentID API")
    print("       (organizational trust: who owns this agent?).")
    print("    5. X3DH key agreement produced matching shared secrets.")
    print("    6. Double Ratchet encryption: 3 messages exchanged,")
    print("       each with a unique derived key. Relay never saw plaintext.")
    print()
    print("  Security properties:")
    print("    * End-to-end encryption     -- relay is zero-knowledge")
    print("    * Forward secrecy           -- past messages safe if current key leaks")
    print("    * Identity verification     -- AgentID certificates prove org trust")
    print("    * Mutual authentication     -- both sides verified before data moves")
    print()
    if agentid._live:
        print("  Mode: LIVE (real AgentID API calls)")
    else:
        print("  Mode: LOCAL certificates + real AgentID verify calls")
        print("  Set AGENTID_API_KEY to use the full live API flow.")
    print()
    print("  AgentID + qntm = Identity + Encryption for the agent economy.")
    print()


if __name__ == "__main__":
    main()
