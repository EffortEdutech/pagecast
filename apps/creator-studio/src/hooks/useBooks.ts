'use client'
import { useCallback, useEffect, useState } from 'react'
import { useStudioStore } from '@/store/studioStore'
import * as BooksApi from '@/lib/supabase/books'
import type { Story, StoryStatus } from '@/types'

/**
 * Sprint 2 hook — syncs Supabase `books` table with the local studioStore.
 *
 * Pattern: load from Supabase → populate studioStore → studioStore drives the UI.
 * This means the editor keeps working unchanged; it reads from studioStore as before.
 */
export function useBooks() {
  const store = useStudioStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [synced, setSynced] = useState(false)

  // ── Load books from Supabase on mount ──
  useEffect(() => {
    if (synced) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const books = await BooksApi.fetchBooks()
        if (!cancelled) {
          // Replace studioStore stories with Supabase data
          // Keep any in-memory chapters/scenes/blocks that may have been edited
          useStudioStore.setState(state => {
            const merged = books.map(remote => {
              const local = state.stories.find(s => s.id === remote.id)
              // Preserve local chapter/scene/block edits if the book already exists locally
              return local
                ? { ...remote, chapters: local.chapters }
                : remote
            })
            return { stories: merged }
          })
          setSynced(true)
        }
      } catch (err) {
        if (!cancelled) setError('Failed to load books from Supabase.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [synced]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Create ──
  const createBook = useCallback(async (title: string, description: string): Promise<Story | null> => {
    const book = await BooksApi.createBook(title, description)
    if (!book) { setError('Failed to create book.'); return null }
    // Add to studioStore
    useStudioStore.setState(state => ({ stories: [book, ...state.stories] }))
    return book
  }, [])

  // ── Update metadata ──
  const updateBook = useCallback(async (id: string, updates: Partial<Story>) => {
    const ok = await BooksApi.updateBook(id, updates)
    if (!ok) { setError('Failed to update book.'); return }
    store.updateStory(id, updates)
  }, [store])

  // ── Delete ──
  const deleteBook = useCallback(async (id: string) => {
    const ok = await BooksApi.deleteBook(id)
    if (!ok) { setError('Failed to delete book.'); return }
    store.deleteStory(id)
  }, [store])

  // ── Publish / Unpublish ──
  const publishBook = useCallback(async (id: string, status: StoryStatus) => {
    const ok = await Bo