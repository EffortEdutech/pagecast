'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { Check, CreditCard, Gem, Globe2, Headphones, Sparkles, Wand2 } from 'lucide-react'

type CastPassState = {
  authenticated: boolean
  castPassActive: boolean
  subscription?: { state?: string; planKey?: string; currentPeriodEnd?: string }
  entitlements?: Array<{ key: string; state: string; effective_until?: string }>
  error?: string
}

type Plan = {
  name: string
  price: string
  cadence: string
  description: string
  cta: string
  href: string
  features: string[]
  featured?: boolean
  action?: 'cast-pass-checkout'
}

const plans: Plan[] = [
  {
    name: 'Starter Pass',
    price: '$0',
    cadence: 'start here',
    description: 'Best for Explorers arriving from social clips, QR codes, and marketplace discovery.',
    cta: 'Explore Casts',
    href: '/store',
    features: ['Starter Moments', 'No payment required', 'Create account to save your Journey'],
  },
  {
    name: 'Single Cast Unlock',
    price: '$3-$9',
    cadence: 'per Cast',
    description: 'A gentle one-time unlock for Explorers who want one Premium Cast.',
    cta: 'Find a Cast',
    href: '/store',
    features: ['Instant Cast unlock', 'Saved in My Casts', 'Gentle checkout'],
  },
  {
    name: 'Cast Pass',
    price: '$19',
    cadence: 'per month',
    description: 'The membership path for families and regular Explorers who want the full TaleVerse.',
    cta: 'Start Cast Pass',
    href: '/pricing',
    featured: true,
    action: 'cast-pass-checkout',
    features: ['All Premium Casts', 'New Tales monthly', 'Cancel anytime', 'One Cast Pass'],
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [billingStatus, setBillingStatus] = useState<'success' | 'cancelled' | ''>('')
  const [castPassState, setCastPassState] = useState<CastPassState | null>(null)
  const [castPassLoading, setCastPassLoading] = useState(true)

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('billing')
    if (status === 'success' || status === 'cancelled') setBillingStatus(status)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadCastPassState() {
      try {
        const response = await fetch('/api/paygate/state', { cache: 'no-store' })
        const payload = await response.json().catch(() => null) as CastPassState | null
        if (!cancelled) setCastPassState(payload)
      } catch {
        if (!cancelled) setCastPassState({ authenticated: false, castPassActive: false, error: 'Cast Pass state is unavailable right now' })
      } finally {
        if (!cancelled) setCastPassLoading(false)
      }
    }
    loadCastPassState()
    return () => { cancelled = true }
  }, [])

  const activeUntil = castPassState?.entitlements?.find(entitlement => entitlement.state === 'active' && entitlement.effective_until)?.effective_until
  const activeUntilLabel = activeUntil ? new Date(activeUntil).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''

  const startCastPassCheckout = async () => {
    if (castPassState?.castPassActive) {
      router.push('/store')
      return
    }

    setCheckoutError('')
    setCheckoutLoading(true)
    try {
      const response = await fetch('/api/paygate/checkout', { method: 'POST' })
      const payload = await response.json().catch(() => null) as { redirectUrl?: string; error?: string } | null

      if (response.status === 401) {
        router.push('/login?next=/pricing')
        return
      }
      if (!response.ok || !payload?.redirectUrl) {
        throw new Error(payload?.error ?? 'Could not start Cast Pass checkout.')
      }
      window.location.href = payload.redirectUrl
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Could not start Cast Pass checkout.')
      setCheckoutLoading(false)
    }
  }

  if (billingStatus === 'success') {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />

        <main className="max-w-4xl mx-auto px-6 py-14">
          <section className="card border-success/30 bg-bg-secondary p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="h-12 w-12 rounded-2xl bg-success/15 text-success flex items-center justify-center shrink-0">
                <Check size={24} />
              </div>
              <div className="flex-1">
                <p className="text-success text-sm font-semibold">Payment successful</p>
                <h1 className="text-text-primary text-3xl sm:text-4xl font-bold mt-2 leading-tight">
                  Your Cast Pass is being activated.
                </h1>
                <p className="text-text-secondary mt-4 leading-relaxed">
                  Stripe confirmed your payment. PayGate unlocks Cast Pass from verified Stripe webhook evidence,
                  not from this browser return page.
                </p>

                <div className="mt-5 rounded-2xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
                  {castPassState?.castPassActive
                    ? <>PayGate state: active Cast Pass{activeUntilLabel ? ' until ' + activeUntilLabel : ''}.</>
                    : <>Waiting for PayGate entitlement state. Refresh in a moment if access is not visible yet.</>
                  }
                </div>

                <div className="grid sm:grid-cols-2 gap-3 mt-6">
                  <Link href="/store" className="btn-primary justify-center">
                    Explore Premium Casts
                  </Link>
                  <Link href="/library" className="btn-secondary justify-center">
                    Go to My Casts
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      <main>
        {billingStatus === 'cancelled' && (
          <section className="border-b border-warning/20 bg-warning/10">
            <div className="max-w-5xl mx-auto px-6 py-5">
              <div className="flex items-start gap-3 rounded-2xl border border-warning/25 bg-bg-primary/90 px-4 py-3 text-sm">
                <Wand2 size={18} className="text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-text-primary font-semibold">Checkout cancelled</p>
                  <p className="text-text-secondary mt-1">
                    No payment was taken. You can start Cast Pass again whenever you are ready.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
        <section className="border-b border-bg-border bg-bg-secondary">
          <div className="max-w-5xl mx-auto px-6 py-14 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-accent/25 bg-accent/10 text-accent text-xs font-semibold mb-5">
              <CreditCard size={13} />
              All pricing is in USD
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-text-primary leading-tight">
              Gentle access for multilingual Casts.
            </h1>
            <p className="text-text-secondary text-lg mt-5 max-w-2xl mx-auto leading-relaxed">
              Start free — no card needed. Unlock the stories you love with a one-time purchase,
              or go unlimited with Cast Pass.
            </p>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-10">
          {castPassState?.castPassActive && (
            <div className="mb-5 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
              Cast Pass is active through PayGate{activeUntilLabel ? ' until ' + activeUntilLabel : ''}. Premium Cast access should use this verified payment state.
            </div>
          )}

          {!castPassLoading && castPassState?.authenticated && !castPassState.castPassActive && billingStatus !== 'cancelled' && (
            <div className="mb-5 rounded-xl border border-bg-border bg-bg-secondary px-4 py-3 text-sm text-text-secondary">
              PayGate state loaded: no active Cast Pass found for this account yet.
            </div>
          )}

          {checkoutError && (
            <div className="mb-5 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
              {checkoutError}
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-5">
            {plans.map(plan => (
              <div
                key={plan.name}
                className={[
                  'card p-6 flex flex-col',
                  plan.featured ? 'border-accent/45 bg-accent/5 shadow-accent' : '',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-text-primary font-bold text-xl">{plan.name}</h2>
                    <p className="text-text-secondary text-sm mt-2 leading-relaxed">{plan.description}</p>
                  </div>
                  {plan.featured
                    ? <Gem size={20} className="text-accent shrink-0" />
                    : <Sparkles size={18} className="text-text-muted shrink-0" />
                  }
                </div>

                <div className="mt-6">
                  <span className="text-text-primary font-bold text-4xl">{plan.price}</span>
                  <span className="text-text-muted text-sm ml-2">{plan.cadence}</span>
                </div>

                <div className="space-y-3 mt-6 flex-1">
                  {plan.features.map(feature => (
                    <div key={feature} className="flex items-center gap-2 text-text-secondary text-sm">
                      <Check size={14} className={plan.featured ? 'text-accent' : 'text-success'} />
                      {feature}
                    </div>
                  ))}
                </div>

                {plan.action === 'cast-pass-checkout' ? (
                  <button
                    type="button"
                    onClick={startCastPassCheckout}
                    disabled={checkoutLoading}
                    className="btn-primary justify-center mt-7 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {castPassState?.castPassActive ? 'Explore Premium Casts' : checkoutLoading ? 'Opening Stripe…' : plan.cta}
                  </button>
                ) : (
                  <Link
                    href={plan.href}
                    className={plan.featured ? 'btn-primary justify-center mt-7' : 'btn-secondary justify-center mt-7'}
                  >
                    {plan.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-12">
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Globe2, title: 'Find stories anywhere', text: 'Discover Casts from TikTok, Amazon, QR codes, and beyond — it all starts here.' },
              { icon: Headphones, title: 'Stories in your language', text: 'Casts are available in multiple languages. Read and listen in the one that feels right.' },
              { icon: CreditCard, title: 'Your library, your way', text: 'Casts you unlock are saved to My Casts — yours to revisit anytime, on any device.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="card p-5">
                <Icon size={19} className="text-accent mb-3" />
                <h3 className="text-text-primary font-semibold">{title}</h3>
                <p className="text-text-secondary text-sm mt-2 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}