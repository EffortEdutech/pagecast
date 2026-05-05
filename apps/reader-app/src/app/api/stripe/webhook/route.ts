import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

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

    if (bookId && userId) {
      const supabase = createClient()
      // Upsert so duplicate webhooks are safe
      await supabase.from('purchases').upsert(
        { user_id: userId, book_id: bookId, price_paid: paid },
        { onConflict: 'user_id,book_id', ignoreDuplicates: true }
      )
    }
  }

  return NextResponse.json({ received: true })
}

// Stripe needs the raw body — disable Next.js body parsing
export const config = { api: { bodyParser: false } }
