'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStudioStore } from '@/store/studioStore'
import { Sidebar } from '@/components/layout/Sidebar'

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isAuthenticated = useStudioStore(s => s.isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) return null

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
