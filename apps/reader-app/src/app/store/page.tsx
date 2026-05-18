'use client'
import Link from 'next/link'
import { useReaderStore } from '@/store/readerStore'
import { useHydrated } from '@/hooks/useHydrated'
import { usePublishedBooks } from '@/hooks/usePublishedBooks'
import { Navbar } from '@/components/layout/Navbar'
import { Clock, Mic, Music, BookOpen, Headphones, Sparkles, Check, Languages, Lock, Rocket, ShoppingBag } from 'lucide-react'
import { clsx } from 'clsx'
import type { Story } from '@/types'
import { formatUsd } from '@/lib/format'

function StoryCard({ story, mode = 'default' }: { story: Story; mode?: 'guest' | 'locked' | 'premium' | 'default' }) {
  const hydrated   = useHydrated()
  const isOwnedRaw = useReaderStore(s => s.isOwned(story.id))
  const isOwned    = mode !== 'guest' && hydrated && isOwnedRaw

  return (
    <Link href={`/book/${story.id}`} className="card hover:border-accent/40 transition-all duration-200 overflow-hidden group flex flex-col">
      {/* Cover */}
      <div className={clsx('h-44 bg-gradient-to-br flex flex-col justify-end p-4 relative', story.coverGradient ?? 'from-accent/30 to-accent/10')}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="relative z-10">
          <div className="flex gap-2 mb-2 flex-wrap">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/15 text-white/90">{story.language.toUpperCase()}</span>
            {story.genre && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/15 text-white/90">{story.genre}</span>
            )}
            {story.ageRating && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/15 text-white/90">{story.ageRating}</span>
            )}
            {mode === 'guest' && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-success/25 text-white">Guest Access</span>
            )}
            {mode === 'locked' && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/35 text-white/90">Free Account</span>
            )}
            {mode === 'premium' && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gold/25 text-white">Premium</span>
            )}
          </div>
          <h3 className="text-white font-bold text-lg leading-tight group-hover:text-accent-hover transition-colors">{story.title}</h3>
        </div>
        {isOwned && (
          <div className="absolute top-3 right-3 w-7 h-7 bg-success rounded-full flex items-center justify-center">
            <Check size={13} className="text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <p className="text-text-secondary text-xs leading-relaxed line-clamp-3 flex-1">{story.description}</p>
        <div className="flex items-center gap-3 mt-3 text-text-muted text-[10px]">
          {story.durationMinutes && <span className="flex items-center gap-1"><Clock size={10} /> {story.durationMinutes}m</span>}
          {story.hasMusic && <span className="flex items-center gap-1"><Music size={10} /> Music</span>}
          <span className="flex items-center gap-1"><Mic size={10} /> {story.characters.filter(c => c.role === 'character').length} voices</span>
          <span className="ml-auto font-semibold text-text-primary text-xs">
            {isOwned
              ? <span className="text-success">Unlocked</span>
              : mode === 'guest'
                ? 'Start free'
                : mode === 'locked'
                  ? 'Join free'
                  : story.isFree ? 'Starter Cast' : formatUsd(story.price)}
          </span>
        </div>
        <div className="mt-4">
          <span className={clsx(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
            mode === 'guest' ? 'bg-success/15 text-success' :
            mode === 'premium' ? 'bg-gold/15 text-gold' :
            mode === 'locked' ? 'bg-accent/15 text-accent' :
            'bg-bg-elevated text-text-secondary'
          )}>
            {mode === 'guest' ? <Rocket size={12} /> : mode === 'premium' ? <ShoppingBag size={12} /> : mode === 'locked' ? <Lock size={12} /> : <BookOpen size={12} />}
            {mode === 'guest' ? 'Start Cast' : mode === 'premium' ? 'Unlock Cast' : mode === 'locked' ? 'Create account' : 'View Cast'}
          </span>
        </div>
      </div>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="h-44 bg-bg-elevated" />
      <div className="p-4 space-y-2">
        <div className="h-3 bg-bg-elevated rounded w-3/4" />
        <div className="h-3 bg-bg-elevated rounded w-full" />
        <div className="h-3 bg-bg-elevated rounded w-2/3" />
      </div>
    </div>
  )
}

