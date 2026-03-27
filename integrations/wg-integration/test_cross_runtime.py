"""Cross-Runtime Verification Tests -- Python vs TypeScript Conformance

Addresses desiorac's WG feedback: are the Python and TypeScript RuntimeVerifier
implementations byte-identical in their chain computations?

This test validates the Python side and documents the expected outputs so the
TypeScript implementation can be validated against them independently.

Tests:
  1. _extract_agent_id() produces identical results for all 4 DID formats
  2. _calculate_level_from_score() fallback produces identical results for edge cases
  3. PERMISSIONS and SPENDING_LIMITS match between Python constants and TypeScript definitions
  4. RuntimeVerification dataclass new fields (execution_timestamp, pinned_public_key, scope)

Run:  python test_cross_runtime.py
"""

import sys
import os
import json
from datetime import datetime, timezone

# Add SDK to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "sdk", "python"))

from agentid.trust_levels import (
    TrustLevel,
    PERMISSIONS,
    SPENDING_LIMITS,
)

# Import internal helpers from the runtime verifier
sys.path.insert(0, os.path.dirname(__file__))
from runtime_verifier import (
    _extract_agent_id,
    _calculate_level_from_score,
    RuntimeVerification,
)


# ============================================================================
# Expected values -- TypeScript MUST produce these same results
# ============================================================================

# DID extraction: input -> expected output
EXTRACT_AGENT_ID_VECTORS = [
    ("did:agentid:agent-007", "agent-007"),
    ("did:aps:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK", "z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"),
    ("did:key:z6MkpTHR8VNs5zYEcVvTPmYHr5Nuf3YYWH6HGRoq7S4gkj9", "z6MkpTHR8VNs5zYEcVvTPmYHr5Nuf3YYWH6HGRoq7S4gkj9"),
    ("did:web:example.com", "example.com"),
    # Edge: unknown method returns None/null
    ("did:unknown:something", None),
    # Edge: empty string returns None/null
    ("", None),
    # Edge: bare string without did: prefix
    ("agent-007", None),
]

# Trust level fallback calculation: (score, entity_verified) -> expected level
# These are the boundary values where off-by-one or float comparison bugs appear
LEVEL_FROM_SCORE_VECTORS = [
    # (trust_score, entity_verified, expected_level, description)
    # New model: fallback uses scores as rough estimate, minimum L1
    (0.0, False, 1, "zero score, no entity -> L1 (minimum in new model)"),
    (0.0, True, 4, "zero score, with entity -> L4 (entity trumps)"),
    (0.39, False, 1, "just below 0.4, no entity -> L1"),
    (0.39, True, 4, "just below 0.4, with entity -> L4 (entity trumps)"),
    (0.4, False, 2, "exactly 0.4, no entity -> L2"),
    (0.4, True, 4, "exactly 0.4, with entity -> L4 (entity trumps)"),
    (0.69, False, 2, "just below 0.7, no entity -> L2"),
    (0.69, True, 4, "just below 0.7, with entity -> L4 (entity trumps)"),
    (0.7, False, 3, "exactly 0.7, no entity -> L3"),
    (0.7, True, 4, "exactly 0.7, with entity -> L4 (entity trumps)"),
    (0.89, False, 3, "just below 0.9, no entity -> L3"),
    (0.89, True, 4, "just below 0.9, with entity -> L4 (entity trumps)"),
    (0.9, False, 3, "exactly 0.9, no entity -> L3"),
    (0.9, True, 4, "exactly 0.9, with entity -> L4"),
    (1.0, False, 3, "max score, no entity -> L3"),
    (1.0, True, 4, "max score, with entity -> L4"),
]

# Permissions: level -> sorted list of permissions
# Both runtimes MUST produce exactly this
EXPECTED_PERMISSIONS = {
    1: ["read", "discover", "verify", "send_message", "connect"],
    2: ["read", "discover", "verify", "send_message", "connect",
        "challenge_response", "handle_data"],
    3: [
        "read", "discover", "verify", "send_message", "connect",
        "challenge_response", "handle_data",
        "make_payment", "access_paid_service",
    ],
    4: [
        "read", "discover", "verify", "send_message", "connect",
        "challenge_response", "handle_data",
        "make_payment", "access_paid_service",
        "sign_contract", "manage_funds", "full_autonomy",
    ],
}

# Spending limits: level -> USD
EXPECTED_SPENDING_LIMITS = {
    1: 0,
    2: 0,
    3: 10000,
    4: 100000,
}


# ============================================================================
# Test runner
# ============================================================================

