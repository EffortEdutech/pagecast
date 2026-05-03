'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BookOpen, Library, ShoppingBag, LogIn, LogOut, User } from 'lucide-react'
import { clsx } from 'clsx'
import { useReaderStore } from '@/store/readerStore'
import { createClient } from '@/lib/supabase/client'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const library = useReaderStore(s => s.library)
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/store')
    router.refresh()
    setShowUserMenu(false)
  }

  const displayName = user?.user_metadata?.display_name
    ?? user?.email?.split('@')[0]
    ?? 'Reader'
  const initials = displayName.charAt(0).toUpperCase()

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

        {/* Auth */}
        {user ? (
          <div className="relative ml-1">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center text-accent text-xs font-bold hover:bg-accent/40 transition-colors"
              title={displayName}
            >
              {initials}
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-10 z-50 w-48 card shadow-elevated border border-bg-border py-1.5">
                  <div className="px-3 py-2 border-b border-bg-border">
                    <div className="text-text-primary text-xs font-medium">{displayName}</div>
                    <div className="text-text-muted text-[10px]">{user.email}</div>
                  </div>
                  <button
                    onClick={() => { router.push('/library'); setShowUserMenu(false) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
                  >
                    <User size={12} /> My Library
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    <LogOut size={12} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all ml-1"
          >
            <LogIn size={15} />
            <span className="hidden sm:inline">Sign In</span>
          </Link>
        )}
      </nav>
    </header>
  )
}
