import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const capability = searchParams.get('capability')
    const owner = searchParams.get('owner')
    const credential_type = searchParams.get('credential_type')
    const limit = parseInt(searchParams.get('limit') || '20')

    const db = getServiceClient()
    let query = db
      .from('agents')
      .select('agent_id, name, description, owner, capabilities, platform, trust_score, verified, created_at, last_active, ed25519_key, wallet_address, wallet_chain, credentials')
      .eq('active', true)
      .limit(Math.min(limit, 100))

    if (owner) {
      query = query.eq('owner', owner)
    }

    const { data: agents, error } = await query

    if (error) {
      return NextResponse.json({ error: 'Failed to search agents' }, { status: 500 })
    }

    let results = agents || []

    // Filter by capability if specified
    if (capability) {
      results = results.filter((a: any) =>
        a.capabilities?.some((c: string) => c.toLowerCase().includes(capability.toLowerCase()))
      )
    }

    // Filter by credential type if specified
    if (credential_type) {
      results = results.filter((a: any) => {
        const creds = a.credentials || []
        return creds.some((c: any) => c.type?.toLowerCase() === credential_type.toLowerCase())
      })
    }

    // Add DID and supported_key_types to each agent
    const enrichedResults = results.map((a: any) => {
      const did = `did:web:getagentid.dev:agent:${a.agent_id}`
      const supported_key_types: string[] = ['ecdsa-p256']
      if (a.ed25519_key) supported_key_types.push('ed25519')
      if (a.wallet_address && a.wallet_chain) {
        const chainKeyTypes: Record<string, string> = {
          ethereum: 'secp256k1',
          polygon: 'secp256k1',
          solana: 'ed25519',
        }
        const walletKeyType = chainKeyTypes[a.wallet_chain]
        if (walletKeyType && !supported_key_types.includes(walletKeyType)) {
          supported_key_types.push(walletKeyType)
        }
      }
      return {
        agent_id: a.agent_id,
        did,
        name: a.name,
        description: a.description,
        owner: a.owner,
        capabilities: a.capabilities,
        platform: a.platform,
        trust_score: a.trust_score,
        verified: a.verified,
        created_at: a.created_at,
        last_active: a.last_active,
        credentials: a.credentials || [],
        supported_key_types,
      }
    })

    return NextResponse.json({
      agents: enrichedResults,
      count: enrichedResults.length,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
