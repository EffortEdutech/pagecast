import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ReaderPrefs, ReadingProgress, ReaderMode, ReaderTheme } from '@/types'

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
