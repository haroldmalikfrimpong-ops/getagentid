import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, generateAgentId, issueCertificate, getServiceClient } from '@/lib/api-auth'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    // Parse body
    const body = await req.json()
    const { name, description, capabilities, platform, endpoint } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    // Check agent limit
    const db = getServiceClient()
    const { count } = await db
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', auth.user_id)

    const limit = auth.profile?.agent_limit || 5
    if ((count || 0) >= limit) {
      return NextResponse.json({
        error: `Agent limit reached (${count}/${limit}). Upgrade your plan.`,
      }, { status: 403 })
    }

    // Generate agent identity
    const agentId = generateAgentId()
    const owner = auth.profile?.company || auth.profile?.email || 'Unknown'
    const cert = issueCertificate(agentId, name, owner, capabilities || [])

    // Generate keypair (ECDSA)
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'P-256',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })

    // Store in database
    const { error: dbError } = await db.from('agents').insert({
      agent_id: agentId,
      name,
      description: description || '',
      owner,
      capabilities: capabilities || [],
      platform: platform || null,
      endpoint: endpoint || null,
      public_key: publicKey,
      certificate: cert.certificate,
      trust_score: 0,
      verified: false,
      active: true,
      user_id: auth.user_id,
    })

    if (dbError) {
      return NextResponse.json({ error: 'Failed to register agent' }, { status: 500 })
    }

    // Log event
    await db.from('agent_events').insert({
      agent_id: agentId,
      event_type: 'registered',
      data: { name, owner, capabilities },
    })

    return NextResponse.json({
      agent_id: agentId,
      name,
      owner,
      certificate: cert.certificate,
      public_key: publicKey,
      private_key: privateKey,
      issued_at: cert.issued_at,
      expires_at: cert.expires_at,
    }, { status: 201 })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
