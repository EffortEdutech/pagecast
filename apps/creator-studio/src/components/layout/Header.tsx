'use client'
import { usePathname } from 'next/navigation'
import { Bell, HelpCircle } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/voices': 'Voice Library',
  '/assets': 'Asset Manager',
  '/legal-center': 'Legal Center',
  '/settings': 'Settings',
}

interface HeaderProps {
  title?: string
  children?: React.ReactNode
}

export function Header({ title, children }: HeaderProps) {
  const pathname = usePathname()
  const resolvedTitle = title ?? PAGE_TITLES[pathname] ?? 'Creator Studio'

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-bg-border bg-bg-secondary/80 backdrop-blur-sm">
      <h1 className="text-text-primary font-semibold text-base">{resolvedTitle}</h1>
      <div className="flex items-center gap-2">
        {children}
        <button className="btn-ghost px-2 py-1.5">
          <HelpCircle size={16} />
        </button>
        <button className="btn-ghost px-2 py-1.5">
          <Bell size={16} />
        </button>
      </div>
    </header>
  )
}
