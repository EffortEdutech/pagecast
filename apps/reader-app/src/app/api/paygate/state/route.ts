import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readPayGateState, PayGateClientError } from '@/lib/paymentHub/client'

export const dynamic = 'force-dynamic'

const PAGECAST_APP_ID = 'pagecast'
const CAST_PASS_PLAN_KEY = 'cast_pass_monthly'
const CAST_PASS_ENTITLEMENT_KEYS = new Set(['plan:cast_pass_monthly', 'pagecast.cast_pass', 'pagecast.premium_casts'])

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ authenticated: false, castPassActive: false }, { status: 200 })

  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token
  if (!accessToken) return NextResponse.json({ authenticated: false, castPassActive: false }, { status: 200 })

  try {
    const state = await readPayGateState({ accessToken, appId: PAGECAST_APP_ID, userRef: user.id })
    const castPassActive = state.subscription.state === 'active' && state.subscription.planKey === CAST_PASS_PLAN_KEY
      || state.entitlements.entitlements.some((entitlement) => CAST_PASS_ENTITLEMENT_KEYS.has(entitlement.key) && entitlement.state === 'active')

    return NextResponse.json({
      authenticated: true,
      castPassActive,
      subscription: state.subscription,
      entitlements: state.entitlements.entitlements,
    })
  } catch (error) {
    if (error instanceof PayGateClientError) {
      return NextResponse.json({ authenticated: true, castPassActive: false, error: error.message, code: error.code }, { status: error.status })
    }
    console.error('PayGate Cast Pass state failed', error)
    return NextResponse.json({ authenticated: true, castPassActive: false, error: 'Cast Pass state is unavailable right now' }, { status: 502 })
  }
}