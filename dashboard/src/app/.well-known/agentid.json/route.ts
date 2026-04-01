import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'

/**
 * GET /.well-known/agentid.json
 *
 * Federated discovery manifest for AgentID.
 * Makes the platform crawlable by federated registries.
 *
 * Returns:
 *   - Platform DID
 *   - Public endpoints for verification, trust headers, credibility packets
 *   - Total registered agent count
 *   - Supported capabilities and key types
 *   - Trust registry URL
 *
 * Public endpoint — no auth required.
 */

export async function GET(req: NextRequest) {
  try {
    const db = getServiceClient()

    // Count total active agents
    const { count: totalAgents } = await db
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .eq('active', true)

    // Count total receipts (proof of activity)
    const { count: totalReceipts } = await db
      .from('action_receipts')
      .select('*', { count: 'exact', head: true })

    // Get unique capabilities across all agents
    const { data: agents } = await db
      .from('agents')
      .select('capabilities')
      .eq('active', true)

    const allCapabilities = new Set<string>()
    for (const agent of agents || []) {
      const caps = agent.capabilities as string[] | null
      if (caps) {
        for (const cap of caps) {
          allCapabilities.add(cap)
        }
      }
    }

    const manifest = {
      '@context': 'https://getagentid.dev/schemas/agentid-manifest-v1',
      id: 'did:web:getagentid.dev',
      name: 'AgentID',
      description: 'Identity, trust, and verification layer for AI agents',
      version: '1.0.0',

      // Platform identity
      platform_did: 'did:web:getagentid.dev',
      issuer: 'https://getagentid.dev',

      // Statistics
      stats: {
        total_agents: totalAgents ?? 0,
        total_receipts: totalReceipts ?? 0,
        capabilities: Array.from(allCapabilities).sort(),
        generated_at: new Date().toISOString(),
      },

      // Supported key types
      supported_key_types: ['ecdsa-p256', 'ed25519', 'secp256k1'],

      // Trust levels
      trust_levels: {
        L1: 'Registered — certificate issued, can connect and verify',
        L2: 'Verified — Ed25519 key bound, cryptographic identity proven',
        L3: 'Secured — wallet bound, payments enabled',
        L4: 'Certified — entity verified, full autonomy',
      },

      // Public endpoints (no auth required)
      endpoints: {
        verify: 'https://getagentid.dev/api/v1/agents/verify',
        discover: 'https://getagentid.dev/api/v1/agents/discover',
        credibility_packet: 'https://getagentid.dev/api/v1/agents/credibility-packet',
        trust_header: 'https://getagentid.dev/api/v1/agents/trust-header',
        merkle_root: 'https://getagentid.dev/api/v1/agents/merkle-root',
        proof: 'https://getagentid.dev/proof/{receipt_id}',
        did_document: 'https://getagentid.dev/agent/{agent_id}/did.json',
        credentials: 'https://getagentid.dev/api/v1/agents/credentials',
      },

      // Trust registry
      trust_registry: 'https://getagentid.dev/.well-known/agent-trust.json',

      // Receipt format
      receipt_format: {
        hash_algorithm: 'HMAC-SHA256',
        compound_digest_signing: ['HMAC-SHA256', 'Ed25519'],
        ed25519_verification_key: 'xdpmjfq2DX4d6yML7QjaSkYB2h9Dm3phwts5gkAPBp8',
        ed25519_note: 'compound_digest_ed25519_signature can be verified with this public key — no platform secret needed',
        blockchain: 'solana',
        compound_digest: 'SHA-256 over hash(HashReceipt) + hash(BlockchainMemo) + action_ref + timestamp',
        policy_hash_chain: 'SHA-256(constraints_at_N + previous_policy_hash)',
        attestation_levels: ['self-issued', 'domain-attested'],
      },

      // Agent types
      agent_types: ['interactive', 'daemon', 'heartbeat'],

      // Interop
      protocols: ['A2A', 'MCP', 'DID:web'],
      specifications: {
        agent_trust_score_header: 'https://getagentid.dev/specs/agent-trust-score-header-v0.1',
        proof_spec: 'https://getagentid.dev/specs/agentid-proof-spec-v0.1',
        trust_levels: 'https://getagentid.dev/specs/trust-levels-v1.0',
      },
    }

    return NextResponse.json(manifest, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
