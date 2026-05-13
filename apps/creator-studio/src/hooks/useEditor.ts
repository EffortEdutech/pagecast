'use client'
import { useCallback, useEffect, useState } from 'react'
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
  const [saving, setSaving] = useState(false)
  const isDirty = store.isStoryDirty(bookId)

  useEffect(() => {
    setContentReady(false)
  }, [bookId])

  // ── Load content from Supabase once per bookId, but only after the story
  //    exists in studioStore (so the setState map actually finds it).        ──
  useEffect(() => {
    if (!bookId) return
    if (!storyInStore) return   // wait — useBooks hasn't populated the store yet
    let cancelled = false

    async function load() {
      setLoading(true)
      setContentReady(false)
      try {
        if (useStudioStore.getState().isStoryDirty(bookId)) {
          setContentReady(true)
          return
        }
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

  const addChapter = useCallback(async (title: string, insertIndex?: number): Promise<Chapter | null> => {
    const currentStory = useStudioStore.getState().stories.find(s => s.id === bookId)
    const currentChapters = currentStory?.chapters ?? []
    const targetIndex = Math.max(0, Math.min(insertIndex ?? currentChapters.length, currentChapters.length))
    const chapter: Chapter = { id: crypto.randomUUID(), title, order: targetIndex + 1, scenes: [] }

    useStudioStore.setState(state => {
      const stories = state.stories.map(s => {
        if (s.id !== bookId) return s
        const chapters = [...s.chapters]
        chapters.splice(targetIndex, 0, chapter)
        return { ...s, chapters: chapters.map((ch, i) => ({ ...ch, order: i + 1 })) }
      })
      return { stories }
    })
    store.markStoryDirty(bookId)
    return chapter
  }, [bookId, store])

  const renameChapter = useCallback(async (chapterId: string, title: string) => {
    store.updateChapter(bookId, chapterId, { title })
    store.markStoryDirty(bookId)
  }, [bookId, store])

  const removeChapter = useCallback(async (chapterId: string) => {
    store.deleteChapter(bookId, chapterId)
    store.markStoryDirty(bookId)
  }, [bookId, store])

  const reorderChapters = useCallback(async (chapters: Chapter[]) => {
    store.reorderChapters(bookId, chapters)
    store.markStoryDirty(bookId)
  }, [bookId, store])

  // ── Scene ops ──

  const addScene = useCallback(async (chapterId: string, title: string): Promise<Scene | null> => {
    const currentStory = useStudioStore.getState().stories.find(s => s.id === bookId)
    const chapter = currentStory?.chapters.find(c => c.id === chapterId)
    const sortOrder = chapter?.scenes.length ?? 0
    const scene: Scene = { id: crypto.randomUUID(), title, blocks: [] }
    store.addScene(bookId, chapterId, title)
    useStudioStore.setState(state => ({
      stories: state.stories.map(s => s.id === bookId ? {
        ...s,
        chapters: s.chapters.map(ch => ch.id === chapterId ? {
          ...ch,
          scenes: ch.scenes.map((sc, index) => index === sortOrder ? scene : sc),
        } : ch),
      } : s),
    }))
    store.markStoryDirty(bookId)
    return scene
  }, [bookId, store])

  const renameScene = useCallback(async (chapterId: string, sceneId: string, title: string) => {
    store.updateScene(bookId, chapterId, sceneId, { title })
    store.markStoryDirty(bookId)
  }, [bookId, store])

  const removeScene = useCallback(async (chapterId: string, sceneId: string) => {
    store.deleteScene(bookId, chapterId, sceneId)
    store.markStoryDirty(bookId)
  }, [bookId, store])

  const reorderScenes = useCallback(async (chapterId: string, scenes: Scene[]) => {
    store.reorderScenes(bookId, chapterId, scenes)
    store.markStoryDirty(bookId)
  }, [bookId, store])

  // ── Block ops ──

  const addBlock = useCallback(async (
    chapterId: string,
    sceneId: string,
    tempBlock: StoryBlock,
    insertIndex?: number
  ): Promise<StoryBlock | null> => {
    const currentStory = useStudioStore.getState().stories.find(s => s.id === bookId)
    const chapter = currentStory?.chapters.find(c => c.id === chapterId)
    const scene = chapter?.scenes.find(s => s.id === sceneId)
    const currentBlocks = scene?.blocks ?? []
    const targetIndex = Math.max(0, Math.min(insertIndex ?? currentBlocks.length, currentBlocks.length))

    const optimisticBlocks = [...currentBlocks]
    optimisticBlocks.splice(targetIndex, 0, tempBlock)
    store.reorderBlocks(bookId, chapterId, sceneId, optimisticBlocks)
    store.markStoryDirty(bookId)
    return tempBlock
  }, [bookId, story?.chapters, store])

  const insertBlocks = useCallback(async (
    chapterId: string,
    sceneId: string,
    blocks: StoryBlock[],
    insertIndex: number
  ): Promise<void> => {
    store.insertBlocks(bookId, chapterId, sceneId, blocks, insertIndex)
    store.markStoryDirty(bookId)
  }, [bookId, store])

  const editBlock = useCallback(async (
    chapterId: string,
    sceneId: string,
    blockId: string,
    updates: Partial<StoryBlock>
  ) => {
    store.updateBlock(bookId, chapterId, sceneId, blockId, updates)
    store.markStoryDirty(bookId)
  }, [bookId, store])

  const removeBlock = useCallback(async (chapterId: string, sceneId: string, blockId: string) => {
    store.deleteBlock(bookId, chapterId, sceneId, blockId)
    store.markStoryDirty(bookId)
  }, [bookId, store])

  const reorderBlocks = useCallback(async (
    chapterId: string,
    sceneId: string,
    blocks: StoryBlock[]
  ) => {
    store.reorderBlocks(bookId, chapterId, sceneId, blocks)
    store.markStoryDirty(bookId)
  }, [bookId, store])

  const saveContent = useCallback(async (): Promise<boolean> => {
    const currentStory = useStudioStore.getState().stories.find(s => s.id === bookId)
    if (!currentStory) return false
    setSaving(true)
    setError(null)
    const ok = await BlocksApi.replaceBookContent(bookId, currentStory)
    if (ok) store.clearStoryDirty(bookId)
    else setError('Failed to save story content.')
    setSaving(false)
    return ok
  }, [bookId, store])

  return {
    story,
    loading,
    contentReady,
    saving,
    isDirty,
    error,
    saveContent,
    // Chapter
    addChapter,
    renameChapter,
    removeChapter,
    reorderChapters,
    // Scene
    addScene,
    renameScene,
    removeScene,
    reorderScenes,
    // Block
    addBlock,
    insertBlocks,
    editBlock,
    removeBlock,
    reorderBlocks,
  }
}
