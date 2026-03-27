"""Trust Level Conformance Tests — New Security Model

Exercises test vectors for the new trust model:
  L1 (Registered) -> L2 (Verified) -> L3 (Secured) -> L4 (Certified)

Levels are based on what security capabilities are set up, not time or score.

Run:  python test_trust_levels.py
"""

import sys
import os

# Add SDK to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "sdk", "python"))

from agentid.trust_levels import (
    TrustLevel,
    calculate_trust_level,
    check_permission,
    get_spending_limit,
    normalize_trust_level,
    level_up_requirements,
    PERMISSIONS,
    SPENDING_LIMITS,
    TRUST_LEVEL_LABELS,
)

# ── Test Vectors for the New Security Model ──────────────────────────────────

VECTORS = [
    {
        "name": "Vector 1: New agent (just registered) -> L1",
        "input": {
            "trust_score": 0,
            "verified": False,
            "certificate_valid": False,
            "entity_verified": False,
            "owner_email_verified": False,
            "created_at": "2026-03-25T00:00:00Z",
            "successful_verifications": 0,
            "ed25519_key": None,
            "wallet_address": None,
        },
        "expected_trust_level": 1,
        "expected_spending_limit": 0,
    },
    {
        "name": "Vector 2: Ed25519 key bound -> L2",
        "input": {
            "trust_score": 0,
            "verified": False,
            "certificate_valid": True,
            "entity_verified": False,
            "owner_email_verified": False,
            "created_at": "2026-03-25T00:00:00Z",
            "successful_verifications": 0,
            "ed25519_key": "ed25519:abc123publickey",
            "wallet_address": None,
        },
        "expected_trust_level": 2,
        "expected_spending_limit": 0,
    },
    {
        "name": "Vector 3: Wallet bound -> L3",
        "input": {
            "trust_score": 0.5,
            "verified": True,
            "certificate_valid": True,
            "entity_verified": False,
            "owner_email_verified": True,
            "created_at": "2026-03-20T00:00:00Z",
            "successful_verifications": 5,
            "ed25519_key": "ed25519:abc123publickey",
            "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        },
        "expected_trust_level": 3,
        "expected_spending_limit": 10000,
    },
    {
        "name": "Vector 4: Entity verified -> L4",
        "input": {
            "trust_score": 0.95,
            "verified": True,
            "certificate_valid": True,
            "entity_verified": True,
            "owner_email_verified": True,
            "created_at": "2026-02-01T00:00:00Z",
            "successful_verifications": 60,
            "ed25519_key": "ed25519:abc123publickey",
            "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        },
        "expected_trust_level": 4,
        "expected_spending_limit": 100000,
    },
    {
        "name": "Vector 5: Wallet bound but no entity -> caps at L3",
        "input": {
            "trust_score": 0.95,
            "verified": True,
            "certificate_valid": True,
            "entity_verified": False,
            "owner_email_verified": True,
            "created_at": "2026-01-01T00:00:00Z",
            "successful_verifications": 100,
            "ed25519_key": "ed25519:abc123publickey",
            "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        },
        "expected_trust_level": 3,
        "expected_spending_limit": 10000,
    },
    {
        "name": "Vector 6: Entity verified but no wallet/key -> still L4 (entity trumps)",
        "input": {
            "trust_score": 0,
            "verified": False,
            "certificate_valid": False,
            "entity_verified": True,
            "owner_email_verified": False,
            "created_at": "2026-03-25T00:00:00Z",
            "successful_verifications": 0,
            "ed25519_key": None,
            "wallet_address": None,
        },
        "expected_trust_level": 4,
        "expected_spending_limit": 100000,
    },
]

# ── Edge cases ───────────────────────────────────────────────────────────────

EDGE_CASES = [
    {
        "name": "Edge: No Ed25519 key, no wallet -> L1",
        "input": {
            "trust_score": 0.95,
            "verified": True,
            "certificate_valid": True,
            "entity_verified": False,
            "owner_email_verified": True,
            "created_at": "2025-01-01T00:00:00Z",
            "successful_verifications": 200,
            "ed25519_key": None,
            "wallet_address": None,
        },
        "expected_trust_level": 1,
        "expected_spending_limit": 0,
    },
    {
        "name": "Edge: Empty ed25519_key string -> L1",
        "input": {
            "trust_score": 0.5,
            "verified": False,
            "certificate_valid": True,
            "entity_verified": False,
            "owner_email_verified": True,
            "created_at": "2026-01-01T00:00:00Z",
            "successful_verifications": 0,
            "ed25519_key": "",
            "wallet_address": "",
        },
        "expected_trust_level": 1,
        "expected_spending_limit": 0,
    },
    {
        "name": "Edge: Ed25519 key but empty wallet -> L2",
        "input": {
            "trust_score": 0.7,
            "verified": True,
            "certificate_valid": True,
            "entity_verified": False,
            "owner_email_verified": True,
            "created_at": "2026-03-19T00:00:00Z",
            "successful_verifications": 10,
            "ed25519_key": "ed25519:somekey",
            "wallet_address": "",
        },
        "expected_trust_level": 2,
        "expected_spending_limit": 0,
    },
    {
        "name": "Edge: Legacy L0 backward compatibility",
        "input_level": 0,
        "expected_normalized": 1,
    },
]


def run_tests():
    """Run all conformance test vectors."""
    passed = 0
    failed = 0
    total = 0

    print("=" * 60)
    print("  AgentID Trust Level Tests — New Security Model")
    print("=" * 60)

    # Spec vectors
    print("\n-- Core Test Vectors --\n")
    for v in VECTORS:
        level = calculate_trust_level(v["input"])
        limit = get_spending_limit(level)
        ok = int(level) == v["expected_trust_level"] and limit == v["expected_spending_limit"]

        status = "PASS" if ok else "FAIL"
        print(f"  [{status}] {v['name']}")
        if not ok:
            print(f"         Expected: L{v['expected_trust_level']} / ${v['expected_spending_limit']}")
            print(f"         Got:      L{int(level)} / ${limit}")
            failed += 1
        else:
            passed += 1
        total += 1

    # Edge cases
    print("\n-- Edge Cases --\n")
    for v in EDGE_CASES:
        if "input" in v:
            level = calculate_trust_level(v["input"])
            limit = get_spending_limit(level)
            ok = int(level) == v["expected_trust_level"] and limit == v["expected_spending_limit"]

            status = "PASS" if ok else "FAIL"
            print(f"  [{status}] {v['name']}")
            if not ok:
                print(f"         Expected: L{v['expected_trust_level']} / ${v['expected_spending_limit']}")
                print(f"         Got:      L{int(level)} / ${limit}")
                failed += 1
            else:
                passed += 1
        elif "input_level" in v:
            normalized = normalize_trust_level(v["input_level"])
            ok = int(normalized) == v["expected_normalized"]
            status = "PASS" if ok else "FAIL"
            print(f"  [{status}] {v['name']}")
            if not ok:
                print(f"         Expected: L{v['expected_normalized']}")
                print(f"         Got:      L{int(normalized)}")
                failed += 1
            else:
                passed += 1
        total += 1

    # Permission set validation
    print("\n-- Permission Set Validation --\n")
    perm_ok = True
    # L1 must have connect and send_message (all basic actions from day one)
    for action in ["read", "discover", "verify", "send_message", "connect"]:
        if action not in PERMISSIONS[TrustLevel.L1_REGISTERED]:
            print(f"  [FAIL] L1 must have '{action}'")
            perm_ok = False
    # L2 must have challenge_response and handle_data
    for action in ["challenge_response", "handle_data"]:
        if action not in PERMISSIONS[TrustLevel.L2_VERIFIED]:
            print(f"  [FAIL] L2 must have '{action}'")
            perm_ok = False
    # L3 must have make_payment and access_paid_service
    for action in ["make_payment", "access_paid_service"]:
        if action not in PERMISSIONS[TrustLevel.L3_SECURED]:
            print(f"  [FAIL] L3 must have '{action}'")
            perm_ok = False
    # L3 must NOT have sign_contract
    if "sign_contract" in PERMISSIONS[TrustLevel.L3_SECURED]:
        print("  [FAIL] L3 must not have sign_contract")
        perm_ok = False
    # L4 must have full_autonomy
    if "full_autonomy" not in PERMISSIONS[TrustLevel.L4_CERTIFIED]:
        print("  [FAIL] L4 must have full_autonomy")
        perm_ok = False
    # Cumulative: each level must include all permissions from lower levels
    levels = [TrustLevel.L1_REGISTERED, TrustLevel.L2_VERIFIED, TrustLevel.L3_SECURED, TrustLevel.L4_CERTIFIED]
    for i in range(1, len(levels)):
        lower = set(PERMISSIONS[levels[i - 1]])
        upper = set(PERMISSIONS[levels[i]])
        if not lower.issubset(upper):
            print(f"  [FAIL] L{int(levels[i])} does not include all L{int(levels[i-1])} permissions")
            perm_ok = False

    if perm_ok:
        print("  [PASS] All permission sets valid")
        passed += 1
    else:
        failed += 1
    total += 1

    # Spending limit validation
    print("\n-- Spending Limit Validation --\n")
    expected_limits = {1: 0, 2: 0, 3: 10000, 4: 100000}
    limits_ok = True
    for lvl, expected in expected_limits.items():
        actual = SPENDING_LIMITS[TrustLevel(lvl)]
        if actual != expected:
            print(f"  [FAIL] L{lvl}: expected ${expected}, got ${actual}")
            limits_ok = False
    if limits_ok:
        print("  [PASS] All spending limits valid")
        passed += 1
    else:
        failed += 1
    total += 1

    # Label validation
    print("\n-- Label Validation --\n")
    expected_labels = {
        1: "L1 — Registered",
        2: "L2 — Verified",
        3: "L3 — Secured",
        4: "L4 — Certified",
    }
    labels_ok = True
    for lvl, expected in expected_labels.items():
        actual = TRUST_LEVEL_LABELS[TrustLevel(lvl)]
        if actual != expected:
            print(f"  [FAIL] L{lvl}: expected '{expected}', got '{actual}'")
            labels_ok = False
    if labels_ok:
        print("  [PASS] All labels valid")
        passed += 1
    else:
        failed += 1
    total += 1

    # Level-up requirements validation
    print("\n-- Level-Up Requirements --\n")
    levelup_ok = True
    req_l1 = level_up_requirements(TrustLevel.L1_REGISTERED)
    if req_l1["next_level"] != 2:
        print(f"  [FAIL] L1 next_level should be 2, got {req_l1['next_level']}")
        levelup_ok = False
    if "ed25519" not in req_l1["requirements"][0].lower():
        print(f"  [FAIL] L1 requirement should mention Ed25519")
        levelup_ok = False

    req_l2 = level_up_requirements(TrustLevel.L2_VERIFIED)
    if req_l2["next_level"] != 3:
        print(f"  [FAIL] L2 next_level should be 3, got {req_l2['next_level']}")
        levelup_ok = False
    if "wallet" not in req_l2["requirements"][0].lower():
        print(f"  [FAIL] L2 requirement should mention wallet")
        levelup_ok = False

    req_l3 = level_up_requirements(TrustLevel.L3_SECURED)
    if req_l3["next_level"] != 4:
        print(f"  [FAIL] L3 next_level should be 4, got {req_l3['next_level']}")
        levelup_ok = False
    if "entity" not in req_l3["requirements"][0].lower():
        print(f"  [FAIL] L3 requirement should mention entity")
        levelup_ok = False

    req_l4 = level_up_requirements(TrustLevel.L4_CERTIFIED)
    if req_l4["next_level"] is not None:
        print(f"  [FAIL] L4 next_level should be None, got {req_l4['next_level']}")
        levelup_ok = False

    if levelup_ok:
        print("  [PASS] All level-up requirements valid")
        passed += 1
    else:
        failed += 1
    total += 1

    # Backward compatibility validation
    print("\n-- Backward Compatibility --\n")
    compat_ok = True
    # Old L0 should normalize to L1
    if normalize_trust_level(0) != TrustLevel.L1_REGISTERED:
        print("  [FAIL] Legacy L0 should normalize to L1")
        compat_ok = False
    # check_permission with level 0 should still work (mapped to L1)
    if not check_permission(0, "connect"):
        print("  [FAIL] Legacy L0 (mapped to L1) should have connect permission")
        compat_ok = False
    if not check_permission(0, "send_message"):
        print("  [FAIL] Legacy L0 (mapped to L1) should have send_message permission")
        compat_ok = False
    if compat_ok:
        print("  [PASS] Backward compatibility valid")
        passed += 1
    else:
        failed += 1
    total += 1

    # Summary
    print(f"\n{'=' * 60}")
    print(f"  Results: {passed}/{total} passed, {failed} failed")
    print(f"{'=' * 60}")

    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
