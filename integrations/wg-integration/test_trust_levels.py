"""Trust Level Conformance Tests — ATL-1 Spec §8

Exercises all 6 test vectors from Agent Trust Levels v1.0 spec.
Validates that calculate_trust_level() produces the expected level,
and that PERMISSIONS and SPENDING_LIMITS match the spec.

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
    PERMISSIONS,
    SPENDING_LIMITS,
)

# ── Test Vectors from ATL-1 §8 ──────────────────────────────────────────────

VECTORS = [
    {
        "name": "Vector 1: New agent -> L0",
        "input": {
            "trust_score": 0,
            "verified": False,
            "certificate_valid": False,
            "entity_verified": False,
            "owner_email_verified": False,
            "created_at": "2026-03-25T00:00:00Z",
            "successful_verifications": 0,
        },
        "expected_trust_level": 0,
        "expected_spending_limit": 0,
    },
    {
        "name": "Vector 2: Email verified -> L1",
        "input": {
            "trust_score": 0,
            "verified": False,
            "certificate_valid": False,
            "entity_verified": False,
            "owner_email_verified": True,
            "created_at": "2026-03-25T00:00:00Z",
            "successful_verifications": 0,
        },
        "expected_trust_level": 1,
        "expected_spending_limit": 0,
    },
    {
        "name": "Vector 3: Certificate + verification -> L2",
        "input": {
            "trust_score": 0.5,
            "verified": True,
            "certificate_valid": True,
            "entity_verified": False,
            "owner_email_verified": True,
            "created_at": "2026-03-20T00:00:00Z",
            "successful_verifications": 5,
        },
        "expected_trust_level": 2,
        "expected_spending_limit": 0,
    },
    {
        "name": "Vector 4: Trusted agent -> L3",
        "input": {
            "trust_score": 0.8,
            "verified": True,
            "certificate_valid": True,
            "entity_verified": False,
            "owner_email_verified": True,
            "created_at": "2026-03-10T00:00:00Z",
            "successful_verifications": 15,
        },
        "expected_trust_level": 3,
        "expected_spending_limit": 100,
    },
    {
        "name": "Vector 5: Full authority -> L4",
        "input": {
            "trust_score": 0.95,
            "verified": True,
            "certificate_valid": True,
            "entity_verified": True,
            "owner_email_verified": True,
            "created_at": "2026-02-01T00:00:00Z",
            "successful_verifications": 60,
        },
        "expected_trust_level": 4,
        "expected_spending_limit": 10000,
    },
    {
        "name": "Vector 6: High trust but no entity -> caps at L3",
        "input": {
            "trust_score": 0.95,
            "verified": True,
            "certificate_valid": True,
            "entity_verified": False,
            "owner_email_verified": True,
            "created_at": "2026-01-01T00:00:00Z",
            "successful_verifications": 100,
        },
        "expected_trust_level": 3,
        "expected_spending_limit": 100,
    },
]

# ── Additional edge case tests ───────────────────────────────────────────────

EDGE_CASES = [
    {
        "name": "Edge: High score but no certificate -> L1",
        "input": {
            "trust_score": 0.95,
            "verified": True,
            "certificate_valid": False,
            "entity_verified": True,
            "owner_email_verified": True,
            "created_at": "2025-01-01T00:00:00Z",
            "successful_verifications": 200,
        },
        "expected_trust_level": 1,
        "expected_spending_limit": 0,
    },
    {
        "name": "Edge: Certificate but 0 verifications -> L1",
        "input": {
            "trust_score": 0.5,
            "verified": False,
            "certificate_valid": True,
            "entity_verified": False,
            "owner_email_verified": True,
            "created_at": "2026-01-01T00:00:00Z",
            "successful_verifications": 0,
        },
        "expected_trust_level": 1,
        "expected_spending_limit": 0,
    },
    {
        "name": "Edge: Exactly on L3 thresholds -> L3",
        "input": {
            "trust_score": 0.7,
            "verified": True,
            "certificate_valid": True,
            "entity_verified": False,
            "owner_email_verified": True,
            "created_at": "2026-03-19T00:00:00Z",
            "successful_verifications": 10,
        },
        "expected_trust_level": 3,
        "expected_spending_limit": 100,
    },
    {
        "name": "Edge: Just below L3 score -> L2",
        "input": {
            "trust_score": 0.69,
            "verified": True,
            "certificate_valid": True,
            "entity_verified": False,
            "owner_email_verified": True,
            "created_at": "2026-01-01T00:00:00Z",
            "successful_verifications": 50,
        },
        "expected_trust_level": 2,
        "expected_spending_limit": 0,
    },
]


def run_tests():
    """Run all conformance test vectors."""
    passed = 0
    failed = 0
    total = len(VECTORS) + len(EDGE_CASES)

    print("=" * 60)
    print("  AgentID Trust Level Conformance Tests - ATL-1 S8")
    print("=" * 60)

    # Spec vectors (CR-6: all MUST produce expected level)
    print("\n-- Spec Test Vectors (S8) --\n")
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

    # Edge cases
    print("\n-- Edge Cases --\n")
    for v in EDGE_CASES:
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

    # Permission set validation (CR-2)
    print("\n-- Permission Set Validation (CR-2) --\n")
    perm_ok = True
    # L0 must have no permissions
    if PERMISSIONS[TrustLevel.L0_UNVERIFIED] != []:
        print("  [FAIL] L0 should have empty permissions")
        perm_ok = False
    # L2 must NOT have handle_data
    if "handle_data" in PERMISSIONS[TrustLevel.L2_VERIFIED]:
        print("  [FAIL] L2 must not have handle_data")
        perm_ok = False
    # L3 must NOT have sign_contract
    if "sign_contract" in PERMISSIONS[TrustLevel.L3_TRUSTED]:
        print("  [FAIL] L3 must not have sign_contract")
        perm_ok = False
    # L4 must have full_autonomy
    if "full_autonomy" not in PERMISSIONS[TrustLevel.L4_FULL_AUTHORITY]:
        print("  [FAIL] L4 must have full_autonomy")
        perm_ok = False
    # Cumulative: each level must include all permissions from lower levels
    for i in range(1, 5):
        lower = set(PERMISSIONS[TrustLevel(i - 1)])
        upper = set(PERMISSIONS[TrustLevel(i)])
        if not lower.issubset(upper):
            print(f"  [FAIL] L{i} does not include all L{i-1} permissions")
            perm_ok = False

    if perm_ok:
        print("  [PASS] All permission sets valid")
        passed += 1
    else:
        failed += 1
    total += 1

    # Spending limit validation (CR-3)
    print("\n-- Spending Limit Validation (CR-3) --\n")
    expected_limits = {0: 0, 1: 0, 2: 0, 3: 100, 4: 10000}
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

    # Summary
    print(f"\n{'=' * 60}")
    print(f"  Results: {passed}/{total} passed, {failed} failed")
    print(f"{'=' * 60}")

    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
