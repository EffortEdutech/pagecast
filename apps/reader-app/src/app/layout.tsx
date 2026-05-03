import type { Metadata } from 'next'
import './globals.css'
import { SyncProvider } from '@/components/SyncProvider'

export const metadata: Metadata = {
  title: 'PageCast — Where stories find their voice',
  description: 'Read and listen to cinematic audio storybooks in your browser.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SyncProvider>{children}</SyncProvider>
      </body>
    </html>
  )
}
