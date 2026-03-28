import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'
import { trackUsage } from '@/lib/usage'

/**
 * POST /api/v1/agents/update-metadata
 *
 * Update optional metadata fields on an agent:
 *   - model_version: the LLM model version the agent runs (e.g. "gpt-4-turbo-2024-04-09")
 *   - prompt_hash: SHA-256 hash of the agent's system prompt
 *
 * Requires API key auth. Caller must own the agent.
 *
 * Body: { agent_id, model_version?, prompt_hash? }
 */

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await req.json()
    const { agent_id, model_version, prompt_hash, social_links } = body

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
    }

    if (!model_version && !prompt_hash && !social_links) {
      return NextResponse.json({ error: 'At least one of model_version, prompt_hash, or social_links is required' }, { status: 400 })
    }

    const db = getServiceClient()

    // Verify caller owns this agent
    const { data: agent, error: fetchError } = await db
      .from('agents')
      .select('agent_id, user_id, model_version, prompt_hash, social_links')
      .eq('agent_id', agent_id)
      .single()

    if (fetchError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.user_id !== auth.user_id) {
      return NextResponse.json({ error: 'You do not own this agent' }, { status: 403 })
    }

    // Build update object
    const updates: Record<string, any> = {}
    const events: any[] = []

    if (model_version !== undefined) {
      const previousVersion = agent.model_version || null
      updates.model_version = model_version

      // Log change event if the value actually changed
      if (previousVersion !== model_version) {
        events.push({
          agent_id,
          event_type: 'model_version_changed',
          data: {
            previous: previousVersion,
            current: model_version,
          },
        })
      }
    }

    if (prompt_hash !== undefined) {
      const previousHash = agent.prompt_hash || null
      updates.prompt_hash = prompt_hash

      if (previousHash !== prompt_hash) {
        events.push({
          agent_id,
          event_type: 'prompt_hash_changed',
          data: {
            previous: previousHash,
            current: prompt_hash,
          },
        })
      }
    }

    if (social_links !== undefined) {
      const previousLinks = (agent as any).social_links || null
      updates.social_links = social_links

      if (JSON.stringify(previousLinks) !== JSON.stringify(social_links)) {
        events.push({
          agent_id,
          event_type: 'social_links_changed',
          data: {
            previous: previousLinks,
            current: social_links,
          },
        })
      }
    }

    // Apply update
    const { error: updateError } = await db
      .from('agents')
      .update(updates)
      .eq('agent_id', agent_id)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update metadata' }, { status: 500 })
    }

    // Log events
    if (events.length > 0) {
      await db.from('agent_events').insert(events)
    }

    await trackUsage(auth.user_id, 'update_metadata')

    return NextResponse.json({
      agent_id,
      model_version: model_version !== undefined ? model_version : agent.model_version,
      prompt_hash: prompt_hash !== undefined ? prompt_hash : agent.prompt_hash,
      social_links: social_links !== undefined ? social_links : (agent as any).social_links || null,
      changes: events.map((e) => ({
        type: e.event_type,
        previous: e.data.previous,
        current: e.data.current,
      })),
      message: 'Metadata updated successfully',
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
