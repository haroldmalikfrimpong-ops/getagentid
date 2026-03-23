#!/usr/bin/env python3
"""DID cross-verification test: AgentID <-> APS interop.

Proves that:
  1. AgentID can resolve a did:aps DID and extract the Ed25519 public key
  2. APS can resolve a did:agentid DID and extract the Ed25519 public key
  3. Both sign the same challenge and cross-verify
  4. A second (APS-only) keypair can be verified by AgentID

Outputs test vectors (deterministic keypair, DID, challenge, signature) that
the APS TypeScript side can use for cross-platform validation.
"""

import json
import sys
import os
from datetime import datetime, timezone

# Ensure the SDK is importable from the repo root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "sdk", "python"))

from agentid.ed25519 import Ed25519Identity
from agentid.did import (
    create_did_agentid,
    create_did_aps,
    resolve_did_agentid,
    resolve_did_aps,
    resolve_did,
    sign_with_did,
    verify_with_did,
    register_agentid_key,
    clear_agentid_registry,
    _b58encode,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
results = []


def check(name: str, condition: bool, detail: str = ""):
    """Record and print a test result."""
    status = PASS if condition else FAIL
    results.append({"name": name, "passed": condition, "detail": detail})
    extra = f"  ({detail})" if detail else ""
    print(f"  [{status}] {name}{extra}")


# ---------------------------------------------------------------------------
# Main test
# ---------------------------------------------------------------------------

def main():
    clear_agentid_registry()

    print("=" * 72)
    print("  DID Cross-Verification Test: AgentID <-> APS Interop")
    print("=" * 72)
    print()

    # ------------------------------------------------------------------
    # 1. Generate an AgentID Ed25519 identity
    # ------------------------------------------------------------------
    print("--- Step 1: Generate AgentID identity ---")
    agent_id = "agent_interop_test_001"
    identity = Ed25519Identity.generate()
    pub_key = identity.ed25519_public_key
    print(f"  Agent ID:        {agent_id}")
    print(f"  Ed25519 pub key: {pub_key.hex()}")
    print()

    # ------------------------------------------------------------------
    # 2. Create did:agentid and register key
    # ------------------------------------------------------------------
    print("--- Step 2: Create DIDs ---")
    did_agentid = create_did_agentid(agent_id)
    register_agentid_key(agent_id, pub_key)
    print(f"  did:agentid = {did_agentid}")

    # ------------------------------------------------------------------
    # 3. Create did:aps from the SAME public key
    # ------------------------------------------------------------------
    did_aps = create_did_aps(pub_key)
    print(f"  did:aps     = {did_aps}")
    print()

    # ------------------------------------------------------------------
    # 4. Define challenge payload
    # ------------------------------------------------------------------
    print("--- Step 3: Challenge payload ---")
    timestamp = datetime.now(timezone.utc).isoformat()
    challenge_obj = {
        "challenge": "did-interop-test",
        "timestamp": timestamp,
        "systems": ["agentid", "aps"],
    }
    challenge_bytes = json.dumps(
        challenge_obj, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    print(f"  Payload:    {challenge_obj}")
    print(f"  Canonical:  {challenge_bytes.decode()}")
    print()

    # ------------------------------------------------------------------
    # 5. Sign the challenge
    # ------------------------------------------------------------------
    print("--- Step 4: Sign challenge ---")
    signature = sign_with_did(challenge_bytes, identity.seed)
    print(f"  Signature:  {signature.hex()}")
    print()

    # ------------------------------------------------------------------
    # 6. Verify from AgentID DID side
    # ------------------------------------------------------------------
    print("--- Step 5: Cross-verification ---")
    key_from_agentid = resolve_did_agentid(did_agentid)
    check(
        "AgentID DID resolves correct key",
        key_from_agentid == pub_key,
        f"resolved {key_from_agentid.hex()[:16]}...",
    )

    agentid_ok = verify_with_did(challenge_bytes, signature, did_agentid)
    check("Verify signature via did:agentid", agentid_ok)

    # ------------------------------------------------------------------
    # 7. Verify from APS DID side
    # ------------------------------------------------------------------
    key_from_aps = resolve_did_aps(did_aps)
    check(
        "APS DID resolves correct key",
        key_from_aps == pub_key,
        f"resolved {key_from_aps.hex()[:16]}...",
    )

    aps_ok = verify_with_did(challenge_bytes, signature, did_aps)
    check("Verify signature via did:aps", aps_ok)

    # Both keys must be identical
    check(
        "Both DIDs resolve to same key",
        key_from_agentid == key_from_aps,
    )
    print()

    # ------------------------------------------------------------------
    # 8. Second keypair: APS-only agent
    # ------------------------------------------------------------------
    print("--- Step 6: APS-only agent ---")
    aps_identity = Ed25519Identity.generate()
    aps_pub = aps_identity.ed25519_public_key
    aps_did = create_did_aps(aps_pub)
    print(f"  APS-only pub key: {aps_pub.hex()}")
    print(f"  APS-only DID:     {aps_did}")

    # Sign the same challenge with the APS-only key
    aps_sig = sign_with_did(challenge_bytes, aps_identity.seed)
    print(f"  Signature:        {aps_sig.hex()}")

    # AgentID extracts key from did:aps and verifies
    aps_resolved = resolve_did_aps(aps_did)
    check(
        "AgentID resolves APS-only DID",
        aps_resolved == aps_pub,
    )

    aps_verify = verify_with_did(challenge_bytes, aps_sig, aps_did)
    check("AgentID verifies APS-only signature", aps_verify)

    # Negative: the APS-only signature must NOT verify under the original DID
    cross_fail = verify_with_did(challenge_bytes, aps_sig, did_agentid)
    check(
        "APS-only sig rejected by original AgentID DID",
        cross_fail is False,
    )
    print()

    # ------------------------------------------------------------------
    # 9. Test vectors (deterministic, for TypeScript side)
    # ------------------------------------------------------------------
    print("--- Step 7: Deterministic test vectors ---")
    # Use a fixed seed so both Python and TypeScript produce the same output
    FIXED_SEED = bytes.fromhex(
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    )
    tv_identity = Ed25519Identity.from_seed(FIXED_SEED)
    tv_pub = tv_identity.ed25519_public_key
    tv_agent_id = "tv-agent-001"
    tv_did_agentid = create_did_agentid(tv_agent_id)
    tv_did_aps = create_did_aps(tv_pub)
    register_agentid_key(tv_agent_id, tv_pub)

    tv_challenge = json.dumps({
        "challenge": "deterministic-interop-vector",
        "nonce": "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
        "systems": ["agentid", "aps"],
    }, sort_keys=True, separators=(",", ":")).encode("utf-8")

    tv_sig = sign_with_did(tv_challenge, tv_identity.seed)

    # Verify both ways
    tv_ok_agentid = verify_with_did(tv_challenge, tv_sig, tv_did_agentid)
    tv_ok_aps = verify_with_did(tv_challenge, tv_sig, tv_did_aps)
    check("Test vector verifies via did:agentid", tv_ok_agentid)
    check("Test vector verifies via did:aps", tv_ok_aps)
    print()

    # Print the test vectors in a format ready for TypeScript
    test_vectors = {
        "description": "Deterministic AgentID <-> APS interop test vector",
        "seed_hex": FIXED_SEED.hex(),
        "ed25519_public_key_hex": tv_pub.hex(),
        "did_agentid": tv_did_agentid,
        "did_aps": tv_did_aps,
        "challenge_canonical": tv_challenge.decode("utf-8"),
        "challenge_hex": tv_challenge.hex(),
        "signature_hex": tv_sig.hex(),
        "base58btc_public_key": _b58encode(tv_pub),
    }

    print("--- Test Vectors (for TypeScript / APS side) ---")
    print(json.dumps(test_vectors, indent=2))
    print()

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    failed = total - passed

    print("=" * 72)
    if failed == 0:
        print(f"  ALL {total} CHECKS PASSED")
    else:
        print(f"  {passed}/{total} passed, {failed} FAILED")
        for r in results:
            if not r["passed"]:
                print(f"    FAILED: {r['name']}")
    print("=" * 72)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
