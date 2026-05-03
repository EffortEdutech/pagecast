import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PageCast — Where stories find their voice',
  description: 'Read and listen to cinematic audio storybooks in your browser.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
