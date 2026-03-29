import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'

/**
 * GET /agent/:agent_id/did.json
 *
 * W3C DID Document resolution endpoint.
 * When someone resolves did:web:getagentid.dev:agent:agent_xxx,
 * the DID spec says fetch https://getagentid.dev/agent/agent_xxx/did.json
 *
 * Returns a W3C DID Core compliant document with:
 * - Agent identity (Ed25519 + ECDSA keys)
 * - Capabilities as service endpoints
 * - Verification methods
 *
 * Public endpoint — no auth required.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agent_id: string }> }
) {
  try {
    const { agent_id } = await params

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
    }

    const db = getServiceClient()
    const { data: agent, error } = await db
      .from('agents')
      .select('agent_id, name, description, owner, capabilities, platform, ed25519_key, public_key, wallet_address, wallet_chain, solana_address, active, social_links')
      .eq('agent_id', agent_id)
      .eq('active', true)
      .single()

    if (error || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const did = `did:web:getagentid.dev:agent:${agent.agent_id}`

    // Build verification methods
    const verificationMethods: any[] = []

    // ECDSA P-256 key (always present from registration)
    if (agent.public_key) {
      verificationMethods.push({
        id: `${did}#ecdsa-key-1`,
        type: 'EcdsaSecp256r1VerificationKey2019',
        controller: did,
        publicKeyPem: agent.public_key,
      })
    }

    // Ed25519 key (if bound)
    if (agent.ed25519_key) {
      verificationMethods.push({
        id: `${did}#ed25519-key-1`,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyHex: agent.ed25519_key,
      })
    }

    // Build service endpoints — capabilities as services
    const services: any[] = []

    // AgentID verification service
    services.push({
      id: `${did}#agentid-verify`,
      type: 'AgentIDVerification',
      serviceEndpoint: `https://getagentid.dev/api/v1/agents/verify`,
      description: 'Verify this agent\'s identity, trust level, and behavioural risk score',
    })

    // Credibility packet service
    services.push({
      id: `${did}#credibility-packet`,
      type: 'AgentIDCredibilityPacket',
      serviceEndpoint: `https://getagentid.dev/api/v1/agents/credibility-packet?agent_id=${agent.agent_id}`,
      description: 'Signed portable trust resume — offline verifiable',
    })

    // Proof history — signed execution receipts for auditors
    services.push({
      id: `${did}#proof-history`,
      type: 'AgentIDProofHistory',
      serviceEndpoint: `https://getagentid.dev/api/v1/agents/credibility-packet?agent_id=${agent.agent_id}`,
      description: 'Signed execution receipts, attestation count, negative/resolved signals, scarring score — independently verifiable',
    })

    // Trust header — short-lived signed JWT for transport-layer trust
    services.push({
      id: `${did}#trust-header`,
      type: 'AgentTrustScore',
      serviceEndpoint: `https://getagentid.dev/api/v1/agents/trust-header?agent_id=${agent.agent_id}`,
      description: 'Signed 1-hour JWT for Agent-Trust-Score HTTP header',
    })

    // Agent capabilities as a service
    if (agent.capabilities && agent.capabilities.length > 0) {
      services.push({
        id: `${did}#capabilities`,
        type: 'AgentCapability',
        serviceEndpoint: `https://getagentid.dev/api/v1/agents/discover?capability=${agent.capabilities[0]}`,
        capabilities: agent.capabilities,
        description: `Agent capabilities: ${agent.capabilities.join(', ')}`,
      })
    }

    // Solana wallet service (if bound)
    if (agent.solana_address) {
      const cluster = process.env.SOLANA_CLUSTER || 'devnet'
      services.push({
        id: `${did}#solana-wallet`,
        type: 'SolanaWallet',
        serviceEndpoint: `https://explorer.solana.com/address/${agent.solana_address}${cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`}`,
        chain: 'solana',
        address: agent.solana_address,
      })
    }

    // Build the DID Document
    const didDocument = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/ed2020/v1',
      ],
      id: did,
      controller: did,
      verificationMethod: verificationMethods,
      authentication: verificationMethods.map((vm: any) => vm.id),
      assertionMethod: verificationMethods.map((vm: any) => vm.id),
      service: services,
      metadata: {
        name: agent.name,
        description: agent.description,
        owner: agent.owner,
        platform: agent.platform,
        capabilities: agent.capabilities || [],
        social_links: agent.social_links || null,
      },
    }

    return NextResponse.json(didDocument, {
      headers: {
        'Content-Type': 'application/did+json',
        'Cache-Control': 'public, max-age=300',
      },
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
