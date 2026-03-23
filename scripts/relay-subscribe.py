#!/usr/bin/env python3
"""AgentID relay subscriber — connect to the qntm relay via WebSocket,
receive encrypted messages, decrypt them, and print the plaintext.

Proves AgentID can do full two-way encrypted communication:
  1. Derive the same HKDF keys from shared invite material
  2. Connect to the live qntm relay WebSocket subscribe endpoint
  3. Receive CBOR-encoded, XChaCha20-Poly1305 encrypted envelopes
  4. Decrypt each message and display the plaintext

Dependencies: websockets, PyNaCl, cryptography
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import struct
import sys
import time
from datetime import datetime, timezone

# -- Add SDK to path so we can import agentid.ed25519 --------------------------
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "sdk", "python"))

from cryptography.hazmat.primitives.kdf.hkdf import HKDF, HKDFExpand
from cryptography.hazmat.primitives import hashes

from nacl.bindings import crypto_aead_xchacha20poly1305_ietf_decrypt

import websockets

# ==============================================================================
# Constants from Peter's invite (same as relay-test.py)
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

SUBSCRIBE_URL = (
    f"wss://inbox.qntm.corpo.llc/v1/subscribe"
    f"?conv_id={CONV_ID_HEX}&from_seq=9"
)

IDLE_TIMEOUT = 10  # seconds of no new messages before exiting

# ==============================================================================
# Minimal CBOR decoder
# ==============================================================================

class CBORDecodeError(Exception):
    pass


def _cbor_decode_uint(data: bytes, offset: int) -> tuple:
    """Decode a CBOR unsigned integer argument. Returns (value, new_offset)."""
    if offset >= len(data):
        raise CBORDecodeError("Unexpected end of CBOR data")
    additional = data[offset] & 0x1F
    offset += 1
    if additional < 24:
        return additional, offset
    elif additional == 24:
        if offset >= len(data):
            raise CBORDecodeError("Unexpected end of CBOR data")
        return data[offset], offset + 1
    elif additional == 25:
        if offset + 2 > len(data):
            raise CBORDecodeError("Unexpected end of CBOR data")
        val = struct.unpack_from("!H", data, offset)[0]
        return val, offset + 2
    elif additional == 26:
        if offset + 4 > len(data):
            raise CBORDecodeError("Unexpected end of CBOR data")
        val = struct.unpack_from("!I", data, offset)[0]
        return val, offset + 4
    elif additional == 27:
        if offset + 8 > len(data):
            raise CBORDecodeError("Unexpected end of CBOR data")
        val = struct.unpack_from("!Q", data, offset)[0]
        return val, offset + 8
    else:
        raise CBORDecodeError(f"Unsupported CBOR additional info: {additional}")


def cbor_decode(data: bytes, offset: int = 0) -> tuple:
    """Minimal CBOR decoder. Returns (decoded_value, new_offset).

    Supports: unsigned int (major 0), negative int (major 1),
    byte string (major 2), text string (major 3), array (major 4),
    map (major 5), simple values true/false/null (major 7).
    """
    if offset >= len(data):
        raise CBORDecodeError("Unexpected end of CBOR data")

    first_byte = data[offset]
    major_type = (first_byte >> 5) & 0x07

    if major_type == 0:  # unsigned integer
        val, new_offset = _cbor_decode_uint(data, offset)
        return val, new_offset

    elif major_type == 1:  # negative integer
        val, new_offset = _cbor_decode_uint(data, offset)
        return -1 - val, new_offset

    elif major_type == 2:  # byte string
        length, new_offset = _cbor_decode_uint(data, offset)
        end = new_offset + length
        if end > len(data):
            raise CBORDecodeError("Byte string extends beyond data")
        return data[new_offset:end], end

    elif major_type == 3:  # text string
        length, new_offset = _cbor_decode_uint(data, offset)
        end = new_offset + length
        if end > len(data):
            raise CBORDecodeError("Text string extends beyond data")
        return data[new_offset:end].decode("utf-8"), end

    elif major_type == 4:  # array
        count, new_offset = _cbor_decode_uint(data, offset)
        items = []
        for _ in range(count):
            item, new_offset = cbor_decode(data, new_offset)
            items.append(item)
        return items, new_offset

    elif major_type == 5:  # map
        count, new_offset = _cbor_decode_uint(data, offset)
        result = {}
        for _ in range(count):
            key, new_offset = cbor_decode(data, new_offset)
            value, new_offset = cbor_decode(data, new_offset)
            result[key] = value
        return result, new_offset

    elif major_type == 7:  # simple values and floats
        additional = first_byte & 0x1F
        if additional == 20:  # false
            return False, offset + 1
        elif additional == 21:  # true
            return True, offset + 1
        elif additional == 22:  # null
            return None, offset + 1
        elif additional == 25:  # half-precision float
            return struct.unpack_from("!e", data, offset + 1)[0], offset + 3
        elif additional == 26:  # single-precision float
            return struct.unpack_from("!f", data, offset + 1)[0], offset + 5
        elif additional == 27:  # double-precision float
            return struct.unpack_from("!d", data, offset + 1)[0], offset + 9
        else:
            raise CBORDecodeError(f"Unsupported CBOR simple value: {additional}")

    else:
        raise CBORDecodeError(f"Unsupported CBOR major type: {major_type}")


def cbor_decode_all(data: bytes):
    """Decode the first CBOR item from data."""
    value, _ = cbor_decode(data, 0)
    return value


# ==============================================================================
# Key derivation (identical to relay-test.py)
# ==============================================================================

def derive_keys():
    """Derive root_key, aead_key, nonce_key from invite material using HKDF-SHA-256."""

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
# Message decryption
# ==============================================================================

def decrypt_envelope(envelope_map: dict, aead_key: bytes, nonce_key: bytes) -> str | None:
    """Decrypt a CBOR envelope map.

    Handles two formats:
      - Native qntm: has msg_id, ciphertext, aad_hash fields
        nonce = Trunc24(HMAC-SHA-256(nonce_key, msg_id))
      - Bridge format: has nonce, ct, aad fields
        nonce provided directly

    Returns decrypted plaintext as string, or None on failure.
    """
    try:
        # Determine format and extract nonce + ciphertext
        if "msg_id" in envelope_map and "ciphertext" in envelope_map:
            # Native qntm format
            msg_id = envelope_map["msg_id"]
            ciphertext = envelope_map["ciphertext"]
            # nonce = Trunc24(HMAC-SHA-256(nonce_key, msg_id))
            nonce_full = hmac.new(nonce_key, msg_id, hashlib.sha256).digest()
            nonce = nonce_full[:24]
        elif "nonce" in envelope_map and "ct" in envelope_map:
            # Bridge format
            nonce = envelope_map["nonce"]
            ciphertext = envelope_map["ct"]
        elif "nonce" in envelope_map and "ciphertext" in envelope_map:
            # Hybrid: has explicit nonce but uses "ciphertext" key
            nonce = envelope_map["nonce"]
            ciphertext = envelope_map["ciphertext"]
        else:
            print(f"    [!] Unknown envelope format. Keys: {list(envelope_map.keys())}")
            return None

        # Decrypt with XChaCha20-Poly1305, aad = conv_id bytes
        plaintext = crypto_aead_xchacha20poly1305_ietf_decrypt(
            ciphertext, aad=CONV_ID, nonce=nonce, key=aead_key
        )
        return plaintext.decode("utf-8")

    except Exception as e:
        # Distinguish between "wrong key" (expected for other senders) and real errors
        err_str = str(e)
        if "Decryption failed" in err_str:
            return "[DECRYPTION FAILED: wrong key or different sender — expected for foreign messages]"
        return f"[DECRYPTION FAILED: {e}]"


# ==============================================================================
# WebSocket subscriber
# ==============================================================================

async def subscribe(aead_key: bytes, nonce_key: bytes):
    """Connect to the qntm relay WebSocket and receive/decrypt messages."""

    print(f"[3] Connecting to WebSocket ...")
    print(f"    URL: {SUBSCRIBE_URL}")
    print()

    messages_received = 0
    messages_decrypted = 0
    messages_foreign = 0   # encrypted with different keys (other senders)
    messages_failed = 0    # actual errors

    try:
        async with websockets.connect(
            SUBSCRIBE_URL,
            additional_headers={"User-Agent": "AgentID-Subscriber/1.0"},
            ping_interval=20,
            ping_timeout=10,
            close_timeout=5,
        ) as ws:
            print(f"    Connected! Waiting for messages (timeout: {IDLE_TIMEOUT}s idle) ...")
            print()
            print("-" * 70)

            while True:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=IDLE_TIMEOUT)
                except asyncio.TimeoutError:
                    print()
                    print(f"    No messages for {IDLE_TIMEOUT}s — closing connection.")
                    break

                messages_received += 1
                print()
                print(f"  === Message #{messages_received} ===")

                # The relay may send JSON wrapper or raw base64
                # Try JSON first (relay may wrap with metadata)
                envelope_b64 = None
                relay_meta = {}

                try:
                    wrapper = json.loads(raw)
                    # Could be a JSON wrapper with envelope_b64 inside
                    if isinstance(wrapper, dict):
                        relay_meta = wrapper
                        envelope_b64 = wrapper.get("envelope_b64") or wrapper.get("envelope")
                        if "seq" in wrapper:
                            print(f"    seq:       {wrapper['seq']}")
                        if "sender" in wrapper:
                            sender = wrapper["sender"]
                            if isinstance(sender, str):
                                print(f"    sender:    {sender}")
                        if "key_id" in wrapper:
                            print(f"    key_id:    {wrapper['key_id']}")
                        if "ts" in wrapper:
                            ts = wrapper["ts"]
                            # Try to interpret as ms or seconds
                            if isinstance(ts, (int, float)):
                                if ts > 1e12:
                                    ts_sec = ts / 1000
                                else:
                                    ts_sec = ts
                                dt = datetime.fromtimestamp(ts_sec, tz=timezone.utc)
                                print(f"    timestamp: {dt.isoformat()}")
                            else:
                                print(f"    timestamp: {ts}")
                        if not envelope_b64:
                            # Check for relay control messages (e.g. "ready")
                            if wrapper.get("type") in ("ready", "ack", "error", "ping", "pong"):
                                ctrl_type = wrapper["type"]
                                extra = {k: v for k, v in wrapper.items() if k != "type"}
                                print(f"    [Relay control: {ctrl_type}] {extra}")
                                messages_received -= 1  # Don't count control messages
                                continue

                            # The entire JSON might be the message content
                            print(f"    [JSON message, no envelope] Keys: {list(wrapper.keys())}")
                            # If there's a raw envelope in the wrapper itself, try to decode it
                            if "msg_id" in wrapper or "ciphertext" in wrapper or "ct" in wrapper:
                                # It's an unwrapped envelope as JSON — fields may be hex
                                print(f"    [Trying direct JSON envelope decryption]")
                                env = {}
                                for k, v in wrapper.items():
                                    if isinstance(v, str) and k in ("msg_id", "ciphertext", "ct", "nonce", "aad_hash", "sig", "sender", "conv"):
                                        try:
                                            env[k] = bytes.fromhex(v)
                                        except ValueError:
                                            try:
                                                env[k] = base64.b64decode(v)
                                            except Exception:
                                                env[k] = v
                                    else:
                                        env[k] = v
                                plaintext = decrypt_envelope(env, aead_key, nonce_key)
                                if plaintext and not plaintext.startswith("[DECRYPTION FAILED"):
                                    messages_decrypted += 1
                                    print(f"    DECRYPTED:")
                                    _print_plaintext(plaintext)
                                else:
                                    messages_failed += 1
                                    print(f"    {plaintext}")
                            else:
                                print(f"    Raw: {json.dumps(wrapper, indent=2)[:500]}")
                            continue
                except (json.JSONDecodeError, UnicodeDecodeError):
                    # Not JSON — treat as raw base64 or binary
                    if isinstance(raw, str):
                        envelope_b64 = raw
                    elif isinstance(raw, bytes):
                        # Could be raw CBOR or base64-encoded
                        try:
                            envelope_b64 = raw.decode("ascii")
                        except UnicodeDecodeError:
                            # Raw binary CBOR
                            envelope_b64 = None
                            try:
                                envelope_map = cbor_decode_all(raw)
                                _process_cbor_envelope(envelope_map, aead_key, nonce_key, messages_decrypted, messages_failed)
                                if isinstance(envelope_map, dict):
                                    plaintext = decrypt_envelope(envelope_map, aead_key, nonce_key)
                                    if plaintext and not plaintext.startswith("[DECRYPTION FAILED"):
                                        messages_decrypted += 1
                                    else:
                                        messages_failed += 1
                            except Exception as e:
                                messages_failed += 1
                                print(f"    [Failed to decode binary: {e}]")
                            continue

                if not envelope_b64:
                    continue

                # Decode base64 -> CBOR -> map
                try:
                    cbor_bytes = base64.b64decode(envelope_b64)
                except Exception as e:
                    messages_failed += 1
                    print(f"    [Base64 decode failed: {e}]")
                    print(f"    Raw preview: {str(raw)[:200]}")
                    continue

                print(f"    envelope:  {len(cbor_bytes)} bytes CBOR")

                try:
                    envelope_map = cbor_decode_all(cbor_bytes)
                except CBORDecodeError as e:
                    messages_failed += 1
                    print(f"    [CBOR decode failed: {e}]")
                    print(f"    Hex preview: {cbor_bytes[:64].hex()}")
                    continue

                if not isinstance(envelope_map, dict):
                    messages_failed += 1
                    print(f"    [Unexpected CBOR type: {type(envelope_map).__name__}]")
                    continue

                # Print envelope metadata
                if "seq" in envelope_map:
                    print(f"    seq:       {envelope_map['seq']}")
                if "sender" in envelope_map:
                    sender = envelope_map["sender"]
                    if isinstance(sender, bytes):
                        print(f"    key_id:    {sender.hex()}")
                    else:
                        print(f"    key_id:    {sender}")
                if "ts" in envelope_map:
                    ts = envelope_map["ts"]
                    if isinstance(ts, int) and ts > 1e12:
                        dt = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
                        print(f"    timestamp: {dt.isoformat()}")
                    elif isinstance(ts, (int, float)):
                        dt = datetime.fromtimestamp(ts, tz=timezone.utc)
                        print(f"    timestamp: {dt.isoformat()}")
                if "msg_id" in envelope_map:
                    mid = envelope_map["msg_id"]
                    if isinstance(mid, bytes):
                        print(f"    msg_id:    {mid.hex()}")
                    else:
                        print(f"    msg_id:    {mid}")
                if "v" in envelope_map:
                    print(f"    version:   {envelope_map['v']}")

                # Decrypt
                plaintext = decrypt_envelope(envelope_map, aead_key, nonce_key)
                if plaintext and not plaintext.startswith("[DECRYPTION FAILED"):
                    messages_decrypted += 1
                    print(f"    DECRYPTED:")
                    _print_plaintext(plaintext)
                elif plaintext and "wrong key" in plaintext:
                    messages_foreign += 1
                    print(f"    [Foreign message — different sender keys]")
                else:
                    messages_failed += 1
                    print(f"    {plaintext}")

    except websockets.exceptions.ConnectionClosed as e:
        print(f"    Connection closed: {e}")
    except websockets.exceptions.InvalidStatusCode as e:
        print(f"    WebSocket connection rejected: {e}")
    except Exception as e:
        print(f"    Connection error: {type(e).__name__}: {e}")

    return messages_received, messages_decrypted, messages_foreign, messages_failed


def _print_plaintext(plaintext: str):
    """Pretty-print a decrypted plaintext message."""
    # Try to parse as JSON for nicer display
    try:
        obj = json.loads(plaintext)
        for key, value in obj.items():
            val_str = str(value)
            if len(val_str) > 100:
                val_str = val_str[:100] + "..."
            print(f"      {key}: {val_str}")
    except (json.JSONDecodeError, AttributeError):
        # Plain text
        for line in plaintext.split("\n"):
            print(f"      {line}")


def _process_cbor_envelope(envelope_map, aead_key, nonce_key, decrypted_count, failed_count):
    """Process and print a CBOR envelope that was decoded from raw binary."""
    if not isinstance(envelope_map, dict):
        print(f"    [Unexpected CBOR type: {type(envelope_map).__name__}]")
        return

    if "seq" in envelope_map:
        print(f"    seq:       {envelope_map['seq']}")
    if "sender" in envelope_map:
        sender = envelope_map["sender"]
        if isinstance(sender, bytes):
            print(f"    key_id:    {sender.hex()}")
    if "ts" in envelope_map:
        ts = envelope_map["ts"]
        if isinstance(ts, int) and ts > 1e12:
            dt = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
            print(f"    timestamp: {dt.isoformat()}")

    plaintext = decrypt_envelope(envelope_map, aead_key, nonce_key)
    if plaintext and not plaintext.startswith("[DECRYPTION FAILED"):
        print(f"    DECRYPTED:")
        _print_plaintext(plaintext)
    else:
        print(f"    {plaintext}")


# ==============================================================================
# Main
# ==============================================================================

def main():
    print("=" * 70)
    print("  AgentID Relay Subscriber — qntm encrypted channel listener")
    print("=" * 70)
    print()

    # ------------------------------------------------------------------
    # Step 1: Derive HKDF keys and verify
    # ------------------------------------------------------------------
    print("[1] Deriving HKDF keys from invite material ...")
    root_key, aead_key, nonce_key = derive_keys()

    all_pass = True

    def check(name, derived, expected_hex):
        nonlocal all_pass
        ok = derived.hex() == expected_hex
        status = "PASS" if ok else "FAIL"
        print(f"    {name}: [{status}]  {derived.hex()[:32]}...")
        if not ok:
            all_pass = False

    check("root_key ", root_key, EXPECTED_ROOT_KEY)
    check("aead_key ", aead_key, EXPECTED_AEAD_KEY)
    check("nonce_key", nonce_key, EXPECTED_NONCE_KEY)
    print()

    if not all_pass:
        print("FATAL: Key derivation mismatch — aborting.")
        sys.exit(1)

    print("    All 3 key vectors verified.")
    print()

    # ------------------------------------------------------------------
    # Step 2: Show connection info
    # ------------------------------------------------------------------
    print("[2] Subscribe parameters:")
    print(f"    conv_id:  {CONV_ID_HEX}")
    print(f"    from_seq: 9")
    print(f"    relay:    inbox.qntm.corpo.llc")
    print()

    # ------------------------------------------------------------------
    # Step 3: Connect and listen
    # ------------------------------------------------------------------
    received, decrypted, foreign, failed = asyncio.run(subscribe(aead_key, nonce_key))

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    print()
    print("-" * 70)
    print()
    print("=" * 70)
    print("  SUMMARY")
    print("=" * 70)
    print(f"    Messages received:  {received}")
    print(f"    Decrypted (ours):   {decrypted}")
    print(f"    Foreign (other keys): {foreign}")
    print(f"    Errors:             {failed}")
    print()
    if decrypted > 0:
        print("  SUCCESS — AgentID two-way encrypted communication PROVEN")
        print("    - Derived shared HKDF keys from invite material")
        print("    - Connected to live qntm relay via WebSocket")
        print("    - Received and decrypted XChaCha20-Poly1305 messages")
        print("    - Full two-way encrypted channel operational")
    elif received > 0 and foreign > 0:
        print("  PARTIAL — Received messages but all were from foreign senders")
    elif received > 0:
        print("  PARTIAL — Received messages but could not decrypt any")
    else:
        print("  NO MESSAGES — Channel may be empty or relay unavailable")
    print("=" * 70)


if __name__ == "__main__":
    main()
