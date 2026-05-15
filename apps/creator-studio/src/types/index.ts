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
  voiceSpeed?: number
  performanceTag?: string
}

export interface NarrationBlock extends BaseBlock {
  type: 'narration'
  text: string
  characterId?: string   // which character reads this — defaults to narrator
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
  characterId?: string   // voice used to read this quote
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
  // Legacy filename fields (kept for backwards compat)
  ambienceFile?: string
  musicFile?: string
  // Real Supabase Storage URLs
  ambienceUrl?: string
  musicUrl?: string
  ambienceVolume?: number   // 0–1, default 0.4
  musicVolume?: number      // 0–1, default 0.3
  ambienceLoop?: boolean    // default true
  musicLoop?: boolean       // default true
  sceneImage?: string       // URL of background image
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
  isFree?: boolean
  hasMusic: boolean
  hasSfx: boolean
  characters: Character[]
  chapters: Chapter[]
  createdAt: string
  updatedAt: string
  durationMinutes?: number
  narratorOnlyMode?: boolean
  narratorVoiceId?: string
  coverGradient?: string
  genre?: string
  ageRating?: string
}

// ─── Voice Profile ────────────────────────────────────────────────────────────

export interface VoiceProfile {
  id: string
  label: string
  category: 'male' | 'female' | 'child' | 'elder' | 'fantasy' | 'cartoon' | 'villain' | 'robot' | 'whisper' | 'dramatic' | 'narrator'
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

// ─── Creator (Author) ────────────────────────────
export interface Creator {
  id: string
  email: string
  displayName?: string
  name?: string
  avatarUrl?: string
  bio?: string
  createdAt?: string
  ttsCreditsUsed?: number
  ttsCreditsLimit?: number
}
