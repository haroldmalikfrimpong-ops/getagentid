import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api-auth'
import Stripe from 'stripe'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' as any })
}

const PLAN_LIMITS: Record<string, { agent_limit: number; verification_limit: number }> = {
  startup: { agent_limit: 50, verification_limit: 50000 },
  business: { agent_limit: 500, verification_limit: 500000 },
  enterprise: { agent_limit: 999999, verification_limit: 999999 },
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const sig = req.headers.get('stripe-signature')

    let event: Stripe.Event

    if (process.env.STRIPE_WEBHOOK_SECRET && sig) {
      event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
    } else {
      event = JSON.parse(body) as Stripe.Event
    }

    const db = getServiceClient()

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.client_reference_id || session.metadata?.user_id
      const plan = session.metadata?.plan

      if (userId && plan && PLAN_LIMITS[plan]) {
        const limits = PLAN_LIMITS[plan]

        // Update user profile with new plan
        await db.from('profiles').upsert({
          id: userId,
          plan,
          agent_limit: limits.agent_limit,
          verification_limit: limits.verification_limit,
        })

        // Log the upgrade
        await db.from('agent_events').insert({
          agent_id: 'system',
          event_type: 'plan_upgraded',
          data: { user_id: userId, plan, limits },
        })
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      // Downgrade to free
      const sessions = await getStripe().checkout.sessions.list({
        customer: customerId,
        limit: 1,
      })

      if (sessions.data.length > 0) {
        const userId = sessions.data[0].client_reference_id
        if (userId) {
          await db.from('profiles').upsert({
            id: userId,
            plan: 'free',
            agent_limit: 5,
            verification_limit: 1000,
          })
        }
      }
    }

    return NextResponse.json({ received: true })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
