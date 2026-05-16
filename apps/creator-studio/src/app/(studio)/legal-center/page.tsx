'use client'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { AlertTriangle, BadgeCheck, BookOpen, FileText, Globe2, Mic, ShieldCheck } from 'lucide-react'

const sections = [
  {
    icon: ShieldCheck,
    title: 'Creator Terms and warranties',
    body: 'Creators keep ownership, but must grant PageCast hosting, streaming, display, promotion, and distribution rights needed to publish each Cast.',
  },
  {
    icon: BookOpen,
    title: 'Book rights metadata',
    body: 'Each book should record whether it is original, licensed, public domain, commissioned, AI-generated, or mixed, plus owner, source, jurisdiction, and attribution.',
  },
  {
    icon: Mic,
    title: 'Audio and voice rights',
    body: 'Text rights and audio rights can be separate. Uploaded narration, synthetic voices, music, and SFX all need permission or proof of ownership.',
  },
  {
    icon: Globe2,
    title: 'Worldwide launch readiness',
    body: 'PageCast should apply a global baseline first, then add EU/UK, US, Canada, Malaysia, and APAC modules before active market campaigns.',
  },
]

const checklist = [
  'I own or have licensed the manuscript and adaptation rights.',
  'I control audio rights for narration, synthetic audio, music, and SFX.',
  'I have recorded attribution, source, license, and public-domain proof where needed.',
  'No personal data appears in the Cast without consent or another valid basis.',
  'AI-generated or synthetic audio/content is disclosed where required.',
]

export default function LegalCenterPage() {
  return (
    <>
      <Header title="Legal Center" />
      <main className="flex-1 overflow-y-auto p-6 max-w-5xl space-y-6">
        <section className="card p-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-accent text-xs font-semibold uppercase tracking-widest mb-2">Creator compliance</p>
              <h1 className="text-text-primary text-2xl font-bold tracking-tight">Publish globally with cleaner rights records</h1>
              <p className="text-text-secondary text-sm leading-relaxed mt-3 max-w-3xl">
                PageCast is being prepared as a worldwide platform. This center collects the rights, privacy, copyright, and AI disclosure expectations that creators should satisfy before publishing.
              </p>
            </div>
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-4">
          {sections.map(({ icon: Icon, title, body }) => (
            <section key={title} className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} className="text-gold" />
                <h2 className="text-text-primary font-semibold">{title}</h2>
              </div>
              <p className="text-text-secondary text-sm leading-relaxed">{body}</p>
            </section>
          ))}
        </div>

        <section className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BadgeCheck size={16} className="text-success" />
            <h2 className="text-text-primary font-semibold">Pre-publish checklist</h2>
          </div>
          <div className="space-y-2">
            {checklist.map(item => (
              <div key={item} className="flex items-start gap-2 text-sm text-text-secondary">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-warning/20 bg-warning/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={17} className="text-warning shrink-0 mt-0.5" />
            <div>
              <h2 className="text-warning font-semibold text-sm">Implementation status</h2>
              <p className="text-text-secondary text-sm leading-relaxed mt-1">
                This page is the first visible compliance surface. The next build step is to connect Book Rights, Asset Rights, and the Publish Attestation gate to the database migration.
              </p>
            </div>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={16} className="text-info" />
            <h2 className="text-text-primary font-semibold">Reader-facing legal pages</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ['Privacy', '/legal/privacy'],
              ['Terms', '/legal/terms'],
              ['Creator Terms', '/legal/creator-terms'],
              ['Copyright', '/legal/copyright'],
              ['Refund', '/legal/refund'],
              ['AI Disclosure', '/legal/ai-disclosure'],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={`http://localhost:3800${href}`}
                target="_blank"
                className="btn-secondary"
              >
                {label}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  )
}

