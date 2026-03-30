/**
 * AgentID Dual Receipt System
 *
 * Every significant action produces TWO receipts:
 *   1. Hash receipt — HMAC-SHA256 signed by platform key, stored in Supabase
 *   2. Blockchain receipt — Solana memo transaction with action summary on-chain
 *
 * This gives both instant cryptographic proof (hash receipt) and immutable
 * on-chain audit trail (blockchain receipt).
 */

import crypto from 'crypto'
import { getServiceClient } from '@/lib/api-auth'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HashReceipt {
  receipt_id: string
  action: string
  agent_id: string
  timestamp: string
  data_hash: string
  signature: string
  verification_url: string
}

export interface BlockchainReceipt {
  tx_hash: string
  cluster: string
  explorer_url: string
  block_time: number | null
  memo: string
}

export type AttestationLevel = 'self-issued' | 'domain-attested' | 'third-party-attested'

export interface ArkForgeProof {
  proof_id: string
  verification_url: string
}

export interface DualReceipt {
  hash: HashReceipt
  blockchain: BlockchainReceipt | null  // null if on-chain publish fails (non-blocking)
  attestation_level: AttestationLevel
  arkforge: ArkForgeProof | null
}

export type ReceiptAction =
  | 'verification'
  | 'payment'
  | 'handoff'
  | 'challenge'
  | 'registration'
  | 'ed25519_bound'
  | 'connection'
  | 'message'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SOLANA_CLUSTER = process.env.SOLANA_CLUSTER || 'devnet'

const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ||
  (SOLANA_CLUSTER === 'mainnet-beta'
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com')

const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'

// ---------------------------------------------------------------------------
// Signing helpers
// ---------------------------------------------------------------------------

function getReceiptSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is required for receipt signing')
  }
  return secret
}

function hmacSign(data: string): string {
  return crypto
    .createHmac('sha256', getReceiptSecret())
    .update(data)
    .digest('hex')
}

function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function explorerTxUrl(signature: string): string {
  const base = 'https://explorer.solana.com/tx'
  if (SOLANA_CLUSTER === 'mainnet-beta') {
    return `${base}/${signature}`
  }
  return `${base}/${signature}?cluster=${SOLANA_CLUSTER}`
}

// ---------------------------------------------------------------------------
// Hash Receipt
// ---------------------------------------------------------------------------

export function createHashReceipt(
  action: ReceiptAction,
  agentId: string,
  data: Record<string, unknown>
): HashReceipt {
  const receiptId = crypto.randomUUID()
  const timestamp = new Date().toISOString()
  const dataHash = sha256(JSON.stringify({ action, agent_id: agentId, data, timestamp }))
  const signature = hmacSign(`${receiptId}:${action}:${agentId}:${dataHash}:${timestamp}`)

  return {
    receipt_id: receiptId,
    action,
    agent_id: agentId,
    timestamp,
    data_hash: dataHash,
    signature,
    verification_url: `https://getagentid.dev/proof/${receiptId}`,
  }
}

// ---------------------------------------------------------------------------
// Blockchain Receipt (Solana Memo)
// ---------------------------------------------------------------------------

/**
 * Publish a memo to Solana.
 *
 * This uses the platform's registry keypair (loaded from AGENTID_REGISTRY_KEYPAIR_JSON
 * env var — a JSON array of 64 integers, matching solana-keygen output).
 *
 * If the keypair is not configured or the RPC fails, returns null rather than
 * blocking the caller. On-chain receipts are best-effort.
 */
async function publishMemoToSolana(
  memoText: string
): Promise<BlockchainReceipt | null> {
  try {
    // Lazy-import @solana/web3.js to avoid loading it when not needed
    const {
      Connection,
      Keypair,
      Transaction,
      TransactionInstruction,
      PublicKey,
      sendAndConfirmTransaction,
    } = await import('@solana/web3.js')

    // Load registry keypair from env (JSON array of 64 secret-key bytes)
    const keypairJson = process.env.AGENTID_REGISTRY_KEYPAIR_JSON
    if (!keypairJson) {
      console.warn('[receipts] AGENTID_REGISTRY_KEYPAIR_JSON not set — skipping on-chain receipt')
      return null
    }

    const secretBytes = new Uint8Array(JSON.parse(keypairJson))
    const registryKeypair = Keypair.fromSecretKey(secretBytes)

    const connection = new Connection(SOLANA_RPC_URL, 'confirmed')

    // Truncate memo if too long (Solana memo limit ~700 bytes)
    const memoBytes = Buffer.from(memoText, 'utf-8')
    const truncated = memoBytes.length > 680 ? memoBytes.subarray(0, 680).toString('utf-8') : memoText

    const memoIx = new TransactionInstruction({
      keys: [{ pubkey: registryKeypair.publicKey, isSigner: true, isWritable: true }],
      programId: new PublicKey(MEMO_PROGRAM_ID),
      data: Buffer.from(truncated, 'utf-8'),
    })

    const tx = new Transaction().add(memoIx)
    const txHash = await sendAndConfirmTransaction(connection, tx, [registryKeypair], {
      commitment: 'confirmed',
    })

    return {
      tx_hash: txHash,
      cluster: SOLANA_CLUSTER,
      explorer_url: explorerTxUrl(txHash),
      block_time: Math.floor(Date.now() / 1000), // approximate; real block_time requires a getTransaction call
      memo: truncated,
    }
  } catch (err: any) {
    console.error('[receipts] Failed to publish on-chain receipt:', err.message || err)
    return null
  }
}

