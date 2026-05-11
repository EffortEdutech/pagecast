import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'
import type { Story, Character, Chapter, Scene, StoryBlock, Creator } from '@/types'

// ─── Defaults ──────────────────────────────────────────────────────────────────

const MOCK_CREATOR: Creator = {
  id: 'creator-001',
  name: 'eff',
  email: 'myeffort.studio@gmail.com',
  ttsCreditsUsed: 14,
  ttsCreditsLimit: 60,
}

// ─── Store Interface ──────────────────────────────────────────────────────────

interface StudioStore {
  // Auth
  creator: Creator | null
  isAuthenticated: boolean
  login: (email: string, password: string) => boolean
  logout: () => void

  // Stories
  stories: Story[]
  activeStoryId: string | null
  activeChapterId: string | null
  activeSceneId: string | null
  dirtyStoryIds: string[]

  // Story CRUD
  createStory: (title: string, description: string) => Story
  updateStory: (id: string, updates: Partial<Story>) => void
  deleteStory: (id: string) => void
  setActiveStory: (id: string | null) => void
  markStoryDirty: (storyId: string) => void
  clearStoryDirty: (storyId: string) => void
  isStoryDirty: (storyId: string) => boolean

  // Chapter CRUD
  addChapter: (storyId: string, title: string) => Chapter
  updateChapter: (storyId: string, chapterId: string, updates: Partial<Chapter>) => void
  deleteChapter: (storyId: string, chapterId: string) => void
  setActiveChapter: (id: string | null) => void

  // Scene CRUD
  addScene: (storyId: string, chapterId: string, title: string) => Scene
  updateScene: (storyId: string, chapterId: string, sceneId: string, updates: Partial<Scene>) => void
  deleteScene: (storyId: string, chapterId: string, sceneId: string) => void
  setActiveScene: (id: string | null) => void

  // Block CRUD
  addBlock: (storyId: string, chapterId: string, sceneId: string, block: StoryBlock) => void
  updateBlock: (storyId: string, chapterId: string, sceneId: string, blockId: string, updates: Partial<StoryBlock>) => void
  deleteBlock: (storyId: string, chapterId: string, sceneId: string, blockId: string) => void
  reorderBlocks: (storyId: string, chapterId: string, sceneId: string, blocks: StoryBlock[]) => void

  // Characters
  addCharacter: (storyId: string, character: Omit<Character, 'id'>) => void
  updateCharacter: (storyId: string, characterId: string, updates: Partial<Character>) => void
  deleteCharacter: (storyId: string, characterId: string) => void

