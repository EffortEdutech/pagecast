export type PayGateEnvironment = 'test' | 'live'

export interface CreateCheckoutInput {
  readonly accessToken: string
  readonly appId: string
  readonly userRef: string
  readonly planKey: string
  readonly returnContext: string
  readonly environment: PayGateEnvironment
  readonly idempotencyKey: string
}

export interface PayGateCheckoutSession {
  readonly checkout_session_id: string
  readonly redirect_url: string
  readonly status: string
  readonly expires_at?: string
  readonly request_id?: string
}

export interface PayGateSubscriptionState {
  readonly appId: string
  readonly userRef: string
  readonly state: 'none' | 'trialing' | 'active' | 'past_due' | 'cancelled' | string
  readonly planKey?: string
  readonly currentPeriodEnd?: string
}

export interface PayGateEntitlement {
  readonly key: string
  readonly state: 'active' | 'revoked' | string
  readonly effective_until?: string
}

export interface PayGateEntitlementState {
  readonly appId: string
  readonly userRef: string
  readonly entitlements: readonly PayGateEntitlement[]
}

export interface PayGateState {
  readonly subscription: PayGateSubscriptionState
  readonly entitlements: PayGateEntitlementState
}

export class PayGateClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'PayGateClientError'
  }
}

export function getPaymentHubBaseUrl(): string {
  const baseUrl = process.env.PAYMENT_HUB_BASE_URL ?? process.env.NEXT_PUBLIC_PAYMENT_HUB_BASE_URL
  if (!baseUrl) throw new Error('PAYMENT_HUB_BASE_URL or NEXT_PUBLIC_PAYMENT_HUB_BASE_URL is required')
  return baseUrl.replace(/\/$/, '')
}

export function getPaymentHubEnvironment(): PayGateEnvironment {
  const raw = process.env.PAYMENT_HUB_ENVIRONMENT ?? process.env.NEXT_PUBLIC_PAYMENT_HUB_ENVIRONMENT ?? 'test'
  if (raw !== 'test' && raw !== 'live') throw new Error('PAYMENT_HUB_ENVIRONMENT must be test or live')
  return raw
}

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` }
}

async function readPayGateJson<T>(response: Response, fallbackCode: string, fallbackMessage: string): Promise<T> {
  const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | T | null
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload ? payload.error : undefined
    throw new PayGateClientError(response.status, error?.code ?? fallbackCode, error?.message ?? fallbackMessage)
  }
  if (!payload) throw new PayGateClientError(502, fallbackCode, fallbackMessage)
  return payload as T
}

export async function createPayGateCheckout(input: CreateCheckoutInput): Promise<PayGateCheckoutSession> {
  const response = await fetch(`${getPaymentHubBaseUrl()}/v1/checkout/sessions`, {
    method: 'POST',
    headers: {
      ...authHeaders(input.accessToken),
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      app_id: input.appId,
      user_ref: input.userRef,
      plan_key: input.planKey,
      return_context: input.returnContext,
      environment: input.environment,
    }),
    cache: 'no-store',
  })

  const payload = await readPayGateJson<PayGateCheckoutSession>(response, 'PAYGATE_CHECKOUT_FAILED', 'PayGate checkout failed')
  if (!payload.redirect_url) {
    throw new PayGateClientError(502, 'PAYGATE_MISSING_REDIRECT', 'PayGate did not return a checkout redirect URL')
  }
  return payload
}

export async function readPayGateState(input: {
  readonly accessToken: string
  readonly appId: string
  readonly userRef: string
}): Promise<PayGateState> {
  const query = new URLSearchParams({ app_id: input.appId, user_ref: input.userRef })
  const [subscription, entitlements] = await Promise.all([
    fetch(`${getPaymentHubBaseUrl()}/v1/subscriptions/current?${query.toString()}`, {
      headers: authHeaders(input.accessToken),
      cache: 'no-store',
    }).then((response) => readPayGateJson<PayGateSubscriptionState>(response, 'PAYGATE_SUBSCRIPTION_FAILED', 'PayGate subscription state is unavailable')),
    fetch(`${getPaymentHubBaseUrl()}/v1/entitlements?${query.toString()}`, {
      headers: authHeaders(input.accessToken),
      cache: 'no-store',
    }).then((response) => readPayGateJson<PayGateEntitlementState>(response, 'PAYGATE_ENTITLEMENTS_FAILED', 'PayGate entitlement state is unavailable')),
  ])

  return { subscription, entitlements }
}