// ---------------------------------------------------------------------------
// ArkForge External Attestation (best-effort, non-blocking)
// ---------------------------------------------------------------------------

/**
 * Submit receipt data to ArkForge for third-party attestation.
 * Only runs if ARKFORGE_API_KEY is set. Returns proof ID and verification URL.
 * Non-blocking — errors are swallowed.
 */
async function submitToArkForge(
  receiptData: Record<string, unknown>,
  endpoint: string,
  agentId?: string
): Promise<ArkForgeProof | null> {
  try {
    const apiKey = process.env.ARKFORGE_API_KEY
    if (!apiKey) return null

    const agentDid = agentId ? `did:web:getagentid.dev:agent:${agentId}` : 'did:web:getagentid.dev'
    const action = (receiptData.action as string) || 'unknown'

    const res = await fetch('https://trust.arkforge.tech/v1/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Agent-Identity': agentDid,
        'X-Agent-Version': 'agentid-v1',
      },
      body: JSON.stringify({
        target: endpoint,
        payload: receiptData,
        description: `AgentID ${action} receipt for ${agentId || 'platform'}`,
      }),
    })

    if (!res.ok) {
      console.warn('[receipts] ArkForge attestation failed:', res.status)
      return null
    }

    const data = await res.json()
    return {
      proof_id: data.proof_id || data.id || null,
      verification_url: data.verification_url || data.url || null,
    }
  } catch (err: any) {
    console.warn('[receipts] ArkForge attestation error:', err.message || err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Dual Receipt (combined)
// ---------------------------------------------------------------------------

/**
 * Create a dual receipt for an action.
 *
 * 1. Creates an HMAC-signed hash receipt (always succeeds)
 * 2. Publishes a memo to Solana (best-effort, non-blocking)
 * 3. Submits to ArkForge for third-party attestation (best-effort, non-blocking)
 * 4. Determines attestation_level based on which proofs succeeded
 * 5. Stores everything in Supabase `action_receipts` table
 *
 * Returns the dual receipt immediately. The blockchain receipt may be null
 * if on-chain publishing is not configured or fails.
 */
export async function createDualReceipt(
  action: ReceiptAction,
  agentId: string,
  data: Record<string, unknown>,
  authContext?: { trust_level?: number; permissions?: string[]; delegation_proof?: string }
): Promise<DualReceipt> {
  // 1. Hash receipt (instant, always works)
  const hashReceipt = createHashReceipt(action, agentId, data)

  // 2. On-chain memo (best-effort)
  const memoData: Record<string, unknown> = {
    protocol: 'agentid',
    version: 1,
    receipt_id: hashReceipt.receipt_id,
    action,
    agent_id: agentId,
    data_hash: hashReceipt.data_hash,
    timestamp: hashReceipt.timestamp,
  }
  if (authContext) {
    memoData.auth_context = authContext
  }
  const memoPayload = JSON.stringify(memoData)

  const blockchainReceipt = await publishMemoToSolana(memoPayload)

  // 3. ArkForge external attestation (best-effort, non-blocking)
  const arkforgeEndpoint = `https://getagentid.dev/api/v1/agents/${action}`
  const arkforgeProof = await submitToArkForge({
    protocol: 'agentid',
    version: 1,
    receipt_id: hashReceipt.receipt_id,
    action,
    agent_id: agentId,
    data_hash: hashReceipt.data_hash,
    signature: hashReceipt.signature,
    timestamp: hashReceipt.timestamp,
    ...(blockchainReceipt && { tx_hash: blockchainReceipt.tx_hash }),
  }, arkforgeEndpoint, agentId)

  // 4. Determine attestation level
  let attestation_level: AttestationLevel = 'self-issued'
  if (arkforgeProof?.proof_id) {
    attestation_level = 'third-party-attested'
  } else if (blockchainReceipt?.tx_hash) {
    attestation_level = 'domain-attested'
  }

  // 5. Store in Supabase
  try {
    const db = getServiceClient()
    await db.from('action_receipts').insert({
      receipt_id: hashReceipt.receipt_id,
      action,
      agent_id: agentId,
      timestamp: hashReceipt.timestamp,
      data_hash: hashReceipt.data_hash,
      signature: hashReceipt.signature,
      tx_hash: blockchainReceipt?.tx_hash || null,
      cluster: blockchainReceipt?.cluster || null,
      explorer_url: blockchainReceipt?.explorer_url || null,
      block_time: blockchainReceipt?.block_time || null,
      memo: blockchainReceipt?.memo || null,
      attestation_level,
      arkforge_proof_id: arkforgeProof?.proof_id || null,
      arkforge_verification_url: arkforgeProof?.verification_url || null,
      raw_data: authContext ? { ...data, auth_context: authContext } : data,
    })
  } catch (err: any) {
    // Non-blocking — receipt was already created in memory
    console.error('[receipts] Failed to store receipt in DB:', err.message || err)
  }

  return {
    hash: hashReceipt,
    blockchain: blockchainReceipt,
    attestation_level,
    arkforge: arkforgeProof,
  }
}
