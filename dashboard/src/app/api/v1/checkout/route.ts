import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' as any })
}

const PRICES: Record<string, string> = {
  pro: 'price_1TCUsi14BefVjWWDgCHDqpRB',
  startup: 'price_1TCUsi14BefVjWWDgCHDqpRB', // legacy alias
  business: 'price_1TCUsj14BefVjWWDG9B9NNLM',
  enterprise: 'price_1TCUsk14BefVjWWDQwFSTAhr',
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_KEY || ''
    )
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const body = await req.json()
    const { plan } = body

    if (!plan || !PRICES[plan]) {
      return NextResponse.json({ error: 'Invalid plan. Use: pro, business, enterprise' }, { status: 400 })
    }

    // Create Stripe checkout session
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PRICES[plan], quantity: 1 }],
      success_url: `${req.headers.get('origin') || 'https://getagentid.dev'}/dashboard?upgraded=true`,
      cancel_url: `${req.headers.get('origin') || 'https://getagentid.dev'}/dashboard`,
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: { user_id: user.id, plan },
    })

    return NextResponse.json({ url: session.url })

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Checkout failed' }, { status: 500 })
  }
}
