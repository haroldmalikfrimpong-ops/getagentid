import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const capability = searchParams.get('capability')
    const owner = searchParams.get('owner')
    const credential_type = searchParams.get('credential_type')
    const is_online_filter = searchParams.get('is_online')
    const agent_type_filter = searchParams.get('agent_type')
    const limit = parseInt(searchParams.get('limit') || '20')

    const db = getServiceClient()
    let query = db
      .from('agents')
      .select('agent_id, name, description, owner, capabilities, platform, trust_score, verified, created_at, last_active, ed25519_key, wallet_address, wallet_chain, credentials, social_links, limitations, agent_type, heartbeat_interval, autonomy_level')
      .eq('active', true)
      .limit(Math.min(limit, 100))

    if (agent_type_filter && ['interactive', 'daemon', 'heartbeat'].includes(agent_type_filter)) {
      query = query.eq('agent_type', agent_type_filter)
    }

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

    // Filter by is_online if specified
    if (is_online_filter === 'true') {
      const onlineThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      results = results.filter((a: any) => a.last_active && a.last_active >= onlineThreshold)
    }

    // Add DID, supported_key_types, is_online, and limitations to each agent
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
      const socialLinks = a.social_links as any
      const is_online = a.last_active
        ? (Date.now() - new Date(a.last_active).getTime()) < 24 * 60 * 60 * 1000
        : false
      return {
        agent_id: a.agent_id,
        did,
        name: a.name,
        description: a.description,
        owner: a.owner,
        capabilities: a.capabilities,
        limitations: a.limitations || [],
        agent_type: a.agent_type || 'interactive',
        platform: a.platform,
        trust_score: a.trust_score,
        verified: a.verified,
        is_online,
        created_at: a.created_at,
        last_active: a.last_active,
        credentials: a.credentials || [],
        supported_key_types,
        social_links: a.social_links || null,
        social_verified: {
          github_linked: !!socialLinks?.github,
          x_linked: !!socialLinks?.x,
          website_linked: !!socialLinks?.website,
        },
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
