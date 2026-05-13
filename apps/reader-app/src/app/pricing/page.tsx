import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { Check, CreditCard, Gem, Globe2, Headphones, Sparkles } from 'lucide-react'

const plans = [
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
    price: '$9-$19',
    cadence: 'per month',
    description: 'The membership path for families and regular Explorers who want the full TaleVerse.',
    cta: 'Coming Soon',
    href: '/store',
    featured: true,
    features: ['All Premium Casts', 'New Tales monthly', 'Cancel anytime', 'One Cast Pass'],
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      <main>
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
              Begin with Starter Moments, let committed Explorers unlock Casts,
              then grow recurring access through Cast Pass.
            </p>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-10">
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

                <Link
                  href={plan.href}
                  className={plan.featured ? 'btn-primary justify-center mt-7' : 'btn-secondary justify-center mt-7'}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-12">
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Globe2, title: 'Global discovery', text: 'TikTok, Amazon, marketplaces, and QR codes all point back to PageCast.' },
              { icon: Headphones, title: 'Multilingual Casts', text: 'Cast language can vary by audience, region, and campaign.' },
              { icon: CreditCard, title: 'Owned unlocks', text: 'Explorers unlock inside PageCast so relationships and My Casts stay with us.' },
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
