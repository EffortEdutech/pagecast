import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'TaleVerse - PageCast',
  description: 'Explore multilingual Casts with voices, scenes, and gentle magic. No app required.',
  openGraph: {
    title: 'PageCast TaleVerse',
    description: 'Explore multilingual Casts with voices, scenes, and gentle magic. No app required.',
    type: 'website',
  },
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
