import Link from 'next/link'
import { BookOpen, ChevronRight, Flag, ShieldAlert, UserCheck } from 'lucide-react'
import { legalPages } from './legalContent'

export const metadata = {
  title: 'Legal - PageCast',
  description: 'PageCast legal, privacy, copyright, purchase, and AI disclosure resources.',
}

export default function LegalIndexPage() {
  const requestForms = [
    {
      href: '/legal/report',
      icon: Flag,
      title: 'Report content',
      body: 'Flag a Cast, passage, listing, or audio segment for PageCast review.',
    },
    {
      href: '/legal/takedown',
      icon: ShieldAlert,
      title: 'Takedown request',
      body: 'Submit a copyright, trademark, privacy, publicity, or rights claim.',
    },
    {
      href: '/legal/privacy-request',
      icon: UserCheck,
      title: 'Privacy request',
      body: 'Ask for access, deletion, correction, portability, consent withdrawal, or opt-out handling.',
    },
  ]

  return (
    <main className="min-h-screen bg-bg-primary text-text-primary">
      <section className="max-w-4xl mx-auto px-6 py-14">
        <Link href="/" className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm mb-10">
          <BookOpen size={15} className="text-accent" />
          PageCast
        </Link>
        <div className="mb-8">
          <p className="text-accent text-xs font-semibold uppercase tracking-widest mb-3">Trust Center</p>
          <h1 className="text-4xl font-bold tracking-tight">Legal and compliance</h1>
          <p className="text-text-secondary mt-3 max-w-2xl">
            Policies for readers, creators, rights holders, and global privacy requests. These pages are a product baseline and should be reviewed by counsel before launch.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {Object.entries(legalPages).map(([slug, page]) => (
            <Link key={slug} href={`/legal/${slug}`} className="card p-5 hover:border-accent/40 transition-colors group">
              <p className="text-text-muted text-xs mb-2">{page.eyebrow}</p>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-text-primary">{page.title}</h2>
                <ChevronRight size={16} className="text-text-muted group-hover:text-accent" />
              </div>
              <p className="text-text-muted text-xs mt-3">Updated {page.updated}</p>
            </Link>
          ))}
        </div>

        <section className="mt-10">
          <p className="text-accent text-xs font-semibold uppercase tracking-widest mb-3">Submit a request</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {requestForms.map(({ href, icon: Icon, title, body }) => (
              <Link key={href} href={href} className="card p-5 hover:border-accent/40 transition-colors group">
                <Icon size={18} className="text-gold mb-3" />
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-text-primary">{title}</h2>
                  <ChevronRight size={16} className="text-text-muted group-hover:text-accent" />
                </div>
                <p className="text-text-muted text-xs leading-relaxed mt-3">{body}</p>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}
