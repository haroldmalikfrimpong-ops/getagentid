#!/usr/bin/env python3
"""Cross-module interop test: AgentID + qntm Python package.

Proves AgentID's DID resolver and entity verification work with qntm's
published Python package. Both libraries, same keys, same results.

Requirements: pip install qntm pynacl cryptography httpx
"""
import sys, os, hashlib
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "sdk", "python"))

from qntm import generate_identity, ed25519_public_key_to_x25519
from agentid.did import resolve_did, create_did_aps, verify_envelope_did, verify_agent_full
from agentid.ed25519 import ed25519_pub_to_x25519

print("=" * 60)
print("  Cross-Module Interop: AgentID + qntm")
print("=" * 60)
print()

# 1. Generate identity using qntm
qntm_id = generate_identity()
qntm_pub = qntm_id["publicKey"]
qntm_key_id = qntm_id["keyID"]
print(f"  qntm public key: {qntm_pub.hex()[:40]}...")
print(f"  qntm key ID:     {qntm_key_id.hex()}")

# 2. Create AgentID DID from qntm key
did = create_did_aps(qntm_pub)
print(f"  AgentID DID:     {did}")
print()

# 3. AgentID resolves DID
resolved = resolve_did(did)
assert resolved == qntm_pub, "DID resolution mismatch"
print("  [PASS] DID resolved to correct key")

# 4. Verify sender key ID
agentid_key_id = hashlib.sha256(qntm_pub).digest()[:16]
assert verify_envelope_did(agentid_key_id, did), "Envelope DID verification failed"
print("  [PASS] Envelope DID verified")

# 5. Full chain with Corpo entity
result = verify_agent_full(did, entity_id="test-entity", sender_key_id=agentid_key_id)
assert result["fully_verified"], f"Full chain failed: {result}"
print(f"  [PASS] Full chain: DID + sender + entity ({result['entity']['name']})")

# 6. X25519 derivation matches across libraries
qntm_x25519 = ed25519_public_key_to_x25519(qntm_pub)
agentid_x25519 = ed25519_pub_to_x25519(qntm_pub)
assert qntm_x25519 == agentid_x25519, "X25519 derivation mismatch"
print("  [PASS] X25519 derivation matches across libraries")

print()
print("=" * 60)
print("  ALL 6 CROSS-MODULE TESTS PASS")
print("=" * 60)
