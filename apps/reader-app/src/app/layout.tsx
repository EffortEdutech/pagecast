import type { Metadata } from 'next'
import { Suspense } from 'react'
import './globals.css'
import { SyncProvider } from '@/components/SyncProvider'
import { UtmCapture } from '@/components/UtmCapture'

export const metadata: Metadata = {
  title: 'PageCast - A world of Tales with voices',
  description: 'Begin multilingual Casts with voices, scenes, and gentle magic in your browser.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-bg-primary text-text-primary antialiased">
        <SyncProvider>
          <Suspense fallback={null}>
            <UtmCapture />
          </Suspense>
          {children}
        </SyncProvider>
      </body>
    </html>
  )
}
