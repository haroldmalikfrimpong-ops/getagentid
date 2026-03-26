import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'
import { Connection, PublicKey } from '@solana/web3.js'

/**
 * GET /api/v1/agents/balance?agent_id=xxx
 *
 * Returns the SOL and USDC balances for an agent's auto-derived Solana wallet.
 * The agent must have an Ed25519 key bound (which auto-derives the Solana address).
 *
 * Public endpoint — no API key required. Anyone can check an agent's balance
 * (just like anyone can check a Solana address on-chain).
 */

// USDC mint addresses per cluster
const USDC_MINTS: Record<string, string> = {
  'mainnet-beta': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
}

const SOLANA_CLUSTER = process.env.SOLANA_CLUSTER || 'devnet'

const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ||
  (SOLANA_CLUSTER === 'mainnet-beta'
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com')

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('agent_id')

    if (!agentId) {
      return NextResponse.json(
        { error: 'agent_id query parameter is required' },
        { status: 400 }
      )
    }

    // Look up the agent's Solana address
    const db = getServiceClient()
    const { data: agent, error } = await db
      .from('agents')
      .select('agent_id, name, solana_address, ed25519_key')
      .eq('agent_id', agentId)
      .single()

    if (error || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (!agent.solana_address) {
      return NextResponse.json(
        {
          error: 'Agent does not have a Solana wallet yet. Bind an Ed25519 key first via POST /api/v1/agents/bind-ed25519',
          agent_id: agentId,
        },
        { status: 404 }
      )
    }

    // Query Solana RPC for balances
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed')
    const pubkey = new PublicKey(agent.solana_address)

    // SOL balance
    const lamports = await connection.getBalance(pubkey)
    const solBalance = (lamports / 1e9).toFixed(9)

    // USDC balance (SPL token)
    let usdcBalance = '0.000000'
    const usdcMint = USDC_MINTS[SOLANA_CLUSTER]

    if (usdcMint) {
      try {
        const mintPubkey = new PublicKey(usdcMint)
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
          mint: mintPubkey,
        })

        if (tokenAccounts.value.length > 0) {
          // getParsedTokenAccountsByOwner returns parsed JSON with uiAmount
          const parsed = tokenAccounts.value[0].account.data as any
          const uiAmount = parsed?.parsed?.info?.tokenAmount?.uiAmount
          if (uiAmount != null) {
            usdcBalance = Number(uiAmount).toFixed(6)
          }
        }
      } catch (err: any) {
        console.error('[balance] Failed to fetch USDC balance:', err.message)
        // Non-blocking — return SOL balance even if USDC lookup fails
      }
    }

    // Explorer URLs
    const explorerBase = 'https://explorer.solana.com/address'
    const clusterParam = SOLANA_CLUSTER === 'mainnet-beta' ? '' : `?cluster=${SOLANA_CLUSTER}`

    return NextResponse.json({
      agent_id: agentId,
      name: agent.name,
      solana_address: agent.solana_address,
      cluster: SOLANA_CLUSTER,
      balances: {
        sol: solBalance,
        usdc: usdcBalance,
      },
      explorer_url: `${explorerBase}/${agent.solana_address}${clusterParam}`,
      rpc_url: SOLANA_RPC_URL,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || 'Internal error' },
      { status: 500 }
    )
  }
}
