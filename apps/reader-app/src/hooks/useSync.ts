'use client'
import { useEffect, useRef } from 'react'
import { useReaderStore } from '@/store/readerStore'
import * as ProgressApi from '@/lib/supabase/progress'
import { createClient } from '@/lib/supabase/client'

/**
 * Run once at app level — syncs Supabase state into the local readerStore.
 * - Loads the user's library (purchases) and merges into store
 * - Loads all reading progress and merges into store
 * - Sets up a debounced write-back whenever progress changes
 *
 * NOTE: createClient() is called inside effects only (never at render time) so
 * that Next.js static prerender — which runs server-side without Supabase env
 * vars — never triggers createBrowserClient() and never throws.
 *
 * Place this hook in the root layout or a top-level client component.
 */
export function useSync() {
  const store = useReaderStore()
  const syncedRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bookmarkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── One-time boot sync ──
  useEffect(() => {
    if (syncedRef.current) return
    syncedRef.current = true

    const supabase = createClient()

    async function boot() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return // guest — local store only

      // Load library
      const bookIds = await ProgressApi.fetchLibrary()
      if (bookIds.length > 0) {
        useReaderStore.setState(s => ({
          library: [...new Set([...s.library, ...bookIds])],
        }))
      }

      // Load progress
      const progressMap = await ProgressApi.fetchAllProgress()
      if (Object.keys(progressMap).length > 0) {
        useReaderStore.setState(s => {
          const merged: typeof s.progress = { ...s.progress }
          for (const [bookId, p] of Object.entries(progressMap)) {
            // Supabase wins if remote is further along
            const local = s.progress[bookId]
            const remoteAhead =
              !local ||
              p.chapterIdx > local.chapterIdx ||
              (p.chapterIdx === local.chapterIdx && p.sceneIdx > local.sceneIdx) ||
              (p.chapterIdx === local.chapterIdx && p.sceneIdx === local.sceneIdx && p.blockIdx > local.blockIdx)

            if (remoteAhead) {
              merged[bookId] = {
                storyId: bookId,
                chapterIdx: p.chapterIdx,
                sceneIdx: p.sceneIdx,
                blockIdx: p.blockIdx,
                timestamp: Date.now(),
                lastReadAt: new Date().toISOString(),
              }
            }
          }
          return { progress: merged }
        })
      }

      // Load bookmarks
      const bookmarkMap = await ProgressApi.fetchAllBookmarks()
      if (Object.keys(bookmarkMap).length > 0) {
        useReaderStore.setState(s => ({
          bookmarks: {
            ...s.bookmarks,
            ...Object.fromEntries(
              Object.entries(bookmarkMap).map(([bookId, list]) => [
                bookId,
                [
                  ...(s.bookmarks[bookId] ?? []),
                  ...list.map(b => ({
                    id: b.id ?? crypto.randomUUID(),
                    storyId: bookId,
                    chapterIdx: b.chapterIdx,
                    sceneIdx: b.sceneIdx,
                    blockIdx: b.blockIdx,
                    label: b.label,
                    note: b.note ?? undefined,
                    createdAt: b.createdAt ?? new Date().toISOString(),
                  })),
                ].filter((bookmark, index, all) =>
                  all.findIndex(item =>
                    item.chapterIdx === bookmark.chapterIdx &&
                    item.sceneIdx === bookmark.sceneIdx &&
                    item.blockIdx === bookmark.blockIdx
                  ) === index
                ),
              ])
            ),
          },
        }))
      }
    }

    boot()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced write-back whenever progress changes ──
  useEffect(() => {
    const progress = store.progress
    if (!Object.keys(progress).length) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Save all progress entries to Supabase (cheap upserts)
      await Promise.all(
        Object.values(progress).map(p =>
          ProgressApi.saveProgress({
            bookId: p.storyId,
            chapterIdx: p.chapterIdx,
            sceneIdx: p.sceneIdx,
            blockIdx: p.blockIdx,
            lastReadAt: p.lastReadAt,
            completedAt: p.completedAt,
          })
        )
      )
    }, 3000) // 3-second debounce

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [store.progress]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced bookmark write-back ──
  useEffect(() => {
    const bookmarks = store.bookmarks
    if (!Object.keys(bookmarks).length) return

    if (bookmarkTimerRef.current) clearTimeout(bookmarkTimerRef.current)
    bookmarkTimerRef.current = setTimeout(async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await Promise.all(
        Object.entries(bookmarks).map(([bookId, list]) =>
          ProgressApi.saveBookmarks(bookId, list.map(b => ({
            bookId,
            chapterIdx: b.chapterIdx,
            sceneIdx: b.sceneIdx,
            blockIdx: b.blockIdx,
            label: b.label,
            note: b.note,
            createdAt: b.createdAt,
          })))
        )
      )
    }, 3000)

    return () => {
      if (bookmarkTimerRef.current) clearTimeout(bookmarkTimerRef.current)
    }
  }, [store.bookmarks]) // eslint-disable-line react-hooks/exhaustive-deps
}
