/**
 * Supabase data layer — Books & Characters
 * Sprint 2: books + characters CRUD
 * Sprint 3 will add chapters, scenes, blocks
 */
import { createClient } from './client'
import type { Story, Character } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DbBook {
  id: string
  author_id: string
  title: string
  subtitle: string | null
  description: string | null
  cover_gradient: string
  cover_emoji: string
  genre: string | null
  age_rating: string
  status: 'draft' | 'published' | 'archived'
  price: number
  is_free: boolean
  total_chapters: number
  estimated_time: string | null
  created_at: string
  updated_at: string
}

export interface DbCharacter {
  id: string
  book_id: string
  name: string
  role: string | null
  color: string
  voice_label: string | null
  voice_pitch: number
  voice_rate: number
  avatar_emoji: string | null
  sort_order: number
  created_at: string
}

// ─── Converters ───────────────────────────────────────────────────────────────

/** Map DB book row → studio Story shape (without chapters — added separately) */
export function dbBookToStory(book: DbBook, characters: DbCharacter[] = []): Story {
  return {
    id: book.id,
    title: book.title,
    description: book.description ?? '',
    coverImage: book.cover_emoji,
    language: 'en',
    status: book.status,
    price: book.price,
    hasMusic: false,
    hasSfx: false,
    characters: characters.map(c => ({
      id: c.id,
      name: c.name,
      role: (c.role ?? 'character') as 'narrator' | 'character',
      displayName: c.name,
      color: c.color,
      voiceSource: 'ai' as const,
      voiceId: '',
      voiceLabel: c.voice_label ?? '',
      defaultVolume: 1,
    })),
    chapters: [],
    createdAt: book.created_at,
    updatedAt: book.updated_at,
    durationMinutes: book.estimated_time ? parseInt(book.estimated_time) : undefined,
  }
}

/** Map studio Story → DB book insert shape */
function storyToDbInsert(story: Partial<Story>, authorId: string): Partial<DbBook> {
  return {
    author_id: authorId,
    title: story.title ?? 'Untitled',
    description: story.description ?? null,
    cover_gradient: 'from-accent/30 to-accent/10',
    cover_emoji: story.coverImage ?? '📖',
    status: story.status ?? 'draft',
    price: story.price ?? 0,
    is_free: (story.price ?? 0) === 0,
  }
}

// ─── Books API ────────────────────────────────────────────────────────────────

/** List all books for the current user */
export async function fetchBooks(): Promise<Story[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: books, error } = await supabase
    .from('books')
    .select('*')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })

  if (error || !books) return []

  // Fetch all characters for these books in one query
  const bookIds = books.map(b => b.id)
  const { data: allChars } = await supabase
    .from('characters')
    .select('*')
    .in('book_id', bookIds)
    .order('sort_order')

  const charsByBook = (allChars ?? []).reduce<Record<string, DbCharacter[]>>((acc, c) => {
    if (!acc[c.book_id]) acc[c.book_id] = []
    acc[c.book_id].push(c)
    return acc
  }, {})

  return books.map(b => dbBookToStory(b, charsByBook[b.id] ?? []))
}

/** Create a new book with a default Narrator character */
export async function createBook(title: string, description: string): Promise<Story | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: book, error } = await supabase
    .from('books')
    .insert(storyToDbInsert({ title, description }, user.id))
    .select()
    .single()

  if (error || !book) {
    console.error('createBook error:', error)
    return null
  }

  // Seed a default Narrator character
  const { data: narrator } = await supabase
    .from('characters')
    .insert({
      book_id: book.id,
      name: 'Narrator',
      role: 'narrator',
      color: '#9896A8',
      voice_label: 'Female Soft',
      sort_order: 0,
    })
    .select()
    .single()

  return dbBookToStory(book, narrator ? [narrator] : [])
}

/** Update book metadata */
export async function updateBook(bookId: string, updates: Partial<Story>): Promise<boolean> {
  const supabase = createClient()

  const dbUpdates: Partial<DbBook> = {
    ...(updates.title !== undefined && { title: updates.title }),
    ...(updates.description !== undefined && { description: updates.description }),
    ...(updates.status !== undefined && { status: updates.status }),
    ...(updates.price !== undefined && { price: updates.price, is_free: updates.price === 0 }),
    ...(updates.coverImage !== undefined && { cover_emoji: updates.coverImage }),
  }

  const { error } = await supabase
    .from('books')
    .update(dbUpdates)
    .eq('id', bookId)

  return !error
}

/** Delete a book (cascades to characters, chapters, scenes, blocks) */
export async function deleteBook(bookId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('books').delete().eq('id', bookId)
  return !error
}

/** Toggle publish status of a book */
export async function publishBook(bookId: string, status: 'draft' | 'published'): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('books')
    .update({ status })
    .eq('id', bookId)
  return !error
}