export default function StorePage() {
  const { stories, loading, usingDemo } = usePublishedBooks()
  const explicitGuestCasts = stories
    .filter(story => story.guestAccess)
    .sort((a, b) => (a.guestAccessRank ?? 99) - (b.guestAccessRank ?? 99))
  const fallbackGuestCasts = stories
    .filter(story => !story.guestAccess && story.isFree)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const guestCasts = [...explicitGuestCasts, ...fallbackGuestCasts].slice(0, 3)
  const guestIds = new Set(guestCasts.map(story => story.id))
  const accountCasts = stories.filter(story => !guestIds.has(story.id) && story.isFree).slice(0, 6)
  const premiumCasts = stories.filter(story => !story.isFree).slice(0, 6)

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-bg-border">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-gold/5 pointer-events-none" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 py-16 relative z-10">
          <div className="flex items-center gap-2 text-accent text-sm font-medium mb-4">
            <Sparkles size={14} />
            <span>Start instantly with 3 free Casts</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-text-primary leading-tight max-w-2xl">
            Casts you can<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-info">read, hear, and feel.</span>
          </h1>
          <p className="text-text-secondary text-lg mt-4 max-w-xl leading-relaxed">
            Visitors can begin three curated Casts without registering. Create a free account when you want to save progress, unlock more, or purchase premium bundles.
          </p>
          <div className="flex gap-3 mt-6 flex-wrap">
            {[
              { icon: BookOpen,   label: 'Page + Voice sync' },
              { icon: Headphones, label: 'Character voices' },
              { icon: Music,      label: 'Dream Music' },
              { icon: Languages,  label: 'Multilingual Casts' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-elevated border border-bg-border text-text-secondary text-sm">
                <Icon size={13} className="text-accent" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stories grid */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-text-primary font-bold text-xl">Start Free</h2>
            <p className="text-text-secondary text-sm mt-0.5">
              {loading
                ? 'Opening the guest shelf...'
                : usingDemo
                  ? `${stories.length} demo Casts - Publish a Cast in Creator Studio to see it here`
                  : 'Three Casts are open to visitors. No account needed.'
              }
            </p>
          </div>
        </div>

        {usingDemo && !loading && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-gold/10 border border-gold/20 text-gold text-xs flex items-center gap-2">
            <Sparkles size={13} />
            Showing demo Casts. Once you publish a Cast in Creator Studio, it will appear here.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
            : guestCasts.map(story => <StoryCard key={story.id} story={story} mode="guest" />)
          }
        </div>

        {!loading && (
          <>
            <section className="mt-10 rounded-xl border border-accent/20 bg-accent/10 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-text-primary font-semibold">Keep your place in the TaleVerse</h2>
                  <p className="text-text-secondary text-sm mt-1">Create a free account to save progress, build My Casts, and unlock more free Casts.</p>
                </div>
                <Link href="/login?next=/store" className="btn-primary justify-center">
                  Create free account
                </Link>
              </div>
            </section>

            {accountCasts.length > 0 && (
              <section className="mt-10">
                <div className="mb-5">
                  <h2 className="text-text-primary font-bold text-xl">More Casts with a free account</h2>
                  <p className="text-text-secondary text-sm mt-0.5">These Casts stay visible, but saving and continuing starts with a free PageCast account.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {accountCasts.map(story => <StoryCard key={story.id} story={story} mode="locked" />)}
                </div>
              </section>
            )}

            <section className="mt-10">
              <div className="mb-5">
                <h2 className="text-text-primary font-bold text-xl">Premium Casts and bundles</h2>
                <p className="text-text-secondary text-sm mt-0.5">Discover paid Casts now. Purchases and bundles unlock after account creation.</p>
              </div>
              {premiumCasts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {premiumCasts.map(story => <StoryCard key={story.id} story={story} mode="premium" />)}
                </div>
              ) : (
                <div className="card p-5 flex items-center gap-3">
                  <ShoppingBag size={18} className="text-gold" />
                  <div>
                    <h3 className="text-text-primary font-semibold text-sm">Bundles coming soon</h3>
                    <p className="text-text-secondary text-xs mt-1">Premium Casts, creator bundles, and Cast Pass offers will appear here.</p>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
