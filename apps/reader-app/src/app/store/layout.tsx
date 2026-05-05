import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Store — PageCast',
  description: 'Browse cinematic audio storybooks. Listen in your browser, no app required.',
  openGraph: {
    title: 'PageCast Story Store',
    description: 'Browse cinematic audio storybooks. Listen in your browser, no app required.',
    type: 'website',
  },
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
