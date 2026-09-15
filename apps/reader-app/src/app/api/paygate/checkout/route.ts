import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPayGateCheckout, getPaymentHubEnvironment, PayGateClientError } from '@/lib/paymentHub/client'

export const dynamic = 'force-dynamic'

const PAGECAST_APP_ID = 'pagecast'
const CAST_PASS_PLAN_KEY = 'cast_pass_monthly'
const CAST_PASS_RETURN_CONTEXT = 'billing'
const SINGLE_CAST_RETURN_CONTEXT = 'cast'
const ITEM_REF_RE = /^book:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type CheckoutRequestBody = {
  item_ref?: unknown
}

async function readCheckoutRequest(req: NextRequest): Promise<CheckoutRequestBody> {
  if (!req.headers.get('content-type')?.includes('application/json')) return {}
  return await req.json().catch(() => ({}))
}

function itemCheckoutMessage(code: string): string {
  if (code === 'ITEM_CHECKOUT_DISABLED' || code === 'ITEM_NOT_AVAILABLE') {
    return 'Single Cast checkout is being prepared in PayGate. Please use Cast Pass for now.'
  }
  return 'Single Cast checkout is unavailable right now.'
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { data: { session } } = await supabase.auth.getSession()
  const accessToken = session?.access_token
  if (!accessToken) return NextResponse.json({ error: 'Missing Supabase session token' }, { status: 401 })

  const body = await readCheckoutRequest(req)
  const itemRef = typeof body.item_ref === 'string' ? body.item_ref.trim() : ''
  if (itemRef && !ITEM_REF_RE.test(itemRef)) {
    return NextResponse.json({
      error: 'Invalid Single Cast item reference.',
      code: 'PAGECAST_INVALID_ITEM_REF',
    }, { status: 400 })
  }

  try {
    const checkout = await createPayGateCheckout({
      accessToken,
      appId: PAGECAST_APP_ID,
      userRef: user.id,
      ...(itemRef
        ? {
            itemRef,
            idempotencyKey: `pagecast-single-cast-${user.id}-${itemRef.replace(/[^a-z0-9_-]/gi, '-')}-${crypto.randomUUID()}`,
          }
        : {
            planKey: CAST_PASS_PLAN_KEY,
            idempotencyKey: `pagecast-cast-pass-${user.id}-${crypto.randomUUID()}`,
          }),
      returnContext: itemRef ? SINGLE_CAST_RETURN_CONTEXT : CAST_PASS_RETURN_CONTEXT,
      environment: getPaymentHubEnvironment(),
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
      return NextResponse.json({
        error: itemRef ? itemCheckoutMessage(error.code) : error.message,
        code: error.code,
      }, { status: error.status })
    }
    console.error(itemRef ? 'PayGate Single Cast checkout failed' : 'PayGate Cast Pass checkout failed', error)
    return NextResponse.json({
      error: itemRef ? 'Single Cast checkout is unavailable right now' : 'Cast Pass checkout is unavailable right now',
    }, { status: 502 })
  }
}
