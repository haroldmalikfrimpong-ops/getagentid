import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, getServiceClient } from '@/lib/api-auth'
import { Connection, Keypair, Transaction, TransactionInstruction, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
const SOLANA_CLUSTER = process.env.SOLANA_CLUSTER || 'devnet'
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
const REGISTRY_KEYPAIR_JSON = process.env.AGENTID_REGISTRY_KEYPAIR_JSON // JSON string of the 64-byte secret key array

function getRegistryKeypair(): Keypair {
  if (!REGISTRY_KEYPAIR_JSON) {
    throw new Error(
      'AGENTID_REGISTRY_KEYPAIR_JSON env var not set. ' +
      'Set it to the JSON array from your registry keypair file (e.g. [12,34,56,...]).'
    )
  }
  const secretKey = Uint8Array.from(JSON.parse(REGISTRY_KEYPAIR_JSON))
  return Keypair.fromSecretKey(secretKey)
}

function explorerUrl(signature: string): string {
  const base = 'https://explorer.solana.com/tx'
  if (SOLANA_CLUSTER === 'mainnet-beta') return `${base}/${signature}`
  return `${base}/${signature}?cluster=${SOLANA_CLUSTER}`
}

function sha256(input: string): string {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(input).digest('hex')
}

// ---------------------------------------------------------------------------
// POST /api/v1/agents/publish-onchain
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    // Authenticate — only the agent owner can publish
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await req.json()
    const { agent_id } = body

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
    }

    // Fetch the agent record from the database
    const db = getServiceClient()
    const { data: agent, error: fetchError } = await db
      .from('agents')
      .select('agent_id, name, owner, public_key, trust_level, certificate, created_at, user_id, solana_tx_hash')
      .eq('agent_id', agent_id)
      .single()

    if (fetchError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Only the owner can publish their agent
    if (agent.user_id !== auth.user_id) {
      return NextResponse.json({ error: 'You can only publish your own agents' }, { status: 403 })
    }

    // Check if already published
    if (agent.solana_tx_hash) {
      return NextResponse.json({
        already_published: true,
        tx_hash: agent.solana_tx_hash,
        explorer_url: explorerUrl(agent.solana_tx_hash),
        message: 'Agent identity is already published on-chain',
      })
    }

    // Build the memo payload
    const memoPayload = {
      protocol: 'agentid',
      version: 1,
      agent_id: agent.agent_id,
      owner: agent.owner,
      public_key: (agent.public_key || '').substring(0, 128),
      trust_level: agent.trust_level ?? 1,
      registered_at: agent.created_at,
      certificate_hash: agent.certificate ? sha256(agent.certificate) : null,
    }

    const memoJson = JSON.stringify(memoPayload)

    if (Buffer.byteLength(memoJson, 'utf-8') > 700) {
      return NextResponse.json({ error: 'Memo payload too large' }, { status: 400 })
    }

    // Submit to Solana
    const registryKeypair = getRegistryKeypair()
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed')

    const memoInstruction = new TransactionInstruction({
      keys: [{ pubkey: registryKeypair.publicKey, isSigner: true, isWritable: true }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memoJson, 'utf-8'),
    })

    const transaction = new Transaction().add(memoInstruction)

    const signature = await sendAndConfirmTransaction(connection, transaction, [registryKeypair], {
      commitment: 'confirmed',
    })

    const txExplorerUrl = explorerUrl(signature)

    // Store the tx hash on the agent record
    await db
      .from('agents')
      .update({ solana_tx_hash: signature })
      .eq('agent_id', agent_id)

    // Log the event
    await db.from('agent_events').insert({
      agent_id,
      event_type: 'published_onchain',
      data: {
        tx_hash: signature,
        cluster: SOLANA_CLUSTER,
        registry_address: registryKeypair.publicKey.toBase58(),
      },
    })

    return NextResponse.json({
      tx_hash: signature,
      explorer_url: txExplorerUrl,
      registry_address: registryKeypair.publicKey.toBase58(),
      cluster: SOLANA_CLUSTER,
      memo: memoPayload,
    })

  } catch (e: any) {
    console.error('publish-onchain error:', e)

    // Provide helpful error messages for common issues
    if (e.message?.includes('AGENTID_REGISTRY_KEYPAIR_JSON')) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
    if (e.message?.includes('Attempt to debit an account but found no record')) {
      return NextResponse.json({
        error: 'Registry account has no SOL. Fund it with: solana airdrop 2 <address> --url devnet',
      }, { status: 500 })
    }

    return NextResponse.json({ error: e.message || 'Failed to publish on-chain' }, { status: 500 })
  }
}
