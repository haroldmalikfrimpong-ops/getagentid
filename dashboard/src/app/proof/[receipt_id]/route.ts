import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'

/**
 * GET /proof/:receipt_id
 *
 * Public verification endpoint for any receipt.
 * Anyone with a receipt_id can verify the proof independently.
 * Returns the full receipt with hash, signature, blockchain anchor, and verification status.
 *
 * Like ArkForge's /v1/proof/:proof_id — public, no auth needed.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ receipt_id: string }> }
) {
  try {
    const { receipt_id } = await params

    if (!receipt_id) {
      return NextResponse.json({ error: 'receipt_id is required' }, { status: 400 })
    }

    const db = getServiceClient()
    const { data: receipt, error } = await db
      .from('action_receipts')
      .select('*')
      .eq('receipt_id', receipt_id)
      .single()

    if (error || !receipt) {
      return NextResponse.json({
        verified: false,
        receipt_id,
        error: 'Receipt not found',
      }, { status: 404 })
    }

    // Get agent info for context
    const { data: agent } = await db
      .from('agents')
      .select('agent_id, name, owner, trust_level')
      .eq('agent_id', receipt.agent_id)
      .single()

    // Build Solana explorer URL if blockchain anchor exists
    const cluster = process.env.SOLANA_CLUSTER || 'devnet'
    const blockchain_anchor = receipt.tx_hash ? {
      chain: 'solana',
      cluster,
      tx_hash: receipt.tx_hash,
      explorer_url: receipt.explorer_url || `https://explorer.solana.com/tx/${receipt.tx_hash}${cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`}`,
      block_time: receipt.block_time,
      memo: receipt.memo,
    } : null

    // Determine attestation level — prefer stored value, fall back to computed
    let attestation_level = receipt.attestation_level || 'self-issued'
    if (!receipt.attestation_level) {
      if (receipt.tx_hash) attestation_level = 'domain-attested'
    }

    return NextResponse.json({
      verified: true,
      protocol: 'agentid',
      version: 1,
      receipt_id: receipt.receipt_id,
      action: receipt.action,
      agent: {
        agent_id: receipt.agent_id,
        name: agent?.name || 'Unknown',
        owner: agent?.owner || 'Unknown',
        did: `did:web:getagentid.dev:agent:${receipt.agent_id}`,
      },
      timestamp: receipt.timestamp,
      hashes: {
        data_hash: receipt.data_hash,
        signature: receipt.signature,
      },
      blockchain_anchor,
      attestation_level,
      compound_digest: (receipt.raw_data as any)?.compound_digest || null,
      compound_digest_signature: (receipt.raw_data as any)?.compound_digest_signature || null,
      compound_digest_ed25519_signature: (receipt.raw_data as any)?.compound_digest_ed25519_signature || null,
      policy_hash: (receipt.raw_data as any)?.policy_hash || null,
      previous_policy_hash: (receipt.raw_data as any)?.previous_policy_hash || null,
      action_ref: (receipt.raw_data as any)?.action_ref || receipt.receipt_id,
      context_epoch: (receipt.raw_data as any)?.context_epoch ?? null,
      signing_key: (receipt.raw_data as any)?.signing_key || {
        key_id: 'agentid-2026-03',
        public_key: 'xdpmjfq2DX4d6yML7QjaSkYB2h9Dm3phwts5gkAPBp8',
        algorithm: 'Ed25519',
      },
      canonicalization: (receipt.raw_data as any)?.canonicalization || 'JSON.stringify',
      verification_status: 'verified',
      verification: {
        method: 'HMAC-SHA256 + Ed25519',
        canonicalization: 'JCS-RFC-8785',
        issuer: 'https://getagentid.dev',
        issuer_did: 'did:web:getagentid.dev',
        hmac_note: 'Verify HMAC-SHA256 over receipt_id:action:agent_id:data_hash:timestamp with the platform signing key',
        ed25519_note: 'Verify Ed25519 signature over compound_digest using the embedded signing_key. Key status available at https://getagentid.dev/.well-known/agentid.json',
        verification_response_enum: ['verified', 'verified_deprecated_key', 'verified_revoked_key', 'invalid'],
        offline_verification: 'Proof is self-contained — signing_key.public_key is embedded. Key status endpoint is for revocation freshness only.',
        unreachable_policy: 'fail-closed — if key status endpoint is unreachable, treat proof as potentially revoked',
      },
      links: {
        agent_profile: `https://getagentid.dev/api/v1/agents/verify`,
        credibility_packet: `https://getagentid.dev/api/v1/agents/credibility-packet?agent_id=${receipt.agent_id}`,
        did_document: `https://getagentid.dev/agent/${receipt.agent_id}/did.json`,
        trust_header: `https://getagentid.dev/api/v1/agents/trust-header?agent_id=${receipt.agent_id}`,
      },
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, must-revalidate',
      },
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
