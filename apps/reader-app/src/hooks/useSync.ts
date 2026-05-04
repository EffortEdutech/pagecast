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
 * Place this hook in the root layout or a top-level client component.
 */
export function useSync() {
  const supabase = createClient()
  const store = useReaderStore()
  const syncedRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── One-time boot sync ──
  useEffect(() => {
    if (syncedRef.current) return
    syncedRef.current = true

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
    }

    boot()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced write-back whenever progress changes ──
  useEffect(() => {
    const progress = store.progress
    if (!Object.keys(progress).length) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
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
          })
        )
      )
    }, 3000) // 3-second debounce

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [store.progress]) // eslint-disable-line react-hooks/exhaustive-deps
}
