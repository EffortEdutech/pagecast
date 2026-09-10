import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPayGateCheckout, getPaymentHubEnvironment, PayGateClientError } from '@/lib/paymentHub/client'

export const dynamic = 'force-dynamic'

const PAGECAST_APP_ID = 'pagecast'
const CAST_PASS_PLAN_KEY = 'cast_pass_monthly'
const RETURN_CONTEXT = 'billing'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token
  if (!accessToken) return NextResponse.json({ error: 'Missing Supabase session token' }, { status: 401 })

  try {
    const checkout = await createPayGateCheckout({
      accessToken,
      appId: PAGECAST_APP_ID,
      userRef: user.id,
      planKey: CAST_PASS_PLAN_KEY,
      returnContext: RETURN_CONTEXT,
      environment: getPaymentHubEnvironment(),
      idempotencyKey: `pagecast-cast-pass-${user.id}-${crypto.randomUUID()}`,
    })

    return NextResponse.json({
      checkoutSessionId: checkout.checkout_session_id,
      redirectUrl: checkout.redirect_url,
      status: checkout.status,
      expiresAt: checkout.expires_at,
      requestId: checkout.request_id,
    })
  } catch (error) {
    if (error instanceof PayGateClientError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    console.error('PayGate Cast Pass checkout failed', error)
    return NextResponse.json({ error: 'Cast Pass checkout is unavailable right now' }, { status: 502 })
  }
}