/**
 * Deep-duplicate a book — copies book row, characters, chapters, scenes, and blocks.
 * Returns the new Story or null on failure.
 */
export async function duplicateBook(sourceBookId: string): Promise<Story | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // ── 1. Load source book ──
  const { data: srcBook } = await supabase
    .from('books')
    .select('*')
    .eq('id', sourceBookId)
    .single()
  if (!srcBook) return null

  // ── 2. Create new book ──
  const { data: newBook, error: bookErr } = await supabase
    .from('books')
    .insert({
      author_id: user.id,
      title: `${srcBook.title} (copy)`,
      description: srcBook.description,
      cover_gradient: srcBook.cover_gradient,
      cover_emoji: srcBook.cover_emoji,
      genre: srcBook.genre,
      age_rating: srcBook.age_rating,
      status: 'draft',
      price: srcBook.price,
      is_free: srcBook.is_free,
    })
    .select()
    .single()
  if (bookErr || !newBook) return null

  const newBookId = newBook.id

  // ── 3. Copy characters ──
  const { data: srcChars } = await supabase
    .from('characters')
    .select('*')
    .eq('book_id', sourceBookId)
    .order('sort_order')

  if (srcChars?.length) {
    await supabase.from('characters').insert(
      srcChars.map(c => ({
        book_id: newBookId,
        name: c.name,
        role: c.role,
        color: c.color,
        voice_label: c.voice_label,
        voice_pitch: c.voice_pitch,
        voice_rate: c.voice_rate,
        avatar_emoji: c.avatar_emoji,
        sort_order: c.sort_order,
      }))
    )
  }

  // ── 4. Load + copy chapters ──
  const { data: srcChapters } = await supabase
    .from('chapters')
    .select('*')
    .eq('book_id', sourceBookId)
    .order('sort_order')

  const chapterIdMap: Record<string, string> = {}

  for (const ch of srcChapters ?? []) {
    const { data: newCh } = await supabase
      .from('chapters')
      .insert({ book_id: newBookId, title: ch.title, sort_order: ch.sort_order })
      .select()
      .single()
    if (newCh) chapterIdMap[ch.id] = newCh.id
  }

  // ── 5. Load + copy scenes ──
  const { data: srcScenes } = await supabase
    .from('scenes')
    .select('*')
    .eq('book_id', sourceBookId)
    .order('sort_order')

  const sceneIdMap: Record<string, string> = {}

  for (const sc of srcScenes ?? []) {
    const newChapterId = chapterIdMap[sc.chapter_id]
    if (!newChapterId) continue
    const { data: newSc } = await supabase
      .from('scenes')
      .insert({
        book_id: newBookId,
        chapter_id: newChapterId,
        title: sc.title,
        sort_order: sc.sort_order,
      })
      .select()
      .single()
    if (newSc) sceneIdMap[sc.id] = newSc.id
  }

  // ── 6. Load + copy blocks ──
  const { data: srcBlocks } = await supabase
    .from('blocks')
    .select('*')
    .eq('book_id', sourceBookId)
    .order('sort_order')

  if (srcBlocks?.length) {
    const blockInserts = srcBlocks
      .map(b => {
        const newSceneId = sceneIdMap[b.scene_id]
        if (!newSceneId) return null
        return {
          book_id: newBookId,
          scene_id: newSceneId,
          type: b.type,
          content: b.content,
          sort_order: b.sort_order,
        }
      })
      .filter(Boolean)

    if (blockInserts.length) {
      await supabase.from('blocks').insert(blockInserts as any[])
    }
  }

  // ── 7. Return new story shape ──
  const { data: newChars } = await supabase
    .from('characters')
    .select('*')
    .eq('book_id', newBookId)
    .order('sort_order')

  return dbBookToStory(newBook, newChars ?? [])
}

// ─── Characters API ───────────────────────────────────────────────────────────

/** Add a character to a book */
export async function addCharacter(bookId: string, char: Omit<Character, 'id'>): Promise<Character | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('characters')
    .insert({
      book_id: bookId,
      name: char.name,
      role: char.role,
      color: char.color,
      voice_label: char.voiceLabel,
      sort_order: 99,
    })
    .select()
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    name: data.name,
    role: data.role as 'narrator' | 'character',
    displayName: data.name,
    color: data.color,
    voiceSource: 'ai',
    voiceId: '',
    voiceLabel: data.voice_label ?? '',
    defaultVolume: 1,
  }
}

/** Update a character */
export async function updateCharacter(characterId: string, updates: Partial<Character>): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('characters')
    .update({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.color !== undefined && { color: updates.color }),
      ...(updates.voiceLabel !== undefined && { voice_label: updates.voiceLabel }),
    })
    .eq('id', characterId)

  return !error
}

/** Delete a character */
export async function deleteCharacter(characterId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('characters').delete().eq('id', characterId)
  return !error
}
