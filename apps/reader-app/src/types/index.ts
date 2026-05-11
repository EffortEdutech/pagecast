export type BlockType = 'narration' | 'dialogue' | 'thought' | 'quote' | 'pause' | 'sfx'
export type ReaderMode = 'reading' | 'audiobook' | 'cinematic'
export type ReaderTheme = 'dark' | 'light' | 'sepia'

export interface Character {
  id: string
  name: string
  role: 'narrator' | 'character'
  displayName: string
  color: string
  voiceId?: string
  defaultVolume: number
}

export interface BaseBlock { id: string; type: BlockType; audioUrl?: string; duration?: number }
export interface NarrationBlock extends BaseBlock { type: 'narration'; text: string; characterId?: string }
export interface DialogueBlock  extends BaseBlock { type: 'dialogue'; characterId: string; text: string; emotion?: string }
export interface ThoughtBlock   extends BaseBlock { type: 'thought';  characterId: string; text: string }
export interface QuoteBlock     extends BaseBlock { type: 'quote';    text: string; attribution?: string; style?: 'poem'|'letter'|'quran'|'default'; characterId?: string }
export interface PauseBlock     extends BaseBlock { type: 'pause';    duration: number }
export interface SfxBlock       extends BaseBlock { type: 'sfx';      sfxFile: string; label?: string }
export type StoryBlock = NarrationBlock | DialogueBlock | ThoughtBlock | QuoteBlock | PauseBlock | SfxBlock

export interface Scene {
  id: string; title: string
  ambienceFile?: string; musicFile?: string; sceneImage?: string
  ambienceUrl?: string; musicUrl?: string
  ambienceVolume?: number; musicVolume?: number
  ambienceLoop?: boolean   // default true
  musicLoop?: boolean      // default true
  blocks: StoryBlock[]
}
export interface Chapter { id: string; title: string; order: number; scenes: Scene[] }

export interface Story {
  id: string; title: string; description: string
  coverGradient?: string; language: string
  price: number; hasMusic: boolean; hasSfx: boolean
  characters: Character[]; chapters: Chapter[]
  createdAt: string; durationMinutes?: number
  genre?: string; ageRating?: string
  narratorOnlyMode?: boolean
  narratorVoiceId?: string
}

export interface ReaderPrefs {
  mode: ReaderMode; theme: ReaderTheme
  narratorVolume: number; characterVolume: number
  musicVolume: number; sfxVolume: number
  playbackSpeed: number; fontSize: 'sm'|'base'|'lg'|'xl'
  autoScroll: boolean; autoAdvance: boolean; childMode: boolean; dyslexiaFont: boolean
}

export interface ReadingProgress {
  storyId: string
  chapterIdx: number; sceneIdx: number; blockIdx: number
  timestamp: number
  lastReadAt?: string   // ISO date string, optional for backwards compat
  completedAt?: string | null
}

export interface ReaderBookmark {
  id: string
  storyId: string
  chapterIdx: number
  sceneIdx: number
  blockIdx: number
  label: string
  note?: string
  createdAt: string
}
