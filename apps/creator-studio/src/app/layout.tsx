import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PageCast Creator Studio',
  description: 'Where stories find their voice — Creator Studio',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
