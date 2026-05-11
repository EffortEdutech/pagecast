import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ReaderBookmark, ReaderPrefs, ReadingProgress, ReaderMode, ReaderTheme } from '@/types'

const DEFAULT_PREFS: ReaderPrefs = {
  mode: 'audiobook',
  theme: 'dark',
  narratorVolume: 1,
  characterVolume: 1,
  musicVolume: 0.4,
  sfxVolume: 0.6,
  playbackSpeed: 1,
  fontSize: 'base',
  autoScroll: true,
  autoAdvance: true,
  childMode: false,
  dyslexiaFont: false,
}

interface ReaderStore {
  // Library (mock purchases)
  library: string[]
  addToLibrary: (storyId: string) => void
  isOwned: (storyId: string) => boolean

  // Preferences
  prefs: ReaderPrefs
  setMode: (mode: ReaderMode) => void
  setTheme: (theme: ReaderTheme) => void
  setPref: <K extends keyof ReaderPrefs>(key: K, value: ReaderPrefs[K]) => void

  // Reading progress
  progress: Record<string, ReadingProgress>
  saveProgress: (p: ReadingProgress) => void
  getProgress: (storyId: string) => ReadingProgress | null

  // Bookmarks
  bookmarks: Record<string, ReaderBookmark[]>
  addBookmark: (bookmark: Omit<ReaderBookmark, 'id' | 'createdAt'>) => ReaderBookmark
  removeBookmark: (storyId: string, bookmarkId: string) => void
  getBookmarks: (storyId: string) => ReaderBookmark[]
  isBookmarked: (storyId: string, chapterIdx: number, sceneIdx: number, blockIdx: number) => boolean

  // Active playback
  activeStoryId: string | null
  isPlaying: boolean
  currentBlockId: string | null
  setActiveStory: (id: string | null) => void
  setPlaying: (v: boolean) => void
  setCurrentBlock: (id: string | null) => void
}

export const useReaderStore = create<ReaderStore>()(
  persist(
    (set, get) => ({
      library: [],
      addToLibrary: (id) => set(s => ({ library: [...new Set([...s.library, id])] })),
      isOwned: (id) => get().library.includes(id),

      prefs: DEFAULT_PREFS,
      setMode:  (mode)        => set(s => ({ prefs: { ...s.prefs, mode } })),
      setTheme: (theme)       => set(s => ({ prefs: { ...s.prefs, theme } })),
      setPref:  (key, value)  => set(s => ({ prefs: { ...s.prefs, [key]: value } })),

      progress: {},
      saveProgress: (p) => set(s => ({ progress: { ...s.progress, [p.storyId]: p } })),
      getProgress: (id) => get().progress[id] ?? null,

      bookmarks: {},
      addBookmark: (bookmark) => {
        const saved: ReaderBookmark = {
          ...bookmark,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        }
        set(s => ({
          bookmarks: {
            ...s.bookmarks,
            [bookmark.storyId]: [...(s.bookmarks[bookmark.storyId] ?? []), saved],
          },
        }))
        return saved
      },
      removeBookmark: (storyId, bookmarkId) => set(s => ({
        bookmarks: {
          ...s.bookmarks,
          [storyId]: (s.bookmarks[storyId] ?? []).filter(b => b.id !== bookmarkId),
        },
      })),
      getBookmarks: (storyId) => get().bookmarks[storyId] ?? [],
      isBookmarked: (storyId, chapterIdx, sceneIdx, blockIdx) =>
        (get().bookmarks[storyId] ?? []).some(b =>
          b.chapterIdx === chapterIdx && b.sceneIdx === sceneIdx && b.blockIdx === blockIdx
        ),

      activeStoryId: null,
      isPlaying: false,
      currentBlockId: null,
      setActiveStory:  (id) => set({ activeStoryId: id, isPlaying: false, currentBlockId: null }),
      setPlaying:      (v)  => set({ isPlaying: v }),
      setCurrentBlock: (id) => set({ currentBlockId: id }),
    }),
    { name: 'pagecast-reader' }
  )
)
