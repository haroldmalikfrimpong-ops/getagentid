import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const capability = searchParams.get('capability')
    const owner = searchParams.get('owner')
    const limit = parseInt(searchParams.get('limit') || '20')

    const db = getServiceClient()
    let query = db
      .from('agents')
      .select('agent_id, name, description, owner, capabilities, platform, trust_score, verified, created_at, last_active')
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

    return NextResponse.json({
      agents: results,
      count: results.length,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
