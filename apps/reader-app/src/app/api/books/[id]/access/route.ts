import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const bookId = params.id

  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('id, is_free, price')
    .eq('id', bookId)
    .eq('status', 'published')
    .maybeSingle()

  if (bookError) {
    return NextResponse.json({ error: bookError.message }, { status: 500 })
  }

  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  if (book.is_free || Number(book.price) === 0) {
    return NextResponse.json({ hasAccess: true, reason: 'free' })
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ hasAccess: false, reason: 'unauthenticated' })
  }

  const { data: purchase } = await supabase
    .from('purchases')
    .select('id')
    .eq('user_id', user.id)
    .eq('book_id', bookId)
    .maybeSingle()

  if (purchase) {
    return NextResponse.json({ hasAccess: true, reason: 'purchase' })
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gt('current_period_end', new Date().toISOString())
    .maybeSingle()

  if (!subscriptionError && subscription) {
    return NextResponse.json({ hasAccess: true, reason: 'subscription' })
  }

  return NextResponse.json({ hasAccess: false, reason: 'locked' })
}
