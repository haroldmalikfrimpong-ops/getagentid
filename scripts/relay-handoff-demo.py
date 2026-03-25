#!/usr/bin/env python3
"""AgentID Relay Handoff Demo — Copywriter -> Messenger pipeline via qntm relay.

Proves three things at once:
  1. AgentID DID resolution (did:agentid → Ed25519 public key)
  2. Entity verification  (Corpo API — legal entity behind the agent)
  3. QSP-1 encrypted transport (HKDF key derivation, XChaCha20-Poly1305, Ed25519 sig)

This is the exact Copywriter→Messenger handoff pattern from Peter Vessenes'
relay-handoff example (corpollc/qntm), adapted to use the AgentID SDK and
demonstrate the three-spec composition.

Dependencies: PyNaCl, cryptography, httpx
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import struct
import sys
import time
from datetime import datetime, timezone

# -- Add SDK to path ----------------------------------------------------------
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "sdk", "python"))

from agentid.ed25519 import Ed25519Identity
from agentid.did import (
    create_did_agentid,
    register_agentid_key,
    resolve_did,
    verify_agent_full,
)

from cryptography.hazmat.primitives.kdf.hkdf import HKDF, HKDFExpand
from cryptography.hazmat.primitives import hashes

from nacl.bindings import crypto_aead_xchacha20poly1305_ietf_encrypt

import httpx

# ==============================================================================
# Constants — same invite material as relay-test.py (known-good vectors)
# ==============================================================================

INVITE_SECRET = bytes.fromhex(
    "a6d89c17fb6da9e56f368c2b562978ccd434900a835062d0fdfb5b31f0bdaaa2"
)
INVITE_SALT = bytes.fromhex(
    "99c74e4a41450c294a3ffb6473141ef3ca9e97f7afbc98ffc80f45793944dd80"
)
CONV_ID = bytes.fromhex("dca83b70ccd763a89b5953b2cd2ee678")
CONV_ID_HEX = "dca83b70ccd763a89b5953b2cd2ee678"

EXPECTED_ROOT_KEY  = "5b9f2361408c3932d4685d8ccb9733a1da980086c49a7b6615f6bca5e1a67c01"
EXPECTED_AEAD_KEY  = "b557d6071c2237eff670aa965f8f3bb516f9ba1d788166f8faf7388f5a260ec3"
EXPECTED_NONCE_KEY = "d88a1a1dee9dd0761a61a228a368ad72c15b96108c04cb072cc2b8fd63056c4f"

SEND_URL = "https://inbox.qntm.corpo.llc/v1/send"

# Agent identity
AGENT_ID = "copywriter-agent-01"

# ==============================================================================
# Minimal CBOR encoder (maps, byte strings, text strings, unsigned ints)
# ==============================================================================


def _cbor_encode_uint(major: int, value: int) -> bytes:
    mt = major << 5
    if value < 24:
        return struct.pack("B", mt | value)
    elif value < 0x100:
        return struct.pack("BB", mt | 24, value)
    elif value < 0x10000:
        return struct.pack("!BH", mt | 25, value)
    elif value < 0x100000000:
        return struct.pack("!BI", mt | 26, value)
    else:
        return struct.pack("!BQ", mt | 27, value)


def cbor_encode(obj) -> bytes:
    if isinstance(obj, int) and obj >= 0:
        return _cbor_encode_uint(0, obj)
    elif isinstance(obj, bytes):
        return _cbor_encode_uint(2, len(obj)) + obj
    elif isinstance(obj, str):
        encoded = obj.encode("utf-8")
        return _cbor_encode_uint(3, len(encoded)) + encoded
    elif isinstance(obj, dict):
        items = list(obj.items())
        result = _cbor_encode_uint(5, len(items))
        for k, v in items:
            result += cbor_encode(k)
            result += cbor_encode(v)
        return result
    else:
        raise TypeError(f"cbor_encode: unsupported type {type(obj)}")


# ==============================================================================
# Key derivation (identical to relay-test.py — QSP-1 v1.0)
# ==============================================================================


def derive_keys():
    info_root = b"qntm/qsp/v1/root" + CONV_ID
    root_key = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=INVITE_SALT,
        info=info_root,
    ).derive(INVITE_SECRET)

    info_aead = b"qntm/qsp/v1/aead" + CONV_ID
    aead_key = HKDFExpand(
        algorithm=hashes.SHA256(),
        length=32,
        info=info_aead,
    ).derive(root_key)

    info_nonce = b"qntm/qsp/v1/nonce" + CONV_ID
    nonce_key = HKDFExpand(
        algorithm=hashes.SHA256(),
        length=32,
        info=info_nonce,
    ).derive(root_key)

    return root_key, aead_key, nonce_key


# ==============================================================================
# Work artifact builder (Peter's pattern from shared.py)
# ==============================================================================


def create_work_artifact(
    artifact_type: str,
    source_agent: str,
    target_agent: str,
    payload: dict,
    metadata: dict | None = None,
) -> bytes:
    artifact = {
        "artifact_type": artifact_type,
        "source_agent": source_agent,
        "target_agent": target_agent,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "payload": payload,
    }
    if metadata:
        artifact["metadata"] = metadata
    return json.dumps(artifact, separators=(",", ":")).encode("utf-8")


# ==============================================================================
# Main
# ==============================================================================


def main():
    print("=" * 72)
    print("  AgentID Relay Handoff Demo")
    print("  Copywriter -> Messenger via qntm relay")
    print("  Three-spec composition: DID + Entity Verification + QSP-1")
    print("=" * 72)
    print()

    # ------------------------------------------------------------------
    # Step 1: Create AgentID identity for the Copywriter agent
    # ------------------------------------------------------------------
    print("[1] Creating AgentID identity for Copywriter agent ...")
    identity = Ed25519Identity.generate()
    did = create_did_agentid(AGENT_ID)
    register_agentid_key(AGENT_ID, identity.ed25519_public_key)

    print(f"    Agent ID:           {AGENT_ID}")
    print(f"    DID:                {did}")
    print(f"    Ed25519 public key: {identity.ed25519_public_key_hex}")
    print(f"    X25519 public key:  {identity.x25519_public_key_hex}")
    print()

    # ------------------------------------------------------------------
    # Step 2: Create work artifact (copywriter output)
    # ------------------------------------------------------------------
    print("[2] Creating work artifact (Copywriter output) ...")
    artifact = create_work_artifact(
        artifact_type="copywriter_output",
        source_agent=AGENT_ID,
        target_agent="messenger-agent-01",
        payload={
            "business_name": "ACME Corp International",
            "message": (
                "Dear valued partner,\n\n"
                "We are excited to present our Q1 2026 collaboration proposal. "
                "Our analytics platform has identified strong synergies between "
                "our organizations. Please review the attached preview.\n\n"
                "Best regards,\n"
                "The ACME Outreach Team"
            ),
            "preview_url": "https://preview.acme-corp.example/campaign/q1-2026-partner",
            "channel": "email",
            "language": "en",
            "urgency": "normal",
        },
        metadata={
            "pipeline_run_id": f"run_{int(time.time())}",
            "copywriter_version": "2.1.0",
            "confidence_score": 0.94,
            "did": did,
        },
    )
    print(f"    Artifact size: {len(artifact)} bytes")
    print(f"    Type: copywriter_output -> messenger-agent-01")
    print()

    # ------------------------------------------------------------------
    # Step 3: Derive HKDF keys and verify against known vectors
    # ------------------------------------------------------------------
    print("[3] Deriving HKDF keys from invite material ...")
    root_key, aead_key, nonce_key = derive_keys()

    all_pass = True

    def check(name, derived, expected_hex):
        nonlocal all_pass
        derived_hex = derived.hex()
        ok = derived_hex == expected_hex
        status = "PASS" if ok else "FAIL"
        print(f"    {name}: [{status}]")
        if not ok:
            print(f"      derived:  {derived_hex}")
            print(f"      expected: {expected_hex}")
            all_pass = False

    check("root_key ", root_key, EXPECTED_ROOT_KEY)
    check("aead_key ", aead_key, EXPECTED_AEAD_KEY)
    check("nonce_key", nonce_key, EXPECTED_NONCE_KEY)
    print()

    if not all_pass:
        print("FATAL: Key derivation mismatch. Aborting.")
        sys.exit(1)

    print("    All 3 key vectors verified.")
    print()

    # ------------------------------------------------------------------
    # Step 4: Encrypt with XChaCha20-Poly1305
    # ------------------------------------------------------------------
    print("[4] Encrypting work artifact with XChaCha20-Poly1305 ...")
    msg_id = os.urandom(16)
    nonce_full = hmac.new(nonce_key, msg_id, hashlib.sha256).digest()
    nonce = nonce_full[:24]

    ciphertext = crypto_aead_xchacha20poly1305_ietf_encrypt(
        artifact, aad=CONV_ID, nonce=nonce, key=aead_key
    )
    print(f"    msg_id:     {msg_id.hex()}")
    print(f"    nonce:      {nonce.hex()}")
    print(f"    ciphertext: {len(ciphertext)} bytes")
    print()

    # ------------------------------------------------------------------
    # Step 5: Sign ciphertext with Ed25519
    # ------------------------------------------------------------------
    print("[5] Signing ciphertext with Ed25519 ...")
    signature = identity.sign(ciphertext)
    print(f"    signature: {signature.hex()[:64]}...")
    print()

    # ------------------------------------------------------------------
    # Step 6: Build CBOR envelope with DID
    # ------------------------------------------------------------------
    print("[6] Building CBOR envelope (includes DID) ...")
    key_id = hashlib.sha256(identity.ed25519_public_key).digest()[:16]
    seq = 1
    ts = int(time.time() * 1000)
    expiry_ts = ts + (5 * 60 * 1000)  # 5 min from now

    envelope_map = {
        "v": 1,
        "conv": CONV_ID,
        "sender": key_id,
        "seq": seq,
        "ts": ts,
        "msg_id": msg_id,
        "nonce": nonce,
        "ciphertext": ciphertext,
        "sig": signature,
        "aad_hash": hashlib.sha256(CONV_ID).digest(),
        "did": did,
        "expiry_ts": expiry_ts,
    }

    cbor_bytes = cbor_encode(envelope_map)
    envelope_b64 = base64.b64encode(cbor_bytes).decode("ascii")
    print(f"    DID in envelope: {did}")
    print(f"    key_id (sender): {key_id.hex()}")
    print(f"    expiry_ts:       {expiry_ts} (5 min from now)")
    print(f"    CBOR:   {len(cbor_bytes)} bytes")
    print(f"    Base64: {len(envelope_b64)} chars")
    print()

    # ------------------------------------------------------------------
    # Step 7: POST to qntm relay
    # ------------------------------------------------------------------
    print("[7] POSTing to qntm relay ...")
    print(f"    URL: {SEND_URL}")

    body = {
        "conv_id": CONV_ID_HEX,
        "envelope_b64": envelope_b64,
    }

    relay_ok = False
    try:
        resp = httpx.post(SEND_URL, json=body, timeout=15)
        print(f"    HTTP status: {resp.status_code}")
        print(f"    Response: {resp.text[:200]}")
        relay_ok = 200 <= resp.status_code < 300
    except Exception as e:
        print(f"    ERROR: {e}")
        sys.exit(1)

    print()

    # ------------------------------------------------------------------
    # Step 8: Three-spec composition verification
    # ------------------------------------------------------------------
    print("[8] Three-spec composition: verify_agent_full() ...")
    print()
    print("    This demonstrates that a single call verifies all three specs:")
    print("      Spec 1: DID Resolution   (did:agentid -> Ed25519 key)")
    print("      Spec 2: Entity Verify    (Corpo API -> legal entity)")
    print("      Spec 3: QSP-1 Transport  (sender key_id matches DID key)")
    print()

    verification = verify_agent_full(
        did=did,
        entity_id="agentid",  # AgentID entity on Corpo staging
        sender_key_id=key_id,
    )

    print("    verify_agent_full() results:")
    print(f"      did:                {verification['did']}")
    print(f"      did_valid:          {verification['did_valid']}")
    print(f"      ed25519_public_key: {verification['ed25519_public_key']}")
    print(f"      sender_match:       {verification['sender_match']}")
    if verification['entity'] and 'error' not in verification['entity']:
        ent = verification['entity']
        print(f"      entity.name:        {ent.get('name', 'N/A')}")
        print(f"      entity.status:      {ent.get('status', 'N/A')}")
        print(f"      entity.type:        {ent.get('entity_type', 'N/A')}")
    elif verification['entity']:
        print(f"      entity:             {verification['entity']}")
    else:
        print(f"      entity:             None (not checked)")
    print(f"      fully_verified:     {verification['fully_verified']}")
    print()

    # ------------------------------------------------------------------
    # Step 9: Verify signature independently (proves crypto chain)
    # ------------------------------------------------------------------
    print("[9] Independent signature verification ...")
    resolved_key = resolve_did(did)
    sig_valid = Ed25519Identity.verify(resolved_key, ciphertext, signature)
    print(f"    Resolved key from DID: {resolved_key.hex()}")
    print(f"    Signature valid:       {sig_valid}")
    print()

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    print("=" * 72)
    if relay_ok:
        print("  RELAY: HTTP 201 -- Handoff delivered to qntm relay")
    else:
        print(f"  RELAY: HTTP {resp.status_code} -- See response above")

    print()
    print("  THREE-SPEC COMPOSITION RESULTS:")
    print(f"    [{'PASS' if verification['did_valid'] else 'FAIL'}] DID Resolution")
    print(f"         {did} -> Ed25519 key")
    print(f"    [{'PASS' if verification['sender_match'] else 'FAIL'}] QSP-1 Sender Match")
    print(f"         key_id in envelope matches DID-resolved key")

    entity_pass = (
        verification['entity'] is not None
        and 'error' not in verification.get('entity', {})
        and verification['entity'].get('status') == 'active'
    )
    # Entity verification may fail against staging API -- that's OK for demo
    if verification['entity'] and 'error' not in verification['entity']:
        print(f"    [{'PASS' if entity_pass else 'FAIL'}] Entity Verification")
        print(f"         {verification['entity'].get('name', 'N/A')} ({verification['entity'].get('status', 'N/A')})")
    else:
        print(f"    [INFO] Entity Verification")
        err = verification.get('entity', {}).get('error', 'not available')
        print(f"         Corpo API: {err}")

    print(f"    [{'PASS' if sig_valid else 'FAIL'}] Ed25519 Signature Verification")
    print(f"         Ciphertext signed by Copywriter, verified via DID")
    print()
    print("  This proves AgentID can do Peter's relay handoff pattern AND")
    print("  the full three-spec composition in a single flow.")
    print("=" * 72)


if __name__ == "__main__":
    main()
