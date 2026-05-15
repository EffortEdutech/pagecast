'use client'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useReaderStore } from '@/store/readerStore'
import { useHydrated } from '@/hooks/useHydrated'
import { Navbar } from '@/components/layout/Navbar'
import { getStory } from '@/data/stories'
import { fetchBook } from '@/lib/supabase/books'
import {
  Play, Clock, Mic, Music, Volume2, BookOpen,
  Headphones, Film, Check, ChevronRight, ArrowLeft, Lock, Loader2, ShoppingCart
} from 'lucide-react'
import { clsx } from 'clsx'
import type { Story } from '@/types'
import { formatUsd } from '@/lib/format'
import { stripPerformanceTagsForDisplay } from '@/lib/performanceTags'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function BookPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const hydrated = useHydrated()
  const { isOwned, addToLibrary } = useReaderStore()
  const [story,    setStory]    = useState<Story | null | undefined>(undefined)
  const [buying,   setBuying]   = useState(false)
  const [buyError, setBuyError] = useState<string | null>(null)
  const [serverAccess, setServerAccess] = useState(false)

  // Load story — Supabase first, fall back to demo data
  useEffect(() => {
    if (!id) return
    fetchBook(id).then(book => {
      setStory(book ?? getStory(id) ?? null)
    }).catch(() => {
      setStory(getStory(id) ?? null)
    })
  }, [id])

  useEffect(() => {
    if (!id) return
    fetch(`/api/books/${id}/access`)
      .then(res => res.ok ? res.json() : null)
      .then(data => setServerAccess(Boolean(data?.hasAccess)))
      .catch(() => setServerAccess(false))
  }, [id])

  // Handle ?purchased=1 redirect from Stripe success_url.
  // NOTE: Must be declared here (before any early returns) to comply with
  // React's Rules of Hooks — hooks must be called in the same order on every
  // render regardless of conditions.
  useEffect(() => {
    if (!story) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('purchased') === '1') {
      window.history.replaceState({}, '', `/book/${story.id}`)
      fetch(`/api/books/${story.id}/access`)
        .then(res => res.ok ? res.json() : null)
        .then(data => setServerAccess(Boolean(data?.hasAccess)))
        .catch(() => setServerAccess(false))
    }
  }, [story])

  // ── Early exits (after all hooks) ─────────────────────────────────────────

  if (story === undefined) return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!story) return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="text-center space-y-3">
        <BookOpen size={40} className="text-text-muted mx-auto" />
        <p className="text-text-secondary">Cast not found.</p>
        <Link href="/store" className="btn-primary inline-flex"><ArrowLeft size={14} /> Back to TaleVerse</Link>
      </div>
    </div>
  )

  // ── Derived state ──────────────────────────────────────────────────────────

  const isSupabaseCast = UUID_RE.test(story.id)
  const owned = serverAccess || (!isSupabaseCast && hydrated && isOwned(story.id))

  const handleBuy = async () => {
    if (!story) return
    setBuying(true)
    setBuyError(null)
    try {
      const res  = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ bookId: story.id }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) { router.push(`/login?next=/book/${story.id}`); return }
        setBuyError(data.error ?? 'Something went wrong.')
        return
      }

      if (data.alreadyOwned || data.free) {
        addToLibrary(story.id)
        router.push(`/reader/${story.id}`)
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setBuyError('Could not connect to checkout. Try again.')
    } finally {
      setBuying(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      {/* Hero banner */}
      <div className={clsx('relative overflow-hidden bg-gradient-to-br', story.coverGradient)}>
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/60 to-transparent" />
        <div className="max-w-5xl mx-auto px-6 py-16 relative z-10">
          <Link href="/store" className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={14} /> TaleVerse
          </Link>
          <div className="flex flex-col sm:flex-row items-start gap-8">
            {/* Cover tile */}
            <div className={clsx('w-36 h-48 rounded-2xl bg-gradient-to-br shrink-0 flex items-center justify-center shadow-elevated border border-white/10', story.coverGradient)}>
              <BookOpen size={40} className="text-white/30" />
            </div>
            {/* Meta */}
            <div className="flex-1 min-w-0">
              <div className="flex gap-2 mb-3 flex-wrap">
                {story.genre && <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white/80">{story.genre}</span>}
                {story.ageRating && <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white/80">{story.ageRating}</span>}
                <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white/80">{story.language.toUpperCase()}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">{story.title}</h1>
              <p className="text-white/70 mt-3 max-w-lg leading-relaxed">{story.description}</p>

              {/* Stats row */}
              <div className="flex items-center gap-4 mt-4 text-white/60 text-sm flex-wrap">
                {story.durationMinutes && <span className="flex items-center gap-1.5"><Clock size={13} /> {story.durationMinutes} min</span>}
                <span className="flex items-center gap-1.5"><Mic size={13} /> {story.characters.length} cast members</span>
                <span className="flex items-center gap-1.5"><Film size={13} /> {story.chapters.length} chapter{story.chapters.length !== 1 ? 's' : ''}</span>
                {story.hasMusic && <span className="flex items-center gap-1.5"><Music size={13} /> Music</span>}
                {story.hasSfx && <span className="flex items-center gap-1.5"><Volume2 size={13} /> Sound effects</span>}
              </div>

              {/* CTA */}
              <div className="flex items-center gap-3 mt-6 flex-wrap">
                {owned ? (
                  <Link href={`/reader/${story.id}`} className="btn-primary text-base px-6 py-3 shadow-accent">
                    <Play size={18} className="fill-white" /> Resume Cast
                  </Link>
                ) : (
                  <>
                    <button
                      onClick={handleBuy}
                      disabled={buying}
                      className="btn-primary text-base px-6 py-3 shadow-accent disabled:opacity-70"
                    >
                      {buying
                        ? <><Loader2 size={18} className="animate-spin" /> Processing&hellip;</>
                        : story.isFree
                          ? <><Play size={18} className="fill-white" /> Begin Starter Cast</>
                          : <><ShoppingCart size={18} /> Unlock Cast for {formatUsd(story.price)}</>
                      }
                    </button>
                    {buyError && <p className="text-danger text-sm">{buyError}</p>}
                    {!story.isFree && (
                      <Link href="/pricing" className="btn-secondary text-base px-6 py-3">
                        Get Cast Pass
                      </Link>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: chapters + preview */}
        <div className="lg:col-span-2 space-y-6">
          {/* Preview excerpt */}
          <section className="card p-5">
            <h2 className="text-text-primary font-semibold mb-4 flex items-center gap-2">
              <BookOpen size={15} className="text-accent" /> Starter Moment
            </h2>
            {story.chapters[0]?.scenes[0]?.blocks.slice(0, 3).map(block => {
              const char = story.characters.find(c =>
                (block.type === 'dialogue' || block.type === 'thought') && c.id === (block as any).characterId
              )
              return (
                <div key={block.id} className="mb-3 last:mb-0">
                  {block.type === 'narration' && (
                    <p className="text-text-secondary text-sm leading-relaxed italic">{stripPerformanceTagsForDisplay((block as any).text)}</p>
                  )}
                  {block.type === 'dialogue' && char && (
                    <div className="flex items-start gap-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0 mt-0.5"
                        style={{ backgroundColor: char.color + '25', color: char.color }}>
                        {char.displayName}
                      </span>
                      <p className="text-text-primary text-sm leading-relaxed">"{stripPerformanceTagsForDisplay((block as any).text)}"</p>
                    </div>
                  )}
                </div>
              )
            })}
            <div className={clsx('mt-4 p-3 rounded-lg text-center text-sm', owned ? 'bg-success/10 text-success' : 'bg-bg-elevated text-text-muted')}>
              {owned
                ? <span className="flex items-center justify-center gap-2"><Check size={14} /> This Cast is unlocked - enjoy the full Journey</span>
                : <span className="flex items-center justify-center gap-2"><Lock size={13} /> Unlock this Cast to continue the Journey</span>
              }
            </div>
          </section>

          {/* Chapters */}
          <section className="card p-5">
            <h2 className="text-text-primary font-semibold mb-4 flex items-center gap-2">
              <Film size={15} className="text-accent" /> Chapters ({story.chapters.length})
            </h2>
            <div className="space-y-2">
              {story.chapters.map((ch, i) => (
                <div key={ch.id} className="flex items-center gap-3 p-3 rounded-lg bg-bg-elevated hover:bg-bg-hover transition-colors">
                  <div className="w-7 h-7 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-text-primary text-sm font-medium">{ch.title}</div>
                    <div className="text-text-muted text-[10px]">{ch.scenes.length} scene{ch.scenes.length !== 1 ? 's' : ''}</div>
                  </div>
                  {!owned && i > 0 && <Lock size={12} className="text-text-muted" />}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right: sidebar */}
        <div className="space-y-4">
          {/* Cast */}
          <div className="card p-4">
            <h3 className="text-text-primary font-semibold text-sm mb-3 flex items-center gap-2">
              <Mic size={13} className="text-accent" /> Cast
            </h3>
            <div className="space-y-2.5">
              {story.characters.map(char => (
                <div key={char.id} className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ backgroundColor: char.color + '25', color: char.color }}>
                    {char.displayName.charAt(0)}
                  </div>
                  <div>
                    <div className="text-text-primary text-xs font-medium">{char.displayName}</div>
                    <div className="text-text-muted text-[10px] capitalize">{char.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reader features */}
          <div className="card p-4">
            <h3 className="text-text-primary font-semibold text-sm mb-3 flex items-center gap-2">
              <Headphones size={13} className="text-accent" /> Reading Experience
            </h3>
            <div className="space-y-2 text-xs text-text-secondary">
              {[
                { icon: BookOpen,   label: 'Reading Mode — read at your pace' },
                { icon: Headphones, label: 'Audiobook Mode — auto-scroll + highlight' },
                { icon: Film,       label: 'Cinematic Mode — full immersion' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon size={12} className="text-accent shrink-0" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Buy / read button (sidebar) */}
          <div className="card p-4 text-center space-y-3">
            <div className="text-2xl font-bold text-text-primary">
              {owned
                ? <span className="text-success text-base flex items-center justify-center gap-1.5"><Check size={14} /> In My Casts</span>
                : story.isFree ? 'Starter Cast' : formatUsd(story.price)
              }
            </div>
            {owned ? (
              <Link href={`/reader/${story.id}`} className="btn-primary w-full justify-center">
                <Play size={14} className="fill-white" /> Open Cast
              </Link>
            ) : (
              <button onClick={handleBuy} className="btn-primary w-full justify-center">
                <Play size={14} className="fill-white" />
                {story.isFree ? 'Begin Starter Cast' : `Unlock for ${formatUsd(story.price)}`}
              </button>
            )}
            {!owned && (
              <p className="text-text-muted text-[10px]">Instant unlock &middot; No app required</p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
