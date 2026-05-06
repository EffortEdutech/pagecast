/**
 * Supabase data layer -- Chapters, Scenes, Blocks
 * Sprint 3: full story content CRUD
 */
import { createClient } from './client'
import type { Chapter, Scene, StoryBlock, BlockType, DialogueBlock, QuoteBlock } from '@/types'

// Types

export interface DbChapter {
  id: string
  book_id: string
  title: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface DbScene {
  id: string
  chapter_id: string
  book_id: string
  title: string
  sort_order: number
  ambience_url:    string | null
  music_url:       string | null
  ambience_volume: number | null
  music_volume:    number | null
  ambience_loop:   boolean | null
  music_loop:      boolean | null
  scene_image:     string | null
  created_at: string
  updated_at: string
}

export interface DbBlock {
  id: string
  scene_id: string
  book_id: string
  type: string
  content: Record<string, unknown>
  audio_url: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

// Converters

function dbBlockToStoryBlock(b: DbBlock): StoryBlock {
  const c = b.content
  const audioUrl = b.audio_url ?? undefined
  const base = { id: b.id, type: b.type as BlockType, audioUrl }
  switch (b.type) {
    case 'narration':
      return { ...base, type: 'narration', text: String(c.text ?? '') }
    case 'dialogue':
      return { ...base, type: 'dialogue', characterId: String(c.character_id ?? ''), text: String(c.text ?? ''), emotion: c.emotion as string | undefined }
    case 'thought':
      return { ...base, type: 'thought', characterId: String(c.character_id ?? ''), text: String(c.text ?? '') }
    case 'quote':
      return { ...base, type: 'quote', text: String(c.text ?? ''), attribution: c.attribution as string | undefined, style: c.style as QuoteBlock['style'] }
    case 'pause':
      return { ...base, type: 'pause', duration: Number(c.duration_ms ?? 2000) / 1000 }
    case 'sfx':
      return { ...base, type: 'sfx', label: String(c.label ?? ''), sfxFile: String(c.sfx_file ?? '') }
    default:
      return { ...base, type: 'narration', text: '' }
  }
}

function storyBlockToDbContent(block: StoryBlock): Record<string, unknown> {
  switch (block.type) {
    case 'narration':
      return { text: block.text }
    case 'dialogue':
    case 'thought':
      return { character_id: block.characterId, text: block.text, emotion: (block as DialogueBlock).emotion }
    case 'quote':
      return { text: block.text, attribution: block.attribution, style: block.style }
    case 'pause':
      return { duration_ms: block.duration * 1000 }
    case 'sfx':
      return { label: block.label, sfx_file: block.sfxFile }
    default:
      return {}
  }
}

function dbSceneToScene(scene: DbScene, blocks: DbBlock[]): Scene {
  return {
    id:            scene.id,
    title:         scene.title,
    ambienceUrl:   scene.ambience_url   ?? undefined,
    musicUrl:      scene.music_url      ?? undefined,
    ambienceVolume: scene.ambience_volume ?? undefined,
    musicVolume:   scene.music_volume   ?? undefined,
    ambienceLoop:  scene.ambience_loop  ?? undefined,
    musicLoop:     scene.music_loop     ?? undefined,
    sceneImage:    scene.scene_image    ?? undefined,
    blocks: blocks
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(dbBlockToStoryBlock),
  }
}

function dbChapterToChapter(chapter: DbChapter, scenes: DbScene[], blocks: DbBlock[]): Chapter {
  return {
    id: chapter.id,
    title: chapter.title,
    order: chapter.sort_order,
    scenes: scenes
      .filter(s => s.chapter_id === chapter.id)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(s => dbSceneToScene(s, blocks.filter(b => b.scene_id === s.id))),
  }
}

// Book Content API

export async function fetchBookContent(bookId: string): Promise<Chapter[]> {
  const supabase = createClient()
  const [{ data: chapters }, { data: scenes }, { data: blocks }] = await Promise.all([
    supabase.from('chapters').select('*').eq('book_id', bookId).order('sort_order'),
    supabase.from('scenes').select('*').eq('book_id', bookId).order('sort_order'),
    supabase.from('blocks').select('*').eq('book_id', bookId).order('sort_order'),
  ])
  if (!chapters) return []
  return chapters.map(ch => dbChapterToChapter(ch, scenes ?? [], blocks ?? []))
}

// Chapters

export async function createChapter(bookId: string, title: string, sortOrder: number): Promise<Chapter | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('chapters')
    .insert({ book_id: bookId, title, sort_order: sortOrder })
    .select().single()
  if (error || !data) return null
  return dbChapterToChapter(data, [], [])
}

export async function updateChapter(chapterId: string, updates: { title?: string; sort_order?: number }): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('chapters').update(updates).eq('id', chapterId)
  return !error
}

export async function deleteChapter(chapterId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('chapters').delete().eq('id', chapterId)
  return !error
}

// Scenes

export async function createScene(bookId: string, chapterId: string, title: string, sortOrder: number): Promise<Scene | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('scenes')
    .insert({ book_id: bookId, chapter_id: chapterId, title, sort_order: sortOrder })
    .select().single()
  if (error || !data) return null
  return dbSceneToScene(data, [])
}

export async function updateScene(sceneId: string, updates: { title?: string; sort_order?: number }): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('scenes').update(updates).eq('id', sceneId)
  return !error
}

export async function deleteScene(sceneId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('scenes').delete().eq('id', sceneId)
  return !error
}

// Blocks

export async function createBlock(bookId: string, sceneId: string, block: StoryBlock, sortOrder: number): Promise<StoryBlock | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('blocks')
    .insert({
      book_id:    bookId,
      scene_id:   sceneId,
      type:       block.type,
      content:    storyBlockToDbContent(block),
      audio_url:  block.audioUrl ?? null,
      sort_order: sortOrder,
    })
    .select().single()
  if (error || !data) return null
  return dbBlockToStoryBlock(data)
}

export async function updateBlock(blockId: string, block: Partial<StoryBlock>): Promise<boolean> {
  const supabase = createClient()
  const updates: Record<string, unknown> = {}
  if (block.type !== undefined) updates.type = block.type
  if (block !== undefined) updates.content = storyBlockToDbContent(block as StoryBlock)
  // Persist audio URL if provided (even if undefined — null clears it)
  if ('audioUrl' in block) updates.audio_url = (block as StoryBlock).audioUrl ?? null
  const { error } = await supabase.from('blocks').update(updates).eq('id', blockId)
  return !error
}

export async function deleteBlock(blockId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('blocks').delete().eq('id', blockId)
  return !error
}

export async function reorderBlocks(blocks: { id: string; sort_order: number }[]): Promise<boolean> {
  const supabase = createClient()
  // Supabase doesn't support bulk update natively -- run as sequential updates
  const results = await Promise.all(
    blocks.map(({ id, sort_order }) =>
      supabase.from('blocks').update({ sort_order }).eq('id', id)
    )
  )
  return results.every(r => !r.error)
}
