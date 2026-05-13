'use client'

import Link from 'next/link'
import { usePublishedBooks } from '@/hooks/usePublishedBooks'
import { Navbar } from '@/components/layout/Navbar'
import { formatUsd } from '@/lib/format'
import {
  ArrowRight,
  BookOpen,
  Check,
  Globe2,
  Headphones,
  Languages,
  Lock,
  Play,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { clsx } from 'clsx'

const channels = ['TikTok', 'Amazon', 'Shopee', 'Instagram', 'YouTube']
const languages = ['English', 'Arabic', 'Malay', 'Indonesian', 'Hindi', 'Spanish']

export default function StartPage() {
  const { stories, loading } = usePublishedBooks()
  const featured = stories.slice(0, 3)
  const firstStory = featured[0]

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />

      <main>
        <section className="border-b border-bg-border bg-bg-secondary">
          <div className="max-w-6xl mx-auto px-6 py-12 lg:py-16 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-accent/25 bg-accent/10 text-accent text-xs font-semibold mb-5">
                <Globe2 size={13} />
                Global Tales. Multilingual Explorers.
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold text-text-primary leading-tight max-w-2xl">
                Begin a Cast free, then enter the Tale behind it.
              </h1>

              <p className="text-text-secondary text-lg leading-relaxed mt-5 max-w-xl">
                PageCast turns Tale previews from social platforms and marketplaces into Explorers,
                gentle unlocks, and instant Cast access.
              </p>

              <div className="flex flex-wrap gap-3 mt-7">
                <Link href={firstStory ? `/book/${firstStory.id}` : '/store'} className="btn-primary px-5 py-3">
                  <Play size={16} className="fill-white" />
                  Begin Free Cast
                </Link>
                <Link href="/pricing" className="btn-secondary px-5 py-3">
                  View Cast Pass
                  <ArrowRight size={15} />
                </Link>
              </div>

              <div className="flex flex-wrap gap-2 mt-7">
                {channels.map(channel => (
                  <span key={channel} className="px-2.5 py-1 rounded-md bg-bg-elevated border border-bg-border text-text-muted text-xs">
                    {channel} lead ready
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden shadow-elevated">
              <div className="px-4 py-3 border-b border-bg-border flex items-center justify-between">
                <div>
                  <p className="text-text-primary font-semibold text-sm">Explorer Journey</p>
                  <p className="text-text-muted text-xs">Preview to unlock to My Casts</p>
                </div>
                <Sparkles size={16} className="text-accent" />
              </div>

              <div className="p-4 space-y-3">
                {[
                  { icon: Globe2, title: 'Arrive from any channel', text: 'UTM source is captured for attribution.' },
                  { icon: Headphones, title: 'Begin the first Moment', text: 'Let Explorers feel the Cast before signup.' },
                  { icon: Lock, title: 'Unlock a Premium Cast', text: 'The gentle unlock step stays inside PageCast.' },
                  { icon: BookOpen, title: 'Resume in My Casts', text: 'The Journey stays attached to the Explorer account.' },
                ].map(({ icon: Icon, title, text }, index) => (
                  <div key={title} className="flex gap-3 p-3 rounded-lg bg-bg-elevated border border-bg-border">
                    <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
                      <Icon size={15} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-text-muted text-[10px] font-semibold">0{index + 1}</span>
                        <p className="text-text-primary font-medium text-sm">{title}</p>
                      </div>
                      <p className="text-text-secondary text-xs mt-0.5">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <h2 className="text-text-primary font-bold text-2xl">Featured Cast previews</h2>
              <p className="text-text-secondary text-sm mt-1">Use these as Tale destinations from TikTok, Amazon, and marketplace links.</p>
            </div>
            <Link href="/store" className="btn-ghost hidden sm:flex">
              Explore all
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {loading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="card overflow-hidden animate-pulse">
                    <div className="h-40 bg-bg-elevated" />
                    <div className="p-4 space-y-2">
                      <div className="h-3 bg-bg-elevated rounded w-2/3" />
                      <div className="h-3 bg-bg-elevated rounded" />
                    </div>
                  </div>
                ))
              : featured.map(story => (
                  <Link key={story.id} href={`/book/${story.id}`} className="card overflow-hidden hover:border-accent/40 transition-colors">
                    <div className={clsx('h-40 bg-gradient-to-br p-4 flex flex-col justify-end', story.coverGradient)}>
                      <div className="flex gap-2 mb-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-black/25 text-white/85 text-[10px]">{story.language.toUpperCase()}</span>
                        {story.genre && <span className="px-2 py-0.5 rounded-md bg-black/25 text-white/85 text-[10px]">{story.genre}</span>}
                      </div>
                      <h3 className="text-white font-bold text-lg leading-tight">{story.title}</h3>
                    </div>
                    <div className="p-4">
                      <p className="text-text-secondary text-xs leading-relaxed line-clamp-3">{story.description}</p>
                      <div className="flex items-center justify-between mt-4 text-xs">
                        <span className="text-text-muted">Starter Moment</span>
                        <span className="text-text-primary font-semibold">{story.price === 0 ? 'Starter Cast' : formatUsd(story.price)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
          </div>
        </section>

        <section className="border-t border-bg-border bg-bg-secondary">
          <div className="max-w-6xl mx-auto px-6 py-10 grid lg:grid-cols-3 gap-5">
            <div className="card p-5">
              <Languages size={20} className="text-accent mb-3" />
              <h3 className="text-text-primary font-semibold">Multilingual TaleVerse</h3>
              <p className="text-text-secondary text-sm mt-2">Casts can be marketed by language, audience, and campaign.</p>
              <div className="flex flex-wrap gap-2 mt-4">
                {languages.map(language => (
                  <span key={language} className="px-2 py-1 rounded-md bg-bg-elevated text-text-muted text-[11px]">{language}</span>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <ShieldCheck size={20} className="text-success mb-3" />
              <h3 className="text-text-primary font-semibold">Direct Explorer relationship</h3>
              <p className="text-text-secondary text-sm mt-2">External platforms create discovery, but accounts, unlocks, and access live inside PageCast.</p>
              <div className="space-y-2 mt-4">
                {['Email relationship', 'Unlock history', 'My Casts retention'].map(item => (
                  <div key={item} className="flex items-center gap-2 text-text-secondary text-xs">
                    <Check size={12} className="text-success" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <Headphones size={20} className="text-info mb-3" />
              <h3 className="text-text-primary font-semibold">Ready for the full Journey</h3>
              <p className="text-text-secondary text-sm mt-2">The promise is simple: arrive, preview, enter, unlock, and resume the Cast immediately.</p>
              <Link href="/pricing" className="btn-primary mt-4 inline-flex">
                See Cast Pass
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
