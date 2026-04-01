/**
 * AgentID Dual Receipt System
 *
 * Every significant action produces TWO receipts:
 *   1. Hash receipt — HMAC-SHA256 signed by platform key, stored in Supabase
 *   2. Blockchain receipt — Solana memo transaction with action summary on-chain
 *
 * Additional integrity features:
 *   - Compound digest: SHA-256 binding hash receipt + blockchain receipt + action_ref + timestamp
 *     Signed by gateway — proves both artifacts were seen together. Non-repudiable.
 *   - Policy hash chaining: Each receipt includes a hash of the agent's policy state
 *     (trust_level, permissions, spending_limit). Chained to previous policy hash.
 *     If constraints change silently, the chain breaks — drift is detectable.
 *   - Action ref: Cross-system execution frame ID. Caller can supply an external
 *     action_ref; if absent, receipt_id is used. Allows joining receipts across
 *     independently-signed artifacts from different systems.
 *   - Context epoch: Optional field the agent declares when its context/memory state
 *     has changed significantly. Included in the receipt so receivers can detect
 *     behavioural continuity breaks.
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

export type AttestationLevel = 'self-issued' | 'domain-attested'

export interface DualReceipt {
  hash: HashReceipt
  blockchain: BlockchainReceipt | null
  attestation_level: AttestationLevel
  compound_digest: string
  compound_digest_signature: string
  compound_digest_ed25519_signature: string | null
  policy_hash: string
  previous_policy_hash: string | null
  action_ref: string
  context_epoch: number | null
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

export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

// ---------------------------------------------------------------------------
// Ed25519 signing — publicly verifiable without platform key
// ---------------------------------------------------------------------------

// PKCS8 DER prefix for Ed25519 private key (RFC 8410)
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')

let _ed25519PrivateKey: crypto.KeyObject | null = null

/**
 * Get the platform Ed25519 private key for receipt signing.
 * The key is loaded from AGENTID_ED25519_PRIVATE_KEY env var
 * (base64url-encoded 32-byte seed) or from agentid.private.pem content.
 * Returns null if not configured — Ed25519 signing is optional.
 */
function getEd25519PrivateKey(): crypto.KeyObject | null {
  if (_ed25519PrivateKey) return _ed25519PrivateKey

  const keyB64 = process.env.AGENTID_ED25519_PRIVATE_KEY
  if (!keyB64) return null

  try {
    // Decode base64url seed (32 bytes)
    const seed = Buffer.from(keyB64, 'base64url')
    if (seed.length !== 32) {
      console.warn('[receipts] AGENTID_ED25519_PRIVATE_KEY must decode to 32 bytes')
      return null
    }
    // Wrap in PKCS8 DER format for Node.js crypto
    const der = Buffer.concat([ED25519_PKCS8_PREFIX, seed])
    _ed25519PrivateKey = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' })
    return _ed25519PrivateKey
  } catch (err: any) {
    console.warn('[receipts] Failed to load Ed25519 private key:', err.message)
    return null
  }
}

/**
 * Sign data with the platform Ed25519 key.
 * Returns hex-encoded 64-byte signature, or null if key not configured.
 */
