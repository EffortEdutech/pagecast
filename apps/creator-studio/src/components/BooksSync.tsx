'use client'
/**
 * BooksSync — renders null, exists purely to trigger the Supabase → store sync.
 * Include once in the studio layout so every page has up-to-date books.
 */
import { useBooks } from '@/hooks/useBooks'

export function BooksSync() {
  useBooks()
  return null
}
