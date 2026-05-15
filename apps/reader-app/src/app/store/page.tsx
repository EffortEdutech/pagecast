'use client'
import Link from 'next/link'
import { useReaderStore } from '@/store/readerStore'
import { useHydrated } from '@/hooks/useHydrated'
import { usePublishedBooks } from '@/hooks/usePublishedBooks'
import { Navbar } from '@/components/layout/Navbar'
import { Clock, Mic, Music, BookOpen, Headphones, Sparkles, Check, Languages } from 'lucide-react'
import { clsx } from 'clsx'
import type { Story } from '@/types'
import { formatUsd } from '@/lib/format'

function StoryCard({ story }: { story: Story }) {
  const hydrated   = useHydrated()
  const isOwnedRaw = useReaderStore(s => s.isOwned(story.id))
  const isOwned    = hydrated && isOwnedRaw

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
            {isOwned ? <span className="text-success">Unlocked</span> : story.isFree ? 'Starter Cast' : formatUsd(story.price)}
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
            <span>Fresh from the TaleVerse</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-text-primary leading-tight max-w-2xl">
            Casts you can<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-info">read, hear, and feel.</span>
          </h1>
          <p className="text-text-secondary text-lg mt-4 max-w-xl leading-relaxed">
            Begin multilingual Casts with voices, scenes, and Dream Music. No app. No download.
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
            <h2 className="text-text-primary font-bold text-xl">Explore Casts</h2>
            <p className="text-text-secondary text-sm mt-0.5">
              {loading
                ? 'Opening the TaleVerse...'
                : usingDemo
                  ? `${stories.length} demo Casts - Publish a Cast in Creator Studio to see it here`
                  : `${stories.length} ${stories.length === 1 ? 'Cast' : 'Casts'} in the TaleVerse`
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
            : stories.map(story => <StoryCard key={story.id} story={story} />)
          }
        </div>
      </main>
    </div>
  )
}
