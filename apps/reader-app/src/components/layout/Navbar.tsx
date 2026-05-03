'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Library, ShoppingBag } from 'lucide-react'
import { clsx } from 'clsx'
import { useReaderStore } from '@/store/readerStore'

export function Navbar() {
  const pathname = usePathname()
  const library = useReaderStore(s => s.library)

  const links = [
    { href: '/store',   label: 'Store',   icon: ShoppingBag },
    { href: '/library', label: 'Library', icon: Library, badge: library.length },
  ]

  return (
    <header className="sticky top-0 z-40 h-14 flex items-center justify-between px-6 bg-bg-secondary/90 backdrop-blur-md border-b border-bg-border">
      <Link href="/store" className="flex items-center gap-2.5 group">
        <div className="w-8 h-8 bg-accent rounded-xl flex items-center justify-center group-hover:shadow-accent transition-shadow">
          <BookOpen size={15} className="text-white" />
        </div>
        <div>
          <span className="text-text-primary font-bold text-sm tracking-tight">PageCast</span>
          <span className="text-text-muted text-[10px] ml-1.5 hidden sm:inline">Where stories find their voice</span>
        </div>
      </Link>

      <nav className="flex items-center gap-1">
        {links.map(({ href, label, icon: Icon, badge }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all relative',
              pathname.startsWith(href)
                ? 'text-accent bg-accent/10'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
            )}
          >
            <Icon size={15} />
            <span className="hidden sm:inline">{label}</span>
            {badge != null && badge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {badge}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </header>
  )
}
