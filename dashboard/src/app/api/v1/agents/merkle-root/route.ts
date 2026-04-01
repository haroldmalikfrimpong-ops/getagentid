import { NextRequest, NextResponse } from 'next/server'
import { computeMerkleRoot, proveInclusion, verifyProof } from '@/lib/merkle'

/**
 * GET /api/v1/agents/merkle-root?agent_id=...
 *
 * Returns the Merkle root over all receipts for an agent.
 * Public endpoint — no auth required.
 *
 * Optional: ?receipt_id=... to get an inclusion proof for a specific receipt.
 * The proof allows a verifier to confirm the receipt is in the batch with
 * O(log n) verification — without downloading the full receipt history.
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const agent_id = searchParams.get('agent_id')
    const receipt_id = searchParams.get('receipt_id')

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id query parameter is required' }, { status: 400 })
    }

    // If receipt_id is provided, return an inclusion proof
    if (receipt_id) {
      const proof = await proveInclusion(agent_id, receipt_id)

      if (!proof) {
        return NextResponse.json({
          error: 'Receipt not found for this agent',
          agent_id,
          receipt_id,
        }, { status: 404 })
      }

      // Verify the proof ourselves before returning it
      const valid = verifyProof(proof.leaf_hash, proof.proof, proof.root)

      return NextResponse.json({
        protocol: 'agentid',
        version: 1,
        type: 'merkle-inclusion-proof',
        agent_id,
        receipt_id,
        merkle_root: proof.root,
        leaf_hash: proof.leaf_hash,
        leaf_index: proof.leaf_index,
        total_leaves: proof.total_leaves,
        proof: proof.proof,
        self_verified: valid,
        verification_note: 'To verify: start with leaf_hash, for each proof step combine with sibling (left/right), SHA-256 the pair. Final hash must equal merkle_root.',
      })
    }

    // Otherwise return just the Merkle root
    const merkleRoot = await computeMerkleRoot(agent_id)

    return NextResponse.json({
      protocol: 'agentid',
      version: 1,
      type: 'merkle-root',
      agent_id,
      did: `did:web:getagentid.dev:agent:${agent_id}`,
      merkle_root: merkleRoot.root,
      leaf_count: merkleRoot.leaf_count,
      computed_at: merkleRoot.computed_at,
      note: 'Add ?receipt_id=... to get an inclusion proof for a specific receipt.',
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
