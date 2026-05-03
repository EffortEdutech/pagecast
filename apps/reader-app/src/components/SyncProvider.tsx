'use client'
import { useSync } from '@/hooks/useSync'

/**
 * Invisible component that activates Supabase ↔ readerStore sync.
 * Rendered once in the root layout.
 */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  useSync()
  return <>{children}</>
}