def test_extract_agent_id():
    """Test _extract_agent_id() for all 4 DID formats + edge cases."""
    passed = 0
    failed = 0

    print("\n-- Test: _extract_agent_id() across DID formats --\n")
    for did_input, expected in EXTRACT_AGENT_ID_VECTORS:
        actual = _extract_agent_id(did_input)
        ok = actual == expected

        display_input = did_input if did_input else "(empty string)"
        display_expected = expected if expected is not None else "None"
        display_actual = actual if actual is not None else "None"

        if ok:
            print(f"  [PASS] {display_input} -> {display_actual}")
            passed += 1
        else:
            print(f"  [FAIL] {display_input}")
            print(f"         Expected: {display_expected}")
            print(f"         Got:      {display_actual}")
            failed += 1

    return passed, failed


def test_calculate_level_from_score():
    """Test _calculate_level_from_score() for boundary values."""
    passed = 0
    failed = 0

    print("\n-- Test: _calculate_level_from_score() edge cases --\n")
    for score, entity, expected_level, desc in LEVEL_FROM_SCORE_VECTORS:
        actual = _calculate_level_from_score(score, entity)
        ok = actual == expected_level

        if ok:
            print(f"  [PASS] score={score}, entity={entity} -> L{actual} ({desc})")
            passed += 1
        else:
            print(f"  [FAIL] {desc}")
            print(f"         score={score}, entity={entity}")
            print(f"         Expected: L{expected_level}")
            print(f"         Got:      L{actual}")
            failed += 1

    return passed, failed


def test_permissions_match():
    """Test that Python PERMISSIONS match the expected cross-runtime values."""
    passed = 0
    failed = 0

    print("\n-- Test: PERMISSIONS cross-runtime match --\n")
    for level in range(1, 5):
        tl = TrustLevel(level)
        py_perms = list(PERMISSIONS.get(tl, []))
        expected = EXPECTED_PERMISSIONS[level]
        ok = py_perms == expected

        if ok:
            print(f"  [PASS] L{level}: {len(py_perms)} permissions")
            passed += 1
        else:
            print(f"  [FAIL] L{level}")
            print(f"         Expected: {expected}")
            print(f"         Got:      {py_perms}")
            failed += 1

    return passed, failed


def test_spending_limits_match():
    """Test that Python SPENDING_LIMITS match the expected cross-runtime values."""
    passed = 0
    failed = 0

    print("\n-- Test: SPENDING_LIMITS cross-runtime match --\n")
    for level in range(1, 5):
        tl = TrustLevel(level)
        py_limit = SPENDING_LIMITS.get(tl, 0)
        expected = EXPECTED_SPENDING_LIMITS[level]
        ok = py_limit == expected

        if ok:
            print(f"  [PASS] L{level}: ${py_limit}")
            passed += 1
        else:
            print(f"  [FAIL] L{level}")
            print(f"         Expected: ${expected}")
            print(f"         Got:      ${py_limit}")
            failed += 1

    return passed, failed


def test_runtime_verification_new_fields():
    """Test that RuntimeVerification has the new binding fields with correct defaults."""
    passed = 0
    failed = 0

    print("\n-- Test: RuntimeVerification new binding fields --\n")

    rv = RuntimeVerification()

    # execution_timestamp defaults to empty string
    if rv.execution_timestamp == "":
        print("  [PASS] execution_timestamp defaults to empty string")
        passed += 1
    else:
        print(f"  [FAIL] execution_timestamp default: expected '', got '{rv.execution_timestamp}'")
        failed += 1

    # pinned_public_key defaults to empty string
    if rv.pinned_public_key == "":
        print("  [PASS] pinned_public_key defaults to empty string")
        passed += 1
    else:
        print(f"  [FAIL] pinned_public_key default: expected '', got '{rv.pinned_public_key}'")
        failed += 1

    # scope defaults to None
    if rv.scope is None:
        print("  [PASS] scope defaults to None")
        passed += 1
    else:
        print(f"  [FAIL] scope default: expected None, got '{rv.scope}'")
        failed += 1

    # to_dict() includes the new fields
    d = rv.to_dict()
    for field_name in ("execution_timestamp", "pinned_public_key", "scope"):
        if field_name in d:
            print(f"  [PASS] to_dict() includes '{field_name}'")
            passed += 1
        else:
            print(f"  [FAIL] to_dict() missing '{field_name}'")
            failed += 1

    # Verify that existing fields still work
    rv2 = RuntimeVerification(
        verified=True,
        trust_level=3,
        trust_score=0.85,
        permissions=["read", "discover"],
        spending_limit=100,
        did_resolution_status="live",
        entity_verified=True,
        execution_timestamp="2026-03-26T12:00:00Z",
        pinned_public_key="abcdef1234567890",
        scope="payments:read",
    )
    d2 = rv2.to_dict()
    if d2["execution_timestamp"] == "2026-03-26T12:00:00Z":
        print("  [PASS] execution_timestamp round-trips through to_dict()")
        passed += 1
    else:
        print(f"  [FAIL] execution_timestamp round-trip failed")
        failed += 1

    if d2["pinned_public_key"] == "abcdef1234567890":
        print("  [PASS] pinned_public_key round-trips through to_dict()")
        passed += 1
    else:
        print(f"  [FAIL] pinned_public_key round-trip failed")
        failed += 1

    if d2["scope"] == "payments:read":
        print("  [PASS] scope round-trips through to_dict()")
        passed += 1
    else:
        print(f"  [FAIL] scope round-trip failed")
        failed += 1

    return passed, failed


