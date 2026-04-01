/**
 * Merkle Tree for AgentID Receipts
 *
 * Batches receipts into a binary SHA-256 Merkle tree.
 * Enables:
 *   - proveInclusion: O(log n) proof that a receipt is in the batch
 *   - Selective disclosure: share one receipt without revealing others
 *   - Merkle root anchoring: publish root to Solana for batch verification
 *
 * The Merkle root covers ALL receipts for an agent, anchored to Solana.
 */

import { sha256 } from './receipts'
import { getServiceClient } from './api-auth'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MerkleProof {
  receipt_id: string
  leaf_hash: string
  proof: Array<{ hash: string; position: 'left' | 'right' }>
  root: string
  leaf_index: number
  total_leaves: number
}

export interface MerkleRoot {
  root: string
  leaf_count: number
  computed_at: string
  agent_id: string
}

// ---------------------------------------------------------------------------
// Build Merkle tree from leaf hashes
// ---------------------------------------------------------------------------

function buildTree(leaves: string[]): { root: string; layers: string[][] } {
  if (leaves.length === 0) {
    return { root: sha256('empty'), layers: [[sha256('empty')]] }
  }

  // Ensure even number of leaves by duplicating last if odd
  const paddedLeaves = [...leaves]
  if (paddedLeaves.length % 2 !== 0) {
    paddedLeaves.push(paddedLeaves[paddedLeaves.length - 1])
  }

  const layers: string[][] = [paddedLeaves]
  let currentLayer = paddedLeaves

  while (currentLayer.length > 1) {
    const nextLayer: string[] = []
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i]
      const right = currentLayer[i + 1] || left
      nextLayer.push(sha256(left + right))
    }
    layers.push(nextLayer)
    currentLayer = nextLayer
  }

  return { root: currentLayer[0], layers }
}

// ---------------------------------------------------------------------------
// Generate inclusion proof for a specific leaf
// ---------------------------------------------------------------------------

function generateProof(
  leafIndex: number,
  layers: string[][]
): Array<{ hash: string; position: 'left' | 'right' }> {
  const proof: Array<{ hash: string; position: 'left' | 'right' }> = []
  let idx = leafIndex

  for (let i = 0; i < layers.length - 1; i++) {
    const layer = layers[i]
    const isRight = idx % 2 === 1
    const siblingIdx = isRight ? idx - 1 : idx + 1

    if (siblingIdx < layer.length) {
      proof.push({
        hash: layer[siblingIdx],
        position: isRight ? 'left' : 'right',
      })
    }

    idx = Math.floor(idx / 2)
  }

  return proof
}

// ---------------------------------------------------------------------------
// Verify an inclusion proof
// ---------------------------------------------------------------------------

export function verifyProof(
  leafHash: string,
  proof: Array<{ hash: string; position: 'left' | 'right' }>,
  root: string
): boolean {
  let currentHash = leafHash

  for (const step of proof) {
    if (step.position === 'left') {
      currentHash = sha256(step.hash + currentHash)
    } else {
      currentHash = sha256(currentHash + step.hash)
    }
  }

  return currentHash === root
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the Merkle root for all of an agent's receipts.
 */
export async function computeMerkleRoot(agentId: string): Promise<MerkleRoot> {
  const db = getServiceClient()

  const { data: receipts } = await db
    .from('action_receipts')
    .select('receipt_id, data_hash, timestamp')
    .eq('agent_id', agentId)
    .order('timestamp', { ascending: true })

  const leaves = (receipts || []).map((r: any) =>
    sha256(`${r.receipt_id}:${r.data_hash}:${r.timestamp}`)
  )

  const { root } = buildTree(leaves)

  return {
    root,
    leaf_count: receipts?.length || 0,
    computed_at: new Date().toISOString(),
    agent_id: agentId,
  }
}

/**
 * Generate an inclusion proof for a specific receipt.
 * Returns null if the receipt is not found.
 */
export async function proveInclusion(
  agentId: string,
  receiptId: string
): Promise<MerkleProof | null> {
  const db = getServiceClient()

  const { data: receipts } = await db
    .from('action_receipts')
    .select('receipt_id, data_hash, timestamp')
    .eq('agent_id', agentId)
    .order('timestamp', { ascending: true })

  if (!receipts || receipts.length === 0) return null

  const leaves = receipts.map((r: any) =>
    sha256(`${r.receipt_id}:${r.data_hash}:${r.timestamp}`)
  )

  const leafIndex = receipts.findIndex((r: any) => r.receipt_id === receiptId)
  if (leafIndex === -1) return null

  const { root, layers } = buildTree(leaves)
  const proof = generateProof(leafIndex, layers)

  return {
    receipt_id: receiptId,
    leaf_hash: leaves[leafIndex],
    proof,
    root,
    leaf_index: leafIndex,
    total_leaves: receipts.length,
  }
}