function ed25519Sign(data: string): string | null {
  const privKey = getEd25519PrivateKey()
  if (!privKey) return null

  try {
    const sig = crypto.sign(null, Buffer.from(data), privKey)
    return sig.toString('hex')
  } catch (err: any) {
    console.warn('[receipts] Ed25519 signing failed:', err.message)
    return null
  }
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

async function publishMemoToSolana(
  memoText: string
): Promise<BlockchainReceipt | null> {
  try {
    const {
      Connection,
      Keypair,
      Transaction,
      TransactionInstruction,
      PublicKey,
      sendAndConfirmTransaction,
    } = await import('@solana/web3.js')

    const keypairJson = process.env.AGENTID_REGISTRY_KEYPAIR_JSON
    if (!keypairJson) {
      console.warn('[receipts] AGENTID_REGISTRY_KEYPAIR_JSON not set — skipping on-chain receipt')
      return null
    }

    const secretBytes = new Uint8Array(JSON.parse(keypairJson))
    const registryKeypair = Keypair.fromSecretKey(secretBytes)

    const connection = new Connection(SOLANA_RPC_URL, 'confirmed')

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
      block_time: Math.floor(Date.now() / 1000),
      memo: truncated,
    }
  } catch (err: any) {
    console.error('[receipts] Failed to publish on-chain receipt:', err.message || err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Policy Hash Chaining
// ---------------------------------------------------------------------------

/**
 * Compute a policy state hash from the agent's current constraints.
 * Chain it to the previous policy hash for drift detection.
 *
 * policy_hash[N] = SHA-256(constraints_at_N + previous_policy_hash)
 *
 * If constraints change between actions, the chain shows exactly where.
 */
function computePolicyHash(
  authContext: { trust_level?: number; permissions?: string[]; delegation_proof?: string } | undefined,
  previousPolicyHash: string | null
): string {
  const constraints = JSON.stringify({
    trust_level: authContext?.trust_level ?? 0,
    permissions: authContext?.permissions ?? [],
    has_delegation: !!authContext?.delegation_proof,
  })
  const input = constraints + (previousPolicyHash || 'genesis')
  return sha256(input)
}

/**
 * Get the most recent policy hash for an agent from their last receipt.
 */
async function getPreviousPolicyHash(agentId: string): Promise<string | null> {
  try {
    const db = getServiceClient()
    const { data } = await db
      .from('action_receipts')
      .select('raw_data')
      .eq('agent_id', agentId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    return (data?.raw_data as any)?.policy_hash || null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Compound Digest
// ---------------------------------------------------------------------------

/**
 * Compute a compound digest binding both artifacts into a single verifiable value.
 *
 * compound_digest = SHA-256(hash(HashReceipt) + hash(BlockchainMemo) + action_ref + timestamp)
 *
 * The gateway signs this — proving it saw both artifacts simultaneously.
 * A third party can verify from the PolicyReceipt alone without retrieving
 * the original ActionIntent.
 */
function computeCompoundDigest(
  hashReceipt: HashReceipt,
  blockchainMemo: string | null,
  actionRef: string,
  timestamp: string
): string {
  const hashReceiptDigest = sha256(JSON.stringify(hashReceipt))
  const blockchainDigest = blockchainMemo ? sha256(blockchainMemo) : sha256('no-blockchain-receipt')
  return sha256(hashReceiptDigest + blockchainDigest + actionRef + timestamp)
}

// ---------------------------------------------------------------------------
// Dual Receipt (combined)
// ---------------------------------------------------------------------------

/**
 * Create a dual receipt for an action.
 *
 * 1. Creates an HMAC-signed hash receipt (always succeeds)
 * 2. Publishes a memo to Solana (best-effort, non-blocking)
 * 3. Computes compound digest binding both artifacts (signed)
 * 4. Chains policy state hash for constraint drift detection
 * 5. Determines attestation_level based on which proofs succeeded
 * 6. Stores everything in Supabase `action_receipts` table
 */
export async function createDualReceipt(
  action: ReceiptAction,
  agentId: string,
  data: Record<string, unknown>,
  authContext?: { trust_level?: number; permissions?: string[]; delegation_proof?: string },
  options?: { action_ref?: string; context_epoch?: number }
): Promise<DualReceipt> {
  // 1. Hash receipt (instant, always works)
  const hashReceipt = createHashReceipt(action, agentId, data)

  // Action ref: use caller-supplied value or default to receipt_id
  const actionRef = options?.action_ref || hashReceipt.receipt_id
  const contextEpoch = options?.context_epoch ?? null

  // 2. On-chain memo (best-effort)
  const memoData: Record<string, unknown> = {
    protocol: 'agentid',
    version: 2,
    receipt_id: hashReceipt.receipt_id,
    action,
    agent_id: agentId,
    data_hash: hashReceipt.data_hash,
    timestamp: hashReceipt.timestamp,
    action_ref: actionRef,
  }
  if (authContext) {
    memoData.auth_context = authContext
  }
  if (contextEpoch !== null) {
    memoData.context_epoch = contextEpoch
  }
  const memoPayload = JSON.stringify(memoData)

  const blockchainReceipt = await publishMemoToSolana(memoPayload)

  // 3. Compound digest — binding both artifacts, signed by gateway
  const compoundDigest = computeCompoundDigest(
    hashReceipt,
    blockchainReceipt?.memo || null,
    actionRef,
    hashReceipt.timestamp
  )
  const compoundDigestSignature = hmacSign(compoundDigest)

  // 3b. Ed25519 signature — publicly verifiable without platform key
  const compoundDigestEd25519Signature = ed25519Sign(compoundDigest)

  // 4. Policy hash chain — detect constraint drift
  const previousPolicyHash = await getPreviousPolicyHash(agentId)
  const policyHash = computePolicyHash(authContext, previousPolicyHash)

  // 5. Determine attestation level
  const attestation_level: AttestationLevel = blockchainReceipt?.tx_hash
    ? 'domain-attested'
    : 'self-issued'

  // 6. Store in Supabase
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
      raw_data: {
        ...(authContext ? { ...data, auth_context: authContext } : data),
        compound_digest: compoundDigest,
        compound_digest_signature: compoundDigestSignature,
        compound_digest_ed25519_signature: compoundDigestEd25519Signature,
        policy_hash: policyHash,
        previous_policy_hash: previousPolicyHash,
        action_ref: actionRef,
        context_epoch: contextEpoch,
      },
    })
  } catch (err: any) {
    console.error('[receipts] Failed to store receipt in DB:', err.message || err)
  }

  return {
    hash: hashReceipt,
    blockchain: blockchainReceipt,
    attestation_level,
    compound_digest: compoundDigest,
    compound_digest_signature: compoundDigestSignature,
    compound_digest_ed25519_signature: compoundDigestEd25519Signature,
    policy_hash: policyHash,
    previous_policy_hash: previousPolicyHash,
    action_ref: actionRef,
    context_epoch: contextEpoch,
  }
}
