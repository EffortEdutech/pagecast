import { useEffect, useState } from 'react'

/**
 * Returns false on the server and during the first client render,
 * then flips to true once the Zustand persist store has rehydrated.
 * Use this to avoid server/client HTML mismatches when reading
 * persisted store values (library, prefs, progress).
 *
 * Usage:
 *   const hydrated = useHydrated()
 *   const library  = useReaderStore(s => s.library)
 *   // Render nothing (or a skeleton) until hydrated:
 *   if (!hydrated) return null
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])
  return hydrated
}