  // Helpers
  getActiveStory: () => Story | null
  getActiveChapter: () => Chapter | null
  getActiveScene: () => Scene | null
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStudioStore = create<StudioStore>()(
  persist(
    (set, get) => ({
      creator: null,
      isAuthenticated: false,
      stories: [],
      activeStoryId: null,
      activeChapterId: null,
      activeSceneId: null,
      dirtyStoryIds: [],

      // ── Auth ──
      login: (email, password) => {
        // Mock auth — any non-empty credentials work
        if (email && password) {
          set({ creator: MOCK_CREATOR, isAuthenticated: true })
          return true
        }
        return false
      },
      logout: () => set({ creator: null, isAuthenticated: false, activeStoryId: null }),

      // ── Stories ──
      createStory: (title, description) => {
        const story: Story = {
          id: uuid(),
          title, description,
          language: 'en',
          status: 'draft',
          price: 4.99,
          hasMusic: false,
          hasSfx: false,
          characters: [
            { id: uuid(), name: 'Narrator', role: 'narrator', displayName: 'Narrator', color: '#9896A8', voiceSource: 'ai', voiceId: 'ai_narrator_warm', voiceLabel: 'Marin - Warm Premium Narrator', defaultVolume: 1 },
          ],
          chapters: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set(s => ({ stories: [story, ...s.stories] }))
        return story
      },
      updateStory: (id, updates) => set(s => ({
        stories: s.stories.map(st => st.id === id ? { ...st, ...updates, updatedAt: new Date().toISOString() } : st)
      })),
      deleteStory: (id) => set(s => ({ stories: s.stories.filter(st => st.id !== id) })),
      setActiveStory: (id) => set({ activeStoryId: id, activeChapterId: null, activeSceneId: null }),
      markStoryDirty: (storyId) => set(s => ({
        dirtyStoryIds: s.dirtyStoryIds.includes(storyId) ? s.dirtyStoryIds : [...s.dirtyStoryIds, storyId],
      })),
      clearStoryDirty: (storyId) => set(s => ({
        dirtyStoryIds: s.dirtyStoryIds.filter(id => id !== storyId),
      })),
      isStoryDirty: (storyId) => get().dirtyStoryIds.includes(storyId),

      // ── Chapters ──
      addChapter: (storyId, title) => {
        const story = get().stories.find(s => s.id === storyId)
        const chapter: Chapter = {
          id: uuid(), title,
          order: (story?.chapters.length ?? 0) + 1,
          scenes: [],
        }
        set(s => ({
          stories: s.stories.map(st => st.id === storyId
            ? { ...st, chapters: [...st.chapters, chapter], updatedAt: new Date().toISOString() }
            : st)
        }))
        return chapter
      },
      updateChapter: (storyId, chapterId, updates) => set(s => ({
        stories: s.stories.map(st => st.id === storyId ? {
          ...st,
          chapters: st.chapters.map(ch => ch.id === chapterId ? { ...ch, ...updates } : ch)
        } : st)
      })),
      deleteChapter: (storyId, chapterId) => set(s => ({
        stories: s.stories.map(st => st.id === storyId ? {
          ...st, chapters: st.chapters.filter(ch => ch.id !== chapterId)
        } : st)
      })),
      setActiveChapter: (id) => set({ activeChapterId: id }),

      // ── Scenes ──
      addScene: (storyId, chapterId, title) => {
        const scene: Scene = { id: uuid(), title, blocks: [] }
        set(s => ({
          stories: s.stories.map(st => st.id === storyId ? {
            ...st,
            chapters: st.chapters.map(ch => ch.id === chapterId
              ? { ...ch, scenes: [...ch.scenes, scene] }
              : ch)
          } : st)
        }))
        return scene
      },
      updateScene: (storyId, chapterId, sceneId, updates) => set(s => ({
        stories: s.stories.map(st => st.id === storyId ? {
          ...st,
          chapters: st.chapters.map(ch => ch.id === chapterId ? {
            ...ch,
            scenes: ch.scenes.map(sc => sc.id === sceneId ? { ...sc, ...updates } : sc)
          } : ch)
        } : st)
      })),
      deleteScene: (storyId, chapterId, sceneId) => set(s => ({
        stories: s.stories.map(st => st.id === storyId ? {
          ...st,
          chapters: st.chapters.map(ch => ch.id === chapterId ? {
            ...ch, scenes: ch.scenes.filter(sc => sc.id !== sceneId)
          } : ch)
        } : st)
      })),
      setActiveScene: (id) => set({ activeSceneId: id }),

      // ── Blocks ──
      addBlock: (storyId, chapterId, sceneId, block) => set(s => ({
        stories: s.stories.map(st => st.id === storyId ? {
          ...st,
          chapters: st.chapters.map(ch => ch.id === chapterId ? {
            ...ch,
            scenes: ch.scenes.map(sc => sc.id === sceneId
              ? { ...sc, blocks: [...sc.blocks, block] }
              : sc)
          } : ch)
        } : st)
      })),
      updateBlock: (storyId, chapterId, sceneId, blockId, updates) => set(s => ({
        stories: s.stories.map(st => st.id === storyId ? {
          ...st,
          chapters: st.chapters.map(ch => ch.id === chapterId ? {
            ...ch,
            scenes: ch.scenes.map(sc => sc.id === sceneId ? {
              ...sc,
              blocks: sc.blocks.map(bl => bl.id === blockId ? { ...bl, ...updates } as StoryBlock : bl)
            } : sc)
          } : ch)
        } : st)
      })),
      deleteBlock: (storyId, chapterId, sceneId, blockId) => set(s => ({
        stories: s.stories.map(st => st.id === storyId ? {
          ...st,
          chapters: st.chapters.map(ch => ch.id === chapterId ? {
            ...ch,
            scenes: ch.scenes.map(sc => sc.id === sceneId ? {
              ...sc, blocks: sc.blocks.filter(bl => bl.id !== blockId)
            } : sc)
          } : ch)
        } : st)
      })),
      reorderBlocks: (storyId, chapterId, sceneId, blocks) => set(s => ({
        stories: s.stories.map(st => st.id === storyId ? {
          ...st,
          chapters: st.chapters.map(ch => ch.id === chapterId ? {
            ...ch,
            scenes: ch.scenes.map(sc => sc.id === sceneId ? { ...sc, blocks } : sc)
          } : ch)
        } : st)
      })),

      // ── Characters ──
      addCharacter: (storyId, char) => {
        const character: Character = { ...char, id: uuid() }
        set(s => ({
          stories: s.stories.map(st => st.id === storyId
            ? { ...st, characters: [...st.characters, character] }
            : st)
        }))
      },
      updateCharacter: (storyId, characterId, updates) => set(s => ({
        stories: s.stories.map(st => st.id === storyId ? {
          ...st,
          characters: st.characters.map(ch => ch.id === characterId ? { ...ch, ...updates } : ch)
        } : st)
      })),
      deleteCharacter: (storyId, characterId) => set(s => ({
        stories: s.stories.map(st => st.id === storyId ? {
          ...st, characters: st.characters.filter(ch => ch.id !== characterId)
        } : st)
      })),

      // ── Helpers ──
      getActiveStory: () => get().stories.find(s => s.id === get().activeStoryId) ?? null,
      getActiveChapter: () => {
        const story = get().getActiveStory()
        return story?.chapters.find(ch => ch.id === get().activeChapterId) ?? null
      },
      getActiveScene: () => {
        const chapter = get().getActiveChapter()
        return chapter?.scenes.find(sc => sc.id === get().activeSceneId) ?? null
      },
    }),
    { name: 'pagecast-studio' }
  )
)
