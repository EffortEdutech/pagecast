'use client'
import { usePathname } from 'next/navigation'
import { Bell, HelpCircle } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/voices': 'Voice Library',
  '/assets': 'Asset Manager',
  '/legal-center': 'Legal Center',
  '/compliance-queue': 'Compliance Queue',
  '/compliance-sla': 'Legal SLA Dashboard',
  '/compliance-records': 'Compliance Records',
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
    <header className="min-h-14 shrink-0 border-b border-bg-border bg-bg-secondary/90 px-3 py-2 backdrop-blur-sm sm:px-4 lg:px-6">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-sm font-semibold text-text-primary sm:text-base">{resolvedTitle}</h1>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          {children}
          <button className="btn-ghost px-2 py-1.5" aria-label="Help">
            <HelpCircle size={16} />
          </button>
          <button className="btn-ghost px-2 py-1.5" aria-label="Notifications">
            <Bell size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
