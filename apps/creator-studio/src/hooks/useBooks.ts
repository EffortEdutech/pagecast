'use client'
import { useCallback, useEffect, useState } from 'react'
import { useStudioStore } from '@/store/studioStore'
import * as BooksApi from '@/lib/supabase/books'
import type { Story, StoryStatus } from '@/types'

export function useBooks() {
  const store = useStudioStore()
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [synced, setSynced]   = useState(false)

  useEffect(() => {
    if (synced) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const books = await BooksApi.fetchBooks()
        if (!cancelled) {
          useStudioStore.setState(state => {
            const merged = books.map(remote => {
              const local = state.stories.find(s => s.id === remote.id)
              return local ? { ...remote, chapters: local.chapters } : remote
            })
            return { stories: merged }
          })
          setSynced(true)
        }
      } catch {
        if (!cancelled) setError('Failed to load books from Supabase.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [synced])

  const createBook = useCallback(async (title: string, description: string): Promise<Story | null> => {
    const book = await BooksApi.createBook(title, description)
    if (!book) { setError('Failed to create book.'); return null }
    useStudioStore.setState(state => ({ stories: [book, ...state.stories] }))
    return book
  }, [])

  const updateBook = useCallback(async (id: string, updates: Partial<Story>) => {
    const ok = await BooksApi.updateBook(id, updates)
    if (!ok) { setError('Failed to update book.'); return }
    store.updateStory(id, updates)
  }, [store])

  const deleteBook = useCallback(async (id: string) => {
    const ok = await BooksApi.deleteBook(id)
    if (!ok) { setError('Failed to delete book.'); return }
    store.deleteStory(id)
  }, [store])

  const publishBook = useCallback(async (id: string, status: StoryStatus) => {
    const ok = await BooksApi.publishBook(id, status as 'draft' | 'published')
    if (!ok) { setError('Failed to update publish status.'); return }
    store.updateStory(id, { status })
  }, [store])

  const duplicateBook = useCallback(async (id: string): Promise<Story | null> => {
    const copy = await BooksApi.duplicateBook(id)
    if (!copy) { setError('Failed to duplicate book.'); return null }
    useStudioStore.setState(state => ({ stories: [copy, ...state.stories] }))
    return copy
  }, [])

  return { loading, error, createBook, updateBook, deleteBook, publishBook, duplicateBook }
}
