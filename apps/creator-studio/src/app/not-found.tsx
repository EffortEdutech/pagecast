import Link from 'next/link'
import { BookOpen } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center text-center px-4">
      <BookOpen className="w-16 h-16 text-accent/40 mb-6" />
      <h1 className="text-4xl font-bold text-text-primary mb-2">404</h1>
      <p className="text-lg text-text-secondary mb-8">
        This page doesn&apos;t exist.
      </p>
      <Link href="/dashboard" className="btn btn-primary">
        Back to dashboard
      </Link>
    </div>
  )
}
