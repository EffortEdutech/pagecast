import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Lazy init — avoids build-time crash when env var isn't set
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY env var is not set')
  return new Stripe(key, { apiVersion: '2026-04-22.dahlia' })
}

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session  = event.data.object as Stripe.Checkout.Session
    const bookId   = session.metadata?.bookId
    const userId   = session.metadata?.userId
    const paid     = (session.amount_total ?? 0) / 100
    const currency = session.currency ?? session.metadata?.currency ?? 'usd'

    if (bookId && userId) {
      const supabase = createAdminClient()
      // Upsert so duplicate webhooks are safe
      await supabase.from('purchases').upsert(
        {
          user_id: userId,
          book_id: bookId,
          price_paid: paid,
          stripe_session_id: session.id,
          currency,
        },
        { onConflict: 'user_id,book_id', ignoreDuplicates: true }
      )
    }
  }

  return NextResponse.json({ received: true })
}

// Stripe needs the raw body — disable Next.js body parsing