def test_json_serialization_determinism():
    """Test that JSON serialization of RuntimeVerification is deterministic.

    This is the core of desiorac's concern: if Python and TypeScript produce
    different JSON byte sequences for the same logical data, any hash or
    signature over the serialized form will diverge.

    We document the expected JSON key order and format so TypeScript can be
    validated against it.
    """
    passed = 0
    failed = 0

    print("\n-- Test: JSON serialization determinism --\n")

    rv = RuntimeVerification(
        verified=True,
        trust_level=3,
        trust_score=0.85,
        permissions=["read", "discover", "verify", "send_message", "connect",
                      "challenge_response", "handle_data",
                      "make_payment", "access_paid_service"],
        spending_limit=10000,
        did_resolution_status="live",
        entity_verified=True,
        execution_timestamp="2026-03-26T12:00:00Z",
        pinned_public_key="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        scope="payments:read",
    )

    d = rv.to_dict()

    # Python's dataclasses.asdict preserves field declaration order
    expected_key_order = [
        "verified", "trust_level", "trust_score", "permissions",
        "spending_limit", "did_resolution_status", "entity_verified",
        "execution_timestamp", "pinned_public_key", "scope",
    ]
    actual_keys = list(d.keys())

    if actual_keys == expected_key_order:
        print("  [PASS] JSON key order matches declaration order")
        passed += 1
    else:
        print(f"  [FAIL] JSON key order mismatch")
        print(f"         Expected: {expected_key_order}")
        print(f"         Got:      {actual_keys}")
        failed += 1

    # Test that json.dumps with sort_keys produces stable output
    canonical = json.dumps(d, sort_keys=True, separators=(",", ":"))
    expected_canonical = (
        '{"did_resolution_status":"live",'
        '"entity_verified":true,'
        '"execution_timestamp":"2026-03-26T12:00:00Z",'
        '"permissions":["read","discover","verify","send_message","connect",'
        '"challenge_response","handle_data","make_payment","access_paid_service"],'
        '"pinned_public_key":"abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",'
        '"scope":"payments:read",'
        '"spending_limit":10000,'
        '"trust_level":3,'
        '"trust_score":0.85,'
        '"verified":true}'
    )

    if canonical == expected_canonical:
        print("  [PASS] Canonical JSON (sort_keys) matches expected byte sequence")
        passed += 1
    else:
        print(f"  [FAIL] Canonical JSON mismatch")
        print(f"         Expected: {expected_canonical}")
        print(f"         Got:      {canonical}")
        failed += 1

    # Document the expected output for TypeScript validation
    print("\n  -- Expected canonical JSON for TypeScript validation --")
    print(f"  {canonical}")

    return passed, failed


def run_tests():
    """Run all cross-runtime conformance tests."""
    total_passed = 0
    total_failed = 0

    print("=" * 70)
    print("  Cross-Runtime Verification Tests -- Python vs TypeScript Conformance")
    print("  Addresses desiorac's WG feedback on byte-level divergence")
    print("=" * 70)

    test_functions = [
        test_extract_agent_id,
        test_calculate_level_from_score,
        test_permissions_match,
        test_spending_limits_match,
        test_runtime_verification_new_fields,
        test_json_serialization_determinism,
    ]

    for test_fn in test_functions:
        p, f = test_fn()
        total_passed += p
        total_failed += f

    total = total_passed + total_failed
    print(f"\n{'=' * 70}")
    print(f"  Results: {total_passed}/{total} passed, {total_failed} failed")
    print(f"{'=' * 70}")

    # Print the reference values for TypeScript validation
    print("\n" + "=" * 70)
    print("  REFERENCE VALUES FOR TYPESCRIPT CONFORMANCE")
    print("  TypeScript tests MUST produce these exact same results")
    print("=" * 70)

    print("\n  -- extractAgentId() --")
    for did_input, expected in EXTRACT_AGENT_ID_VECTORS:
        display = did_input if did_input else "(empty)"
        result = expected if expected is not None else "null"
        print(f"    {display} -> {result}")

    print("\n  -- estimateTrustLevel(score, entityVerified) --")
    for score, entity, expected_level, desc in LEVEL_FROM_SCORE_VECTORS:
        entity_str = "true" if entity else "false"
        print(f"    ({score}, {entity_str}) -> {expected_level}")

    print("\n  -- PERMISSIONS --")
    for level in range(1, 5):
        perms = json.dumps(EXPECTED_PERMISSIONS[level])
        print(f"    L{level}: {perms}")

    print("\n  -- SPENDING_LIMITS --")
    for level in range(1, 5):
        print(f"    L{level}: {EXPECTED_SPENDING_LIMITS[level]}")

    return total_failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
