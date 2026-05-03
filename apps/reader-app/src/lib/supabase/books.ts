/**
 * Reader-app Supabase data layer — published books
 * Fetches published books + full story content for the reader engine
 */
import { createClient } from './client'
import type { Story, Character, Chapter, Scene, StoryBlock, BlockType } from '@/types'

// ─── Cover gradient palette (cycles by book index) ───────────────────────────

const COVER_GRADIENTS = [
  'from-emerald-900 via-teal-900 to-bg-primary',
  'from-purple-900 via-violet-900 to-bg-primary',
  'from-blue-900 via-cyan-900 to-bg-primary',
  'from-rose-900 via-pink-900 to-bg-primary',
  'from-amber-900 via-orange-900 to-bg-primary',
  'from-indigo-900 via-blue-900 to-bg-primary',
]

function pickGradient(id: string): string {
  const idx = id.charCodeAt(id.length - 1) % COVER_GRADIENTS.length
  return COVER_GRADIENTS[idx]
}

// ─── Block converter (mirrors creator-studio blocks.ts) ──────────────────────

function dbContentToBlock(id: string, type: string, content: Record<string, unknown>): StoryBlock {
  const base = { id, type: type as BlockType }
  switch (type) {
    case 'narration':
      return { ...base, type: 'narration', text: String(content.text ?? '') }
    case 'dialogue':
      return { ...base, type: 'dialogue', characterId: String(content.character_id ?? ''), text: String(content.text ?? ''), emotion: content.emotion as string | undefined }
    case 'thought':
      return { ...base, type: 'thought', characterId: String(content.character_id ?? ''), text: String(content.text ?? '') }
    case 'quote':
      return { ...base, type: 'quote', text: String(content.text ?? ''), attribution: content.attribution as string | undefined, style: content.style as QuoteBlock['style'] }
    case 'pause':
      return { ...base, type: 'pause', duration: Number(content.duration_ms ?? 2000) / 1000 }
    case 'sfx':
      return { ...base, type: 'sfx', label: String(content.label ?? ''), sfxFile: String(content.sfx_file ?? '') }
    default:
      return { ...base, type: 'narration', text: '' }
  }
}

// ─── Type helpers ─────────────────────────────────────────────────────────────

// QuoteBlock needed for style type
type QuoteBlock = Extract<StoryBlock, { type: 'quote' }>

// ─── DB row types ─────────────────────────────────────────────────────────────

interface DbBook {
  id: string; author_id: string; title: string; description: string | null
  cover_gradient: string; cover_emoji: string; genre: string | null
  age_rating: string; status: string; price: number; is_free: boolean
  estimated_time: string | null; created_at: string
}
interface DbCharacter {
  id: string; book_id: string; name: string; role: string | null
  color: string; voice_label: string | null; sort_order: number
}
interface DbChapter  { id: string; book_id: string; title: string; sort_order: number }
interface DbScene    { id: string; chapter_id: string; book_id: string; title: string; sort_order: number; ambience_file?: string | null; music_file?: string | null }
interface DbBlock    { id: string; scene_id: string; type: string; content: Record<string, unknown>; sort_order: number }

// ─── Converters ───────────────────────────────────────────────────────────────

function dbCharToCharacter(c: DbCharacter): Character {
  return {
    id: c.id,
    name: c.name,
    role: (c.role ?? 'character') as 'narrator' | 'character',
    displayName: c.name,
    color: c.color,
    defaultVolume: 1,
  }
}

function dbToStory(book: DbBook, chars: DbCharacter[], chapters: Chapter[] = []): Story {
  return {
    id: book.id,
    title: book.title,
    description: book.description ?? '',
    coverGradient: book.cover_gradient || pickGradient(book.id),
    language: 'en',
    price: book.price,
    hasMusic: false,
    hasSfx: false,
    genre: book.genre ?? undefined,
    ageRating: book.age_rating ?? undefined,
    durationMinutes: book.estimated_time ? parseInt(book.estimated_time) : undefined,
    characters: chars.map(dbCharToCharacter),
    chapters,
    createdAt: book.created_at,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Fetch all published books (metadata + characters, no blocks — for store listing) */
export async function fetchPublishedBooks(): Promise<Story[]> {
  const supabase = createClient()

  const { data: books, error } = await supabase
    .from('books')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  if (error || !books?.length) return []

  const bookIds = books.map((b: DbBook) => b.id)
  const { data: allChars } = await supabase
    .from('characters')
    .select('*')
    .in('book_id', bookIds)
    .order('sort_order')

  const charsByBook = ((allChars ?? []) as DbCharacter[]).reduce<Record<string, DbCharacter[]>>((acc, c) => {
    acc[c.book_id] = acc[c.book_id] ?? []
    acc[c.book_id].push(c)
    return acc
  }, {})

  return (books as DbBook[]).map(b => dbToStory(b, charsByBook[b.id] ?? []))
}

/** Fetch a single book with full chapters + scenes + blocks (for reader engine) */
export async function fetchBook(bookId: string): Promise<Story | null> {
  const supabase = createClient()

  const [
    { data: book },
    { data: chars },
    { data: dbChapters },
    { data: dbScenes },
    { data: dbBlocks },
  ] = await Promise.all([
    supabase.from('books').select('*').eq('id', bookId).single(),
    supabase.from('characters').select('*').eq('book_id', bookId).order('sort_order'),
    supabase.from('chapters').select('*').eq('book_id', bookId).order('sort_order'),
    supabase.from('scenes').select('*').eq('book_id', bookId).order('sort_order'),
    supabase.from('blocks').select('*').eq('book_id', bookId).order('sort_order'),
  ])

  if (!book) return null

  const chapters: Chapter[] = ((dbChapters ?? []) as DbChapter[]).map((ch, idx) => {
    const scenes: Scene[] = ((dbScenes ?? []) as DbScene[])
      .filter(s => s.chapter_id === ch.id)
      .map(sc => ({
        id: sc.id,
        title: sc.title,
        ambienceFile: sc.ambience_file ?? undefined,
        musicFile: sc.music_file ?? undefined,
        blocks: ((dbBlocks ?? []) as DbBlock[])
          .filter(b => b.scene_id === sc.id)
          .map(b => dbContentToBlock(b.id, b.type, b.content)),
      }))

    return { id: ch.id, title: ch.title, order: idx + 1, scenes }
  })

  return dbToStory(book as DbBook, (chars ?? []) as DbCharacter[], chapters)
}
