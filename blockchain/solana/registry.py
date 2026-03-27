"""AgentID on-chain registry — publish and verify agent identities on Solana.

Uses the Solana Memo Program v2 to store agent identity records as transaction
memos.  No custom smart contract required — just a signed transaction whose
memo field contains a JSON identity payload.

Requires:
    pip install solana solders

The registry keypair signs every transaction so third parties can verify
the memo came from the official AgentID registry address.
"""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Optional

from solana.rpc.api import Client as SolanaClient
from solana.rpc.commitment import Confirmed
from solana.transaction import Transaction
from solders.keypair import Keypair  # type: ignore[import-untyped]
from solders.pubkey import Pubkey  # type: ignore[import-untyped]
from solders.instruction import Instruction, AccountMeta  # type: ignore[import-untyped]
from solders.signature import Signature  # type: ignore[import-untyped]

from .config import (
    SOLANA_RPC_URL,
    REGISTRY_KEYPAIR_PATH,
    MEMO_PROGRAM_ID,
    explorer_tx_url,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_registry_keypair(path: Optional[str] = None) -> Keypair:
    """Load the registry authority keypair from a JSON file.

    The file format matches `solana-keygen new --outfile <path>` output:
    a JSON array of 64 integers (the secret key bytes).
    """
    kp_path = Path(path or REGISTRY_KEYPAIR_PATH)
    if not kp_path.exists():
        raise FileNotFoundError(
            f"Registry keypair not found at {kp_path}. "
            "Generate one with: solana-keygen new --outfile ~/.config/agentid/registry-keypair.json"
        )
    raw = json.loads(kp_path.read_text())
    return Keypair.from_bytes(bytes(raw))


def _build_memo_instruction(memo_text: str, signer: Pubkey) -> Instruction:
    """Build a Memo Program v2 instruction with the given text."""
    memo_program = Pubkey.from_string(MEMO_PROGRAM_ID)
    return Instruction(
        program_id=memo_program,
        accounts=[AccountMeta(pubkey=signer, is_signer=True, is_writable=True)],
        data=memo_text.encode("utf-8"),
    )


def _hash_certificate(certificate: str) -> str:
    """SHA-256 hash of a certificate string (hex digest)."""
    return hashlib.sha256(certificate.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Publish
# ---------------------------------------------------------------------------

def publish_agent_identity(
    agent_id: str,
    owner: str,
    public_key: str,
    trust_level: int,
    certificate: str,
    registered_at: Optional[str] = None,
    keypair_path: Optional[str] = None,
    rpc_url: Optional[str] = None,
) -> dict:
    """Publish an agent identity record to Solana as a memo transaction.

    Args:
        agent_id:      The agent's unique identifier (e.g. ``agent_abc123``).
        owner:         Owner name or email.
        public_key:    The agent's public key (PEM or hex).
        trust_level:   Integer trust level (1-4).
        certificate:   The agent's certificate string.
        registered_at: ISO timestamp of original registration (defaults to now).
        keypair_path:  Override path to the registry keypair JSON file.
        rpc_url:       Override Solana RPC URL.

    Returns:
        dict with ``tx_hash``, ``explorer_url``, ``registry_address``,
        ``memo``, and ``slot``.

    Raises:
        FileNotFoundError: If the registry keypair file is missing.
        RuntimeError:      If the Solana transaction fails.
    """
    client = SolanaClient(rpc_url or SOLANA_RPC_URL)
    registry_kp = _load_registry_keypair(keypair_path)

    # Build the identity payload
    memo_payload = {
        "protocol": "agentid",
        "version": 1,
        "agent_id": agent_id,
        "owner": owner,
        "public_key": public_key[:128],  # truncate long PEM keys for memo size
        "trust_level": trust_level,
        "registered_at": registered_at or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "certificate_hash": _hash_certificate(certificate),
    }
    memo_json = json.dumps(memo_payload, separators=(",", ":"))

    # Memo program v2 allows up to ~700 bytes per memo.  Our payload is ~300-400 bytes.
    if len(memo_json.encode("utf-8")) > 700:
        raise ValueError(f"Memo payload too large ({len(memo_json.encode('utf-8'))} bytes > 700 max)")

    # Build and send the transaction
    ix = _build_memo_instruction(memo_json, registry_kp.pubkey())
    tx = Transaction()
    tx.add(ix)

    # Get a recent blockhash and send
    blockhash_resp = client.get_latest_blockhash(commitment=Confirmed)
    tx.recent_blockhash = blockhash_resp.value.blockhash
    tx.fee_payer = registry_kp.pubkey()
    tx.sign(registry_kp)

    result = client.send_transaction(tx, registry_kp, opts={"skip_preflight": False})

    # Extract the signature
    tx_sig = str(result.value)

    # Confirm the transaction
    client.confirm_transaction(Signature.from_string(tx_sig), commitment=Confirmed)

    return {
        "tx_hash": tx_sig,
        "explorer_url": explorer_tx_url(tx_sig),
        "registry_address": str(registry_kp.pubkey()),
        "memo": memo_payload,
        "cluster": "devnet",  # hardcoded for now
    }


# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------

def verify_agent_onchain(
    agent_id: str,
    keypair_path: Optional[str] = None,
    rpc_url: Optional[str] = None,
    limit: int = 50,
) -> Optional[dict]:
    """Look up an agent's on-chain identity record.

    Queries recent transactions from the registry address for memo
    transactions containing the given ``agent_id``.

    Args:
        agent_id:     The agent ID to search for.
        keypair_path: Override registry keypair path (to derive the address).
        rpc_url:      Override Solana RPC URL.
        limit:        Max number of recent transactions to scan.

    Returns:
        dict with the on-chain record (``tx_hash``, ``memo``, ``slot``,
        ``block_time``) if found, or ``None`` if no matching record exists.
    """
    client = SolanaClient(rpc_url or SOLANA_RPC_URL)
    registry_kp = _load_registry_keypair(keypair_path)
    registry_address = registry_kp.pubkey()

    # Fetch recent transaction signatures for the registry address
    sigs_resp = client.get_signatures_for_address(
        registry_address,
        limit=limit,
        commitment=Confirmed,
    )

    if not sigs_resp.value:
        return None

    # Check each transaction for our agent_id in the memo
    for sig_info in sigs_resp.value:
        tx_sig = sig_info.signature

        # Fetch the full transaction
        tx_resp = client.get_transaction(
            tx_sig,
            encoding="jsonParsed",
            commitment=Confirmed,
            max_supported_transaction_version=0,
        )

        if not tx_resp.value:
            continue

        # Walk through the instructions looking for memo data
        try:
            tx_data = tx_resp.value
            # The transaction object structure varies by solana-py version.
            # We try the common paths.
            meta = tx_data.transaction
            if hasattr(meta, "transaction"):
                # VersionedTransactionWithMeta
                message = meta.transaction.message
            elif hasattr(meta, "message"):
                message = meta.message
            else:
                continue

            instructions = message.instructions
            for ix in instructions:
                # For jsonParsed encoding, memo instructions expose parsed data
                program_id = str(ix.program_id) if hasattr(ix, "program_id") else ""

                if MEMO_PROGRAM_ID in program_id:
                    # The memo data is in ix.data (base58 or parsed string)
                    memo_raw = None
                    if hasattr(ix, "parsed"):
                        memo_raw = ix.parsed
                    elif hasattr(ix, "data"):
                        memo_raw = ix.data

                    if memo_raw and agent_id in str(memo_raw):
                        # Try to parse as JSON
                        try:
                            # Parsed memos come as plain strings
                            memo_str = str(memo_raw)
                            # Find the JSON within the string
                            json_start = memo_str.index("{")
                            json_end = memo_str.rindex("}") + 1
                            memo_data = json.loads(memo_str[json_start:json_end])

                            return {
                                "found": True,
                                "tx_hash": str(tx_sig),
                                "explorer_url": explorer_tx_url(str(tx_sig)),
                                "memo": memo_data,
                                "slot": sig_info.slot,
                                "block_time": sig_info.block_time,
                                "registry_address": str(registry_address),
                            }
                        except (json.JSONDecodeError, ValueError):
                            # Memo contained the agent_id but isn't valid JSON
                            return {
                                "found": True,
                                "tx_hash": str(tx_sig),
                                "explorer_url": explorer_tx_url(str(tx_sig)),
                                "memo_raw": str(memo_raw),
                                "slot": sig_info.slot,
                                "block_time": sig_info.block_time,
                                "registry_address": str(registry_address),
                            }
        except (AttributeError, IndexError, TypeError):
            # Transaction structure didn't match — skip it
            continue

    return None


# ---------------------------------------------------------------------------
# CLI convenience
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage:")
        print("  python -m blockchain.solana.registry publish <agent_id> <owner> <pubkey> <trust_level> <cert>")
        print("  python -m blockchain.solana.registry verify <agent_id>")
        sys.exit(1)

    command = sys.argv[1]

    if command == "publish":
        if len(sys.argv) < 7:
            print("Usage: publish <agent_id> <owner> <pubkey> <trust_level> <cert>")
            sys.exit(1)
        result = publish_agent_identity(
            agent_id=sys.argv[2],
            owner=sys.argv[3],
            public_key=sys.argv[4],
            trust_level=int(sys.argv[5]),
            certificate=sys.argv[6],
        )
        print(json.dumps(result, indent=2))

    elif command == "verify":
        if len(sys.argv) < 3:
            print("Usage: verify <agent_id>")
            sys.exit(1)
        result = verify_agent_onchain(agent_id=sys.argv[2])
        if result:
            print(json.dumps(result, indent=2, default=str))
        else:
            print(f"No on-chain record found for {sys.argv[2]}")

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
