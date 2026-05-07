'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useStudioStore } from '@/store/studioStore'
import * as BlocksApi from '@/lib/supabase/blocks'
import type { StoryBlock, Chapter, Scene } from '@/types'

/**
 * Sprint 3 hook — wraps chapter/scene/block CRUD with Supabase persistence.
 *
 * Pattern:
 * 1. On mount, fetch chapters+scenes+blocks from Supabase for the active book
 * 2. Every mutation updates studioStore immediately (optimistic UI) then syncs to Supabase
 * 3. The studio editor page reads from studioStore as before — no changes needed there
 *
 * Race-condition fix (Vercel / empty localStorage):
 * useBooks runs async — on first render the story may not yet be in studioStore.
 * We must NOT lock loadedRef until the story is actually present in the store,
 * otherwise the fetchBookContent result silently does nothing (map finds no match)
 * and the editor shows blank content forever.
 */
export function useEditor(bookId: string) {
  const store = useStudioStore()
  const story = store.stories.find(s => s.id === bookId)
  const storyInStore = !!story   // becomes true once useBooks adds it
  const [loading, setLoading] = useState(false)
  const [contentReady, setContentReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedRef = useRef<string | null>(null)
  const blockSaveQueues = useRef<Record<string, Promise<void>>>({})

  useEffect(() => {
    setContentReady(false)
  }, [bookId])

  // ── Load content from Supabase once per bookId, but only after the story
  //    exists in studioStore (so the setState map actually finds it).        ──
  useEffect(() => {
    if (loadedRef.current === bookId || !bookId) return
    if (!storyInStore) return   // wait — useBooks hasn't populated the store yet

    loadedRef.current = bookId
    let cancelled = false

    async function load() {
      setLoading(true)
      setContentReady(false)
      try {
        const chapters = await BlocksApi.fetchBookContent(bookId)
        if (!cancelled) {
          // Populate studioStore with Supabase content
          useStudioStore.setState(state => ({
            stories: state.stories.map(s =>
              s.id === bookId ? { ...s, chapters } : s
            ),
          }))
        }
      } catch {
        if (!cancelled) setError('Failed to load story content.')
      } finally {
        if (!cancelled) {
          setLoading(false)
          setContentReady(true)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [bookId, storyInStore])   // re-runs when storyInStore flips true

  // ── Chapter ops ──

  const addChapter = useCallback(async (title: string): Promise<Chapter | null> => {
    const sortOrder = (story?.chapters.length ?? 0)
    const chapter = await BlocksApi.createChapter(bookId, title, sortOrder)
    if (!chapter) { setError('Failed to create chapter.'); return null }
    store.addChapter(bookId, title) // studioStore keeps local id; we'll reconcile on next load
    // Replace last chapter in store with the one that has the real DB id
    useStudioStore.setState(state => {
      const stories = state.stories.map(s => {
        if (s.id !== bookId) return s
        const chapters = [...s.chapters]
        // Replace the just-added chapter (last one) with the DB version
        chapters[chapters.length - 1] = chapter
        return { ...s, chapters }
      })
      return { stories }
    })
    return chapter
  }, [bookId, story?.chapters.length, store])

  const renameChapter = useCallback(async (chapterId: string, title: string) => {
    store.updateChapter(bookId, chapterId, { title })
    await BlocksApi.updateChapter(chapterId, { title })
  }, [bookId, store])

  const removeChapter = useCallback(async (chapterId: string) => {
    store.deleteChapter(bookId, chapterId)
    await BlocksApi.deleteChapter(chapterId)
  }, [bookId, store])

  // ── Scene ops ──

  const addScene = useCallback(async (chapterId: string, title: string): Promise<Scene | null> => {
    const chapter = story?.chapters.find(c => c.id === chapterId)
    const sortOrder = chapter?.scenes.length ?? 0
    const scene = await BlocksApi.createScene(bookId, chapterId, title, sortOrder)
    if (!scene) { setError('Failed to create scene.'); return null }
    store.addScene(bookId, chapterId, title)
    // Replace last scene with DB version
    useStudioStore.setState(state => {
      const stories = state.stories.map(s => {
        if (s.id !== bookId) return s
        return {
          ...s,
          chapters: s.chapters.map(ch => {
            if (ch.id !== chapterId) return ch
            const scenes = [...ch.scenes]
            scenes[scenes.length - 1] = scene
            return { ...ch, scenes }
          }),
        }
      })
      return { stories }
    })
    return scene
  }, [bookId, story?.chapters, store])

  const renameScene = useCallback(async (chapterId: string, sceneId: string, title: string) => {
    store.updateScene(bookId, chapterId, sceneId, { title })
    await BlocksApi.updateScene(sceneId, { title })
  }, [bookId, store])

  const removeScene = useCallback(async (chapterId: string, sceneId: string) => {
    store.deleteScene(bookId, chapterId, sceneId)
    await BlocksApi.deleteScene(sceneId)
  }, [bookId, store])

  // ── Block ops ──

  const addBlock = useCallback(async (
    chapterId: string,
    sceneId: string,
    tempBlock: StoryBlock      // caller provides a temp uuid id; we swap it for the DB id
  ): Promise<StoryBlock | null> => {
    const chapter = story?.chapters.find(c => c.id === chapterId)
    const scene = chapter?.scenes.find(s => s.id === sceneId)
    const sortOrder = scene?.blocks.length ?? 0

    store.addBlock(bookId, chapterId, sceneId, tempBlock)

    const dbBlock = await BlocksApi.createBlock(bookId, sceneId, tempBlock, sortOrder)
    if (!dbBlock) { setError('Failed to save block.'); return null }

    // Replace temp block with DB version (real id)
    useStudioStore.setState(state => {
      const stories = state.stories.map(s => {
        if (s.id !== bookId) return s
        return {
          ...s,
          chapters: s.chapters.map(ch => {
            if (ch.id !== chapterId) return ch
            return {
              ...ch,
              scenes: ch.scenes.map(sc => {
                if (sc.id !== sceneId) return sc
                return {
                  ...sc,
                  blocks: sc.blocks.map(b => b.id === tempBlock.id ? dbBlock : b),
                }
              }),
            }
          }),
        }
      })
      return { stories }
    })
    return dbBlock
  }, [bookId, story?.chapters, store])

  const editBlock = useCallback(async (
    chapterId: string,
    sceneId: string,
    blockId: string,
    updates: Partial<StoryBlock>
  ) => {
    store.updateBlock(bookId, chapterId, sceneId, blockId, updates)
    const previousSave = blockSaveQueues.current[blockId] ?? Promise.resolve()
    const nextSave = previousSave
      .catch(() => undefined)
      .then(async () => {
        const ok = await BlocksApi.updateBlock(blockId, updates)
        if (!ok) setError('Failed to save block.')
      })

    blockSaveQueues.current[blockId] = nextSave
    await nextSave
  }, [bookId, store])

  const removeBlock = useCallback(async (chapterId: string, sceneId: string, blockId: string) => {
    store.deleteBlock(bookId, chapterId, sceneId, blockId)
    await BlocksApi.deleteBlock(blockId)
  }, [bookId, store])

  const reorderBlocks = useCallback(async (
    chapterId: string,
    sceneId: string,
    blocks: StoryBlock[]
  ) => {
    store.reorderBlocks(bookId, chapterId, sceneId, blocks)
    await BlocksApi.reorderBlocks(blocks.map((b, i) => ({ id: b.id, sort_order: i })))
  }, [bookId, store])

  return {
    story,
    loading,
    contentReady,
    error,
    // Chapter
    addChapter,
    renameChapter,
    removeChapter,
    // Scene
    addScene,
    renameScene,
    removeScene,
    // Block
    addBlock,
    editBlock,
    removeBlock,
    reorderBlocks,
  }
}
