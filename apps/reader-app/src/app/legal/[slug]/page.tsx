import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { isLegalSlug, legalPages } from '../legalContent'

export function generateStaticParams() {
  return Object.keys(legalPages).map(slug => ({ slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  if (!isLegalSlug(params.slug)) return {}
  const page = legalPages[params.slug]
  return {
    title: `${page.title} - PageCast`,
    description: `${page.title} for PageCast readers, creators, and rights holders.`,
  }
}

export default function LegalDetailPage({ params }: { params: { slug: string } }) {
  if (!isLegalSlug(params.slug)) notFound()
  const page = legalPages[params.slug]

  return (
    <main className="min-h-screen bg-bg-primary text-text-primary">
      <article className="max-w-3xl mx-auto px-6 py-14">
        <div className="flex items-center justify-between gap-4 mb-10">
          <Link href="/legal" className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm">
            <ArrowLeft size={14} />
            Legal center
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 text-text-muted hover:text-text-secondary text-sm">
            <BookOpen size={14} className="text-accent" />
            PageCast
          </Link>
        </div>

        <header className="border-b border-bg-border pb-8 mb-8">
          <p className="text-accent text-xs font-semibold uppercase tracking-widest mb-3">{page.eyebrow}</p>
          <h1 className="text-4xl font-bold tracking-tight">{page.title}</h1>
          <p className="text-text-muted text-sm mt-4">Updated {page.updated}</p>
        </header>

        <div className="space-y-7">
          {page.sections.map(([title, body]) => (
            <section key={title} className="card p-5">
              <h2 className="text-text-primary font-semibold mb-2">{title}</h2>
              <p className="text-text-secondary text-sm leading-relaxed">{body}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-gold/20 bg-gold/10 p-4">
          <p className="text-gold text-sm font-medium mb-1">Launch note</p>
          <p className="text-text-secondary text-xs leading-relaxed">
            This page is a working product policy draft. Final legal copy should be reviewed for every market where PageCast is actively promoted.
          </p>
        </div>
      </article>
    </main>
  )
}

