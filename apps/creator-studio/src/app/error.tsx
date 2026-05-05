"use client"
import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center text-center px-4">
      <AlertCircle className="w-16 h-16 text-rose-400/60 mb-6" />
      <h1 className="text-3xl font-bold text-text-primary mb-2">Something went wrong</h1>
      <p className="text-text-secondary mb-8">
        An unexpected error occurred in Creator Studio.
      </p>
      <div className="flex gap-3">
        <button onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/dashboard" className="btn btn-secondary">
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}
