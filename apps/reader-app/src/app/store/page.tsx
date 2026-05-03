'use client'
import Link from 'next/link'
import { useReaderStore } from '@/store/readerStore'
import { Navbar } from '@/components/layout/Navbar'
import { DEMO_STORIES } from '@/data/stories'
import { Clock, Mic, Music, BookOpen, Headphones, Sparkles, Check } from 'lucide-react'
import { clsx } from 'clsx'

function StoryCard({ story }: { story: typeof DEMO_STORIES[0] }) {
  const isOwned = useReaderStore(s => s.isOwned(story.id))

  return (
    <Link href={`/book/${story.id}`} className="card hover:border-accent/40 transition-all duration-200 overflow-hidden group flex flex-col">
      {/* Cover */}
      <div className={clsx('h-44 bg-gradient-to-br flex flex-col justify-end p-4 relative', story.coverGradient)}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="relative z-10">
          <div className="flex gap-2 mb-2 flex-wrap">
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
            {isOwned ? <span className="text-success">Owned</span> : `$${story.price.toFixed(2)}`}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function StorePage() {
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
            <span>New storytelling format</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-text-primary leading-tight max-w-2xl">
            Stories you can<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-info">read and hear.</span>
          </h1>
          <p className="text-text-secondary text-lg mt-4 max-w-xl leading-relaxed">
            PageCast combines reading, listening, and cinematic atmosphere — all in your browser. No app. No download.
          </p>

          {/* Feature pills */}
          <div className="flex gap-3 mt-6 flex-wrap">
            {[
              { icon: BookOpen,    label: 'Text + Audio sync' },
              { icon: Headphones,  label: 'Character voices' },
              { icon: Music,       label: 'Cinematic sound design' },
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
            <h2 className="text-text-primary font-bold text-xl">All Stories</h2>
            <p className="text-text-secondary text-sm mt-0.5">{DEMO_STORIES.length} stories available</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {DEMO_STORIES.map(story => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      </main>
    </div>
  )
}
