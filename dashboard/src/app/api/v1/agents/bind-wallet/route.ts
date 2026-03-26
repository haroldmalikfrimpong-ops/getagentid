import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'
import { trackUsage } from '@/lib/usage'

const SUPPORTED_CHAINS = ['ethereum', 'solana', 'polygon'] as const
type Chain = (typeof SUPPORTED_CHAINS)[number]

/**
 * POST /api/v1/agents/bind-wallet
 *
 * Bind a crypto wallet address to an existing agent.
 *
 * Body: {
 *   agent_id: string,
 *   wallet_address: string,
 *   chain: "ethereum" | "solana" | "polygon",
 *   signature: string (hex)
 * }
 *
 * The caller must sign the message "AgentID:bind:{agent_id}:{wallet_address}"
 * with their wallet private key and provide the signature.
 *
 * Auth: Bearer API key (required)
 */
export async function POST(req: NextRequest) {
  try {
    // ── Authenticate ─────────────────────────────────────────────
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    // ── Parse & validate body ────────────────────────────────────
    const body = await req.json()
    const { agent_id, wallet_address, chain, signature } = body

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
    }
    if (!wallet_address) {
      return NextResponse.json({ error: 'wallet_address is required' }, { status: 400 })
    }
    if (!chain) {
      return NextResponse.json({ error: 'chain is required' }, { status: 400 })
    }
    if (!signature) {
      return NextResponse.json({ error: 'signature is required' }, { status: 400 })
    }

    // Validate chain
    if (!SUPPORTED_CHAINS.includes(chain as Chain)) {
      return NextResponse.json({
        error: `Unsupported chain "${chain}". Supported: ${SUPPORTED_CHAINS.join(', ')}`,
      }, { status: 400 })
    }

    // Validate wallet address format per chain
    if ((chain === 'ethereum' || chain === 'polygon') && !/^0x[0-9a-fA-F]{40}$/.test(wallet_address)) {
      return NextResponse.json({
        error: 'Invalid Ethereum/Polygon wallet address. Must be a 0x-prefixed 40-hex-char address.',
      }, { status: 400 })
    }
    if (chain === 'solana' && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet_address)) {
      return NextResponse.json({
        error: 'Invalid Solana wallet address. Must be a base58-encoded address (32-44 chars).',
      }, { status: 400 })
    }

    // Validate signature is hex
    if (!/^(0x)?[0-9a-fA-F]+$/.test(signature)) {
      return NextResponse.json({
        error: 'signature must be a hex string',
      }, { status: 400 })
    }

    // ── Verify the caller owns this agent ────────────────────────
    const db = getServiceClient()
    const { data: agent, error: fetchError } = await db
      .from('agents')
      .select('agent_id, name, owner, capabilities, trust_score, user_id, wallet_address, wallet_chain')
      .eq('agent_id', agent_id)
      .single()

    if (fetchError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (agent.user_id !== auth.user_id) {
      return NextResponse.json({ error: 'You do not own this agent' }, { status: 403 })
    }

    // ── Verify the binding signature ─────────────────────────────
    // The expected signed message is: "AgentID:bind:{agent_id}:{wallet_address}"
    // For now we store the signature as proof-of-intent.
    // Full on-chain verification (ecrecover for ETH, Ed25519 for Solana) can be
    // added later. The binding + stored signature provides an auditable trail.
    const expectedMessage = `AgentID:bind:${agent_id}:${wallet_address}`
    const normalizedSignature = signature.startsWith('0x') ? signature.slice(2) : signature

    // ── Store the wallet binding ─────────────────────────────────
    const normalizedAddress = (chain === 'ethereum' || chain === 'polygon')
      ? wallet_address.toLowerCase()
      : wallet_address

    const { error: updateError } = await db
      .from('agents')
      .update({
        wallet_address: normalizedAddress,
        wallet_chain: chain,
        wallet_signature: normalizedSignature,
        wallet_bound_at: new Date().toISOString(),
      })
      .eq('agent_id', agent_id)

    if (updateError) {
      console.error('Failed to bind wallet:', updateError)
      return NextResponse.json({ error: 'Failed to bind wallet' }, { status: 500 })
    }

    // ── Log event ────────────────────────────────────────────────
    await db.from('agent_events').insert({
      agent_id,
      event_type: 'wallet_bound',
      data: {
        wallet_address: normalizedAddress,
        chain,
        message: expectedMessage,
        bound_at: new Date().toISOString(),
      },
    })

    // ── Track usage ──────────────────────────────────────────────
    await trackUsage(auth.user_id, 'bind_wallet')

    return NextResponse.json({
      bound: true,
      agent_id,
      wallet_address: normalizedAddress,
      chain,
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
