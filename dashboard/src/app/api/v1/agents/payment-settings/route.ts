import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/api-auth'
import {
  addToAllowlist,
  removeFromAllowlist,
  getAllowlist,
  freezeAgentPayments,
  unfreezeAgentPayments,
  getFrozenAgents,
  approvePayment,
  denyPayment,
  getPendingApprovals,
} from '@/lib/payment-security'
import { trackUsage } from '@/lib/usage'

// ── POST /api/v1/agents/payment-settings ─────────────────────────────────────
//
// Owner-only actions for managing payment security settings.
//
// Actions:
//   { action: "add_allowlist",    wallet_address, chain, label }
//   { action: "remove_allowlist", wallet_address }
//   { action: "freeze",           agent_id }
//   { action: "unfreeze",         agent_id }
//   { action: "approve_payment",  payment_id }
//   { action: "deny_payment",     payment_id }

export async function POST(req: NextRequest) {
  try {
    // ── Authenticate ──────────────────────────────────────────────
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await req.json()
    const { action } = body

    if (!action) {
      return NextResponse.json({
        error: 'action is required',
        valid_actions: [
          'add_allowlist',
          'remove_allowlist',
          'freeze',
          'unfreeze',
          'approve_payment',
          'deny_payment',
        ],
      }, { status: 400 })
    }

    switch (action) {
      // ── Add wallet to allowlist ──────────────────────────────────
      case 'add_allowlist': {
        const { wallet_address, chain, label } = body

        if (!wallet_address) {
          return NextResponse.json({ error: 'wallet_address is required' }, { status: 400 })
        }
        if (!chain) {
          return NextResponse.json({ error: 'chain is required (solana, ethereum, polygon)' }, { status: 400 })
        }

        try {
          await addToAllowlist(auth.user_id, wallet_address, chain, label || '')
        } catch (e: any) {
          return NextResponse.json({ error: e.message }, { status: 400 })
        }

        await trackUsage(auth.user_id, 'payment_settings')

        return NextResponse.json({
          success: true,
          action: 'add_allowlist',
          wallet_address: wallet_address.trim(),
          chain,
          label: label || 'Unlabeled',
          message: 'Wallet added to allowlist. Agents can now pay this wallet.',
        })
      }

      // ── Remove wallet from allowlist ─────────────────────────────
      case 'remove_allowlist': {
        const { wallet_address } = body

        if (!wallet_address) {
          return NextResponse.json({ error: 'wallet_address is required' }, { status: 400 })
        }

        try {
          await removeFromAllowlist(auth.user_id, wallet_address)
        } catch (e: any) {
          return NextResponse.json({ error: e.message }, { status: 400 })
        }

        await trackUsage(auth.user_id, 'payment_settings')

        return NextResponse.json({
          success: true,
          action: 'remove_allowlist',
          wallet_address: wallet_address.trim(),
          message: 'Wallet removed from allowlist. Agents can no longer pay this wallet.',
        })
      }

      // ── Freeze agent payments ────────────────────────────────────
      case 'freeze': {
        const { agent_id } = body

        if (!agent_id) {
          return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
        }

        try {
          await freezeAgentPayments(auth.user_id, agent_id)
        } catch (e: any) {
          return NextResponse.json({ error: e.message }, { status: 400 })
        }

        await trackUsage(auth.user_id, 'payment_settings')

        return NextResponse.json({
          success: true,
          action: 'freeze',
          agent_id,
          message: 'All payments for this agent have been frozen.',
        })
      }

      // ── Unfreeze agent payments ──────────────────────────────────
      case 'unfreeze': {
        const { agent_id } = body

        if (!agent_id) {
          return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
        }

        try {
          await unfreezeAgentPayments(auth.user_id, agent_id)
        } catch (e: any) {
          return NextResponse.json({ error: e.message }, { status: 400 })
        }

        await trackUsage(auth.user_id, 'payment_settings')

        return NextResponse.json({
          success: true,
          action: 'unfreeze',
          agent_id,
          message: 'Payments for this agent have been unfrozen.',
        })
      }

      // ── Approve pending payment ──────────────────────────────────
      case 'approve_payment': {
        const { payment_id } = body

        if (!payment_id) {
          return NextResponse.json({ error: 'payment_id is required' }, { status: 400 })
        }

        try {
          await approvePayment(auth.user_id, payment_id)
        } catch (e: any) {
          return NextResponse.json({ error: e.message }, { status: 400 })
        }

        await trackUsage(auth.user_id, 'payment_settings')

        return NextResponse.json({
          success: true,
          action: 'approve_payment',
          payment_id,
          message: 'Payment approved. It can now be executed.',
        })
      }

      // ── Deny pending payment ─────────────────────────────────────
      case 'deny_payment': {
        const { payment_id } = body

        if (!payment_id) {
          return NextResponse.json({ error: 'payment_id is required' }, { status: 400 })
        }

        try {
          await denyPayment(auth.user_id, payment_id)
        } catch (e: any) {
          return NextResponse.json({ error: e.message }, { status: 400 })
        }

        await trackUsage(auth.user_id, 'payment_settings')

        return NextResponse.json({
          success: true,
          action: 'deny_payment',
          payment_id,
          message: 'Payment denied.',
        })
      }

      default:
        return NextResponse.json({
          error: `Unknown action "${action}"`,
          valid_actions: [
            'add_allowlist',
            'remove_allowlist',
            'freeze',
            'unfreeze',
            'approve_payment',
            'deny_payment',
          ],
        }, { status: 400 })
    }

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}

// ── GET /api/v1/agents/payment-settings ──────────────────────────────────────
//
// Returns the owner's payment security settings:
//   - allowlist (all pre-approved wallets)
//   - frozen_agents (agent IDs with frozen payments)
//   - pending_approvals (payments waiting for owner sign-off)

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    // Fetch all settings in parallel
    const [allowlist, frozenAgents, pendingApprovals] = await Promise.all([
      getAllowlist(auth.user_id),
      getFrozenAgents(auth.user_id),
      getPendingApprovals(auth.user_id),
    ])

    return NextResponse.json({
      allowlist: {
        count: allowlist.length,
        wallets: allowlist,
      },
      frozen_agents: {
        count: frozenAgents.length,
        agent_ids: frozenAgents,
      },
      pending_approvals: {
        count: pendingApprovals.length,
        payments: pendingApprovals,
      },
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 })
  }
}
