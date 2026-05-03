'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/useUser'

export default function Home() {
  const router = useRouter()
  const { user, loading } = useUser()

  useEffect(() => {
    if (loading) return
    if (user) {
      router.replace('/dashboard')
    } else {
      router.replace('/login')
    }
  }, [user, loading, router])

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="flex items-center gap-3 text-text-secondary">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading PageCast…</span>
      </div>
    </div>
  )
}
