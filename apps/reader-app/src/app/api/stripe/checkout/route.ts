import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Lazy init — avoids build-time crash when env var isn't set
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY env var is not set')
  return new Stripe(key, { apiVersion: '2026-04-22.dahlia' })
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { bookId } = await req.json()
  if (!bookId) return NextResponse.json({ error: 'bookId required' }, { status: 400 })

  // Fetch book to get price + title
  const { data: book } = await supabase
    .from('books')
    .select('id, title, description, price, is_free')
    .eq('id', bookId)
    .eq('status', 'published')
    .single()

  if (!book) return NextResponse.json({ error: 'Book not found' }, { status: 404 })

  // Already owned? Skip checkout
  const { data: existing } = await supabase
    .from('purchases')
    .select('id')
    .eq('user_id', user.id)
    .eq('book_id', bookId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ alreadyOwned: true })
  }

  // Free book → record purchase directly, no Stripe needed
  if (book.is_free || book.price === 0) {
    await supabase.from('purchases').insert({
      user_id:    user.id,
      book_id:    bookId,
      price_paid: 0,
    })
    return NextResponse.json({ free: true })
  }

  const baseUrl = process.env.NEXT_PUBLIC_READER_URL ?? 'http://localhost:3800'

  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode:                'payment',
    payment_method_types:['card'],
    line_items: [{
      quantity: 1,
      price_data: {
        currency:     'usd',
        unit_amount:  Math.round(book.price * 100), // cents
        product_data: {
          name:        book.title,
          description: book.description ?? undefined,
          metadata:    { bookId },
        },
      },
    }],
    metadata: {
      bookId,
      userId: user.id,
      currency: 'usd',
    },
    success_url: `${baseUrl}/book/${bookId}?purchased=1`,
    cancel_url:  `${baseUrl}/book/${bookId}?cancelled=1`,
    customer_email: user.email,
  })

  return NextResponse.json({ url: session.url })
}
