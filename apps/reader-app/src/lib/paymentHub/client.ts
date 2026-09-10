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

export async function createPayGateCheckout(input: CreateCheckoutInput): Promise<PayGateCheckoutSession> {
  const response = await fetch(`${getPaymentHubBaseUrl()}/v1/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
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

  const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | PayGateCheckoutSession | null
  if (!response.ok) {
    const error = payload && 'error' in payload ? payload.error : undefined
    throw new PayGateClientError(response.status, error?.code ?? 'PAYGATE_CHECKOUT_FAILED', error?.message ?? 'PayGate checkout failed')
  }
  if (!payload || !('redirect_url' in payload) || !payload.redirect_url) {
    throw new PayGateClientError(502, 'PAYGATE_MISSING_REDIRECT', 'PayGate did not return a checkout redirect URL')
  }
  return payload
}