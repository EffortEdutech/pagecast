'use client'
import Link from 'next/link'
import { useReaderStore } from '@/store/readerStore'
import { useHydrated } from '@/hooks/useHydrated'
import { usePublishedBooks } from '@/hooks/usePublishedBooks'
import { Navbar } from '@/components/layout/Navbar'
import {
  BookOpen, Play, Clock, Mic, Music, Library,
  ShoppingBag, ChevronRight, RotateCcw
} from 'lucide-react'
import { clsx } from 'clsx'
import type { Story } from '@/types'

function ProgressRing({ pct }: { pct: number }) {
  const r = 18
  const circ = 2 * Math.PI * r
  const dash = circ * pct
  return (
    <svg width="44" height="44" className="rotate-[-90deg]">
      <circle cx="22" cy="22" r={r} stroke="#2E2E38" strokeWidth="3" fill="none" />
      <circle
        cx="22" cy="22" r={r}
        stroke="#7C5CFC" strokeWidth="3" fill="none"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
    </svg>
  )
}

function LibraryCard({ story }: { story: Story }) {
  const hydrated    = useHydrated()
  const progressRaw = useReaderStore(s => s.getProgress(story.id))
  const progress    = hydrated ? progressRaw : undefined

  const totalBlocks = story.chapters.reduce((acc, ch) =>
    ch.scenes.reduce((a, sc) => a + sc.blocks.length, acc), 0)

  const doneBlocks = (() => {
    if (!progress) return 0
    let count = 0
    for (let ci = 0; ci < progress.chapterIdx; ci++) {
      story.chapters[ci]?.scenes.forEach(sc => { count += sc.blocks.length })
    }
    const ch = story.chapters[progress.chapterIdx]
    if (ch) {
      for (let si = 0; si < progress.sceneIdx; si++) {
        count += ch.scenes[si]?.blocks.length ?? 0
      }
      count += progress.blockIdx
    }
    return count
  })()

  const pct = totalBlocks > 0 ? doneBlocks / totalBlocks : 0
  const isStarted = progress !== null && doneBlocks > 0
  const isFinished = pct >= 0.99

  return (
    <div className="card hover:border-accent/40 transition-all duration-200 overflow-hidden flex flex-col sm:flex-row gap-0">
      {/* Cover strip */}
      <div className={clsx('h-36 sm:h-auto sm:w-28 bg-gradient-to-br flex-shrink-0 flex items-center justify-center relative', story.coverGradient)}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent sm:bg-gradient-to-r" />
        <BookOpen size={28} className="text-white/25 relative z-10" />
      </div>

      {/* Info */}
      <div className="flex-1 p-5 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex gap-2 mb-1 flex-wrap">
                {story.genre && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent">{story.genre}</span>}
                {isFinished && <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success">Finished</span>}
              </div>
              <h3 className="text-text-primary font-bold text-base leading-tight">{story.title}</h3>
              <p className="text-text-secondary text-xs leading-relaxed mt-1 line-clamp-2">{story.description}</p>
            </div>
            {/* Progress ring */}
            <div className="relative shrink-0">
              <ProgressRing pct={pct} />
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-text-primary">
                {Math.round(pct * 100)}%
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 mt-2 text-text-muted text-[10px] flex-wrap">
            {story.durationMinutes && <span className="flex items-center gap-1"><Clock size={10} /> {story.durationMinutes}m</span>}
            {story.hasMusic && <span className="flex items-center gap-1"><Music size={10} /> Music</span>}
            <span className="flex items-center gap-1"><Mic size={10} /> {story.characters.filter(c => c.role === 'character').length} voices</span>
            {isStarted && !isFinished && (
              <span className="text-text-secondary">
                Ch {(progress!.chapterIdx + 1)} of {story.chapters.length}
              </span>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-2">
          <Link
            href={`/reader/${story.id}`}
            className="btn-primary text-xs px-4 py-2"
          >
            <Play size={12} className="fill-white" />
            {isFinished ? 'Read Again' : isStarted ? 'Continue' : 'Start Reading'}
          </Link>
          {isStarted && !isFinished && (
            <Link href={`/book/${story.id}`} className="btn-ghost text-xs px-3 py-2">
              <ChevronRight size={12} /> Story Info
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LibraryPage() {
  const hydrated       = useHydrated()
  const libraryRaw     = useReaderStore(s => s.library)
  const library        = hydrated ? libraryRaw : []
  const { stories: allPublished } = usePublishedBooks()
  // Show books the user owns; if none in DB yet fall back gracefully
  const ownedStories = allPublished.filter(s => library.includes(s.id))

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-text-primary font-bold text-2xl flex items-center gap-2">
              <Library size={22} className="text-accent" /> My Library
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              {ownedStories.length} {ownedStories.length === 1 ? 'story' : 'stories'} owned
            </p>
          </div>
        </div>

        {/* Empty state */}
        {ownedStories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-bg-elevated flex items-center justify-center">
              <BookOpen size={28} className="text-text-muted" />
            </div>
            <div>
              <p className="text-text-primary font-semibold">Your library is empty</p>
              <p className="text-text-secondary text-sm mt-1">Browse the store to find your first story.</p>
            </div>
            <Link href="/store" className="btn-primary mt-2">
              <ShoppingBag size={14} /> Browse Store
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {ownedStories.map(story => (
              <LibraryCard key={story.id} story={story} />
            ))}

            {/* Store CTA */}
            <div className="mt-8 p-5 card border-dashed flex items-center justify-between gap-4">
              <div>
                <p className="text-text-primary font-medium text-sm">Looking for more stories?</p>
                <p className="text-text-muted text-xs mt-0.5">{allPublished.length - ownedStories.length} more available in the store.</p>
              </div>
              <Link href="/store" className="btn-secondary text-xs shrink-0">
                <ShoppingBag size={13} /> Visit Store
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
