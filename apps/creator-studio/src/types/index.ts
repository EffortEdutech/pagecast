// ─── PageCast Shared Types ────────────────────────────────────────────────────

export type BlockType = 'narration' | 'dialogue' | 'thought' | 'quote' | 'pause' | 'sfx'

export type VoiceSource = 'ai' | 'upload' | 'none'

export type ReaderMode = 'reading' | 'audiobook' | 'cinematic'

export type StoryStatus = 'draft' | 'published' | 'archived'

// ─── Character ────────────────────────────────────────────────────────────────

export interface Character {
  id: string
  name: string
  role: 'narrator' | 'character'
  displayName: string
  color: string
  voiceSource: VoiceSource
  voiceId?: string
  voiceLabel?: string
  defaultVolume: number
}

// ─── Story Blocks ─────────────────────────────────────────────────────────────

export interface BaseBlock {
  id: string
  type: BlockType
  audioFile?: string
  audioUrl?: string
  duration?: number
}

export interface NarrationBlock extends BaseBlock {
  type: 'narration'
  text: string
}

export interface DialogueBlock extends BaseBlock {
  type: 'dialogue'
  characterId: string
  text: string
  emotion?: string
}

export interface ThoughtBlock extends BaseBlock {
  type: 'thought'
  characterId: string
  text: string
}

export interface QuoteBlock extends BaseBlock {
  type: 'quote'
  text: string
  attribution?: string
  style?: 'poem' | 'letter' | 'quran' | 'default'
}

export interface PauseBlock extends BaseBlock {
  type: 'pause'
  duration: number // seconds
}

export interface SfxBlock extends BaseBlock {
  type: 'sfx'
  sfxFile: string
  label?: string
}

export type StoryBlock =
  | NarrationBlock
  | DialogueBlock
  | ThoughtBlock
  | QuoteBlock
  | PauseBlock
  | SfxBlock

// ─── Scene ────────────────────────────────────────────────────────────────────

export interface Scene {
  id: string
  title: string
  ambienceFile?: string
  musicFile?: string
  sceneImage?: string
  blocks: StoryBlock[]
}

// ─── Chapter ─────────────────────────────────────────────────────────────────

export interface Chapter {
  id: string
  title: string
  order: number
  scenes: Scene[]
}

// ─── Story (Book) ─────────────────────────────────────────────────────────────

export interface Story {
  id: string
  title: string
  description: string
  coverImage?: string
  language: string
  status: StoryStatus
  price: number
  hasMusic: boolean
  hasSfx: boolean
  characters: Character[]
  chapters: Chapter[]
  createdAt: string
  updatedAt: string
  durationMinutes?: number
}

// ─── Voice Profile ────────────────────────────────────────────────────────────

export interface VoiceProfile {
  id: string
  label: string
  category: 'male' | 'female' | 'child' | 'elder' | 'fantasy' | 'cartoon' | 'villain' | 'robot' | 'whisper' | 'dramatic'
  gender: 'male' | 'female' | 'neutral'
  preview?: string
}

// ─── Asset ────────────────────────────────────────────────────────────────────

export interface Asset {
  id: string
  storyId: string
  type: 'audio' | 'music' | 'sfx' | 'image'
  name: string
  url: string
  size: number
  createdAt: string
}

// ─── Creator (Author) ─────────────────────────────────────────────────────────

export interface Creator {
  id: string
  name: string
  email: string
  avatar?: string
  ttsCreditsUsed: number
  ttsCreditsLimit: number
}
