'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { BookOpen, LayoutDashboard, Mic, Music, Settings, LogOut, ChevronRight, Sparkles } from 'lucide-react'
import { clsx } from 'clsx'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/voices',    icon: Mic,             label: 'Characters & Voices' },
  { href: '/assets',    icon: Music,           label: 'Assets' },
  { href: '/settings',  icon: Settings,        label: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName  = user?.user_metadata?.display_name ?? user?.email?.split('@')[0] ?? 'Creator'
  const displayEmail = user?.email ?? ''
  const initials     = displayName.charAt(0).toUpperCase()

  return (
    <aside className="w-56 shrink-0 bg-bg-secondary border-r border-bg-border flex flex-col h-screen">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-bg-border gap-3 shrink-0">
        <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center shrink-0">
          <BookOpen size={14} className="text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-text-primary font-semibold text-sm leading-tight truncate">PageCast</div>
          <div className="text-text-muted text-[10px] leading-tight">Creator Studio</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group',
                active
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
              )}
            >
              <Icon size={16} className={active ? 'text-accent' : 'text-text-muted group-hover:text-text-secondary'} />
              {label}
              {active && <ChevronRight size={12} className="ml-auto text-accent/60" />}
            </Link>
          )
        })}

        {/* Voice credits placeholder */}
        <div className="mt-4 mx-1 p-3 rounded-lg bg-bg-card border border-bg-border">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={12} className="text-gold" />
            <span className="text-text-secondary text-xs font-medium">Voice Credits</span>
          </div>
          <div className="w-full bg-bg-border rounded-full h-1.5 mb-1.5">
            <div className="bg-accent rounded-full h-1.5 w-0 transition-all" />
          </div>
          <p className="text-text-muted text-[10px]">0 / 60 min used</p>
        </div>
      </nav>

      {/* User */}
      <div className="border-t border-bg-border p-3 space-y-1 shrink-0">
        {user && (
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-accent/30 flex items-center justify-center text-accent text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-text-primary text-xs font-medium truncate">{displayName}</div>
              <div className="text-text-muted text-[10px] truncate">{displayEmail}</div>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors text-sm"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
