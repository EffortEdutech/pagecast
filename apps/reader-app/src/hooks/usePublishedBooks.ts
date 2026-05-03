'use client'
import { useEffect, useState } from 'react'
import { fetchPublishedBooks } from '@/lib/supabase/books'
import { DEMO_STORIES } from '@/data/stories'
import type { Story } from '@/types'

/**
 * Fetches published books from Supabase.
 * Falls back to DEMO_STORIES if Supabase returns nothing (offline / no published books yet).
 */
export function usePublishedBooks() {
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchPublishedBooks().then(books => {
      if (cancelled) return
      if (books.length > 0) {
        setStories(books)
        setUsingDemo(false)
      } else {
        // No published books in DB yet — show demo stories so the store isn't empty
        setStories(DEMO_STORIES)
        setUsingDemo(true)
      }
      setLoading(false)
    }).catch(() => {
      if (!cancelled) {
        setStories(DEMO_STORIES)
        setUsingDemo(true)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  return { stories, loading, usingDemo }
}
