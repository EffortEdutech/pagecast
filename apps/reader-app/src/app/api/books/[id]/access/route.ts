import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readPayGateState, PayGateClientError } from '@/lib/paymentHub/client'

export const dynamic = 'force-dynamic'

const PAGECAST_APP_ID = 'pagecast'
const CAST_PASS_PLAN_KEY = 'cast_pass_monthly'
const CAST_PASS_ENTITLEMENT_KEYS = new Set(['plan:cast_pass_monthly', 'pagecast.cast_pass', 'pagecast.premium_casts'])
const SINGLE_CAST_ENTITLEMENT_KEY = 'pagecast.single_cast_unlock'

function hasActiveCastPass(state: Awaited<ReturnType<typeof readPayGateState>>): boolean {
  if (state.subscription.state === 'active' && state.subscription.planKey === CAST_PASS_PLAN_KEY) return true
  return state.entitlements.entitlements.some((entitlement) => (
    CAST_PASS_ENTITLEMENT_KEYS.has(entitlement.key) && entitlement.state === 'active'
  ))
}

function scopeMatchesBook(scope: unknown, bookId: string): boolean {
  if (!scope || typeof scope !== 'object') return false
  const typedScope = scope as { bookId?: unknown; book_id?: unknown; bookIds?: unknown; book_ids?: unknown }
  if (typedScope.bookId === bookId || typedScope.book_id === bookId) return true
  if (Array.isArray(typedScope.bookIds)) return typedScope.bookIds.includes(bookId)
  if (Array.isArray(typedScope.book_ids)) return typedScope.book_ids.includes(bookId)
  return false
}

function hasActiveSingleCastItem(state: Awaited<ReturnType<typeof readPayGateState>>, bookId: string): boolean {
  return state.entitlements.entitlements.some((entitlement) => (
    entitlement.key === SINGLE_CAST_ENTITLEMENT_KEY &&
    entitlement.state === 'active' &&
    scopeMatchesBook(entitlement.scope, bookId)
  ))
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const bookId = params.id

  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('id, is_free, guest_access')
    .eq('id', bookId)
    .eq('status', 'published')
    .maybeSingle()

  if (bookError) {
    return NextResponse.json({ error: bookError.message }, { status: 500 })
  }

  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  if (book.guest_access) {
    return NextResponse.json({ hasAccess: true, reason: 'guest' })
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ hasAccess: false, reason: 'unauthenticated' })
  }

  if (book.is_free) {
    return NextResponse.json({ hasAccess: true, reason: 'free' })
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

  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token
  if (!accessToken) {
    return NextResponse.json({ hasAccess: false, reason: 'locked' })
  }

  try {
    const payGateState = await readPayGateState({ accessToken, appId: PAGECAST_APP_ID, userRef: user.id })
    if (hasActiveCastPass(payGateState)) {
      return NextResponse.json({ hasAccess: true, reason: 'cast_pass' })
    }
    if (hasActiveSingleCastItem(payGateState, bookId)) {
      return NextResponse.json({ hasAccess: true, reason: 'single_cast' })
    }
  } catch (error) {
    if (!(error instanceof PayGateClientError)) {
      console.error('PayGate access check failed', error)
    }
    // Fail closed for premium access. Redirect success pages and provider errors never unlock content.
  }

  return NextResponse.json({ hasAccess: false, reason: 'locked' })
}