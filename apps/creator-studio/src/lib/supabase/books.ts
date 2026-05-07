/**
 * Supabase data layer -- Books & Characters
 * Sprint 2: books + characters CRUD
 * Sprint 3: chapters, scenes, blocks handled in blocks.ts
 */
import { createClient } from './client'
import type { Story, Character } from '@/types'

// Types

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
  narrator_only_mode: boolean
  narrator_voice_id: string | null
  created_at: string
  updated_at: string
}

export interface DbCharacter {
  id: string
  book_id: string
  name: string
  role: string | null
  color: string
  voice_id: string | null      // added in migration 005
  voice_label: string | null
  voice_pitch: number
  voice_rate: number
  avatar_emoji: string | null
  sort_order: number
  created_at: string
}

// Converters

export function dbBookToStory(book: DbBook, characters: DbCharacter[] = []): Story {
  return {
    id: book.id,
    title: book.title,
    description: book.description ?? '',
    coverImage: book.cover_emoji,
    coverGradient: book.cover_gradient,
    language: 'en',
    status: book.status,
    price: book.price,
    hasMusic: false,
    hasSfx: false,
    characters: characters.map(c => ({
      id:            c.id,
      name:          c.name,
      role:          (c.role ?? 'character') as 'narrator' | 'character',
      displayName:   c.name,
      color:         c.color,
      voiceSource:   'ai' as const,
      voiceId:       c.voice_id ?? 'ai_female_soft',
      voiceLabel:    c.voice_label ?? '',
      defaultVolume: 1,
    })),
    chapters: [],
    createdAt: book.created_at,
    updatedAt: book.updated_at,
    durationMinutes: book.estimated_time ? parseInt(book.estimated_time) : undefined,
    genre: book.genre ?? undefined,
    ageRating: book.age_rating ?? undefined,
    narratorOnlyMode: book.narrator_only_mode,
    narratorVoiceId: book.narrator_voice_id ?? undefined,
  }
}

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

// Books API

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

export async function createBook(title: string, description: string): Promise<Story | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: book, error } = await supabase
    .from('books')
    .insert(storyToDbInsert({ title, description }, user.id))
    .select()
    .single()

  if (error || !book) { console.error('createBook error:', error); return null }

  // Seed default Narrator with voice_id
  const { data: narrator } = await supabase
    .from('characters')
    .insert({
      book_id:     book.id,
      name:        'Narrator',
      role:        'narrator',
      color:       '#9896A8',
      voice_id:    'ai_female_soft',
      voice_label: 'Aria -- Female Soft',
      sort_order:  0,
    })
    .select()
    .single()

  return dbBookToStory(book, narrator ? [narrator] : [])
}

export async function updateBook(bookId: string, updates: Partial<Story>): Promise<boolean> {
  const supabase = createClient()
  const dbUpdates: Partial<DbBook> = {
    ...(updates.title       !== undefined && { title: updates.title }),
    ...(updates.description !== undefined && { description: updates.description }),
    ...(updates.status      !== undefined && { status: updates.status }),
    ...(updates.price       !== undefined && { price: updates.price, is_free: updates.price === 0 }),
    ...(updates.coverImage        !== undefined && { cover_emoji:          updates.coverImage }),
    ...(updates.coverGradient     !== undefined && { cover_gradient:       updates.coverGradient }),
    ...(updates.genre             !== undefined && { genre:                updates.genre }),
    ...(updates.ageRating         !== undefined && { age_rating:           updates.ageRating }),
    ...(updates.durationMinutes   !== undefined && { estimated_time:       String(updates.durationMinutes) }),
    ...(updates.narratorOnlyMode  !== undefined && { narrator_only_mode:  updates.narratorOnlyMode }),
    ...(updates.narratorVoiceId   !== undefined && { narrator_voice_id:   updates.narratorVoiceId }),
  }
  const { error } = await supabase.from('books').update(dbUpdates).eq('id', bookId)
  return !error
}

export async function deleteBook(bookId: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('books').delete().eq('id', bookId)
  return !error
}

export async function publishBook(bookId: string, status: 'draft' | 'published'): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.from('books').update({ status }).eq('id', bookId)
  return !error
}

export async function duplicateBook(sourceBookId: string): Promise<Story | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 1. Load source book
  const { data: srcBook } = await supabase.from('books').select('*').eq('id', sourceBookId).single()
  if (!srcBook) return null

  // 2. Create new book
  const { data: newBook, error: bookErr } = await supabase
    .from('books')
    .insert({
      author_id:      user.id,
      title:          `${srcBook.title} (copy)`,
      description:    srcBook.description,
      cover_gradient: srcBook.cover_gradient,
      cover_emoji:    srcBook.cover_emoji,
      genre:          srcBook.genre,
      age_rating:     srcBook.age_rating,
      status:         'draft',
      price:          srcBook.price,
      is_free:        srcBook.is_free,
      estimated_time: srcBook.estimated_time,
      narrator_only_mode: srcBook.narrator_only_mode,
      narrator_voice_id: srcBook.narrator_voice_id,
    })
    .select()
    .single()
  if (bookErr || !newBook) return null

  const newBookId = newBook.id

  // 3. Copy characters (with voice_id)
  const { data: srcChars } = await supabase
    .from('characters')
    .select('*')
    .eq('book_id', sourceBookId)
    .order('sort_order')

  const charIdMap = new Map<string, string>()
  let newChars: DbCharacter[] = []
  if (srcChars?.length) {
    const { data: insertedChars } = await supabase.from('characters').insert(
      srcChars.map(c => ({
        book_id:     newBookId,
        name:        c.name,
        role:        c.role,
        color:       c.color,
        voice_id:    c.voice_id,
        voice_label: c.voice_label,
        voice_pitch: c.voice_pitch,
        voice_rate:  c.voice_rate,
        sort_order:  c.sort_order,
      }))
    ).select()

    newChars = (insertedChars ?? []) as DbCharacter[]
    srcChars.forEach((src, idx) => {
      const inserted = newChars[idx]
      if (inserted) charIdMap.set(src.id, inserted.id)
    })
  }

  // 4. Copy chapters
  const { data: srcChapters } = await supabase
    .from('chapters')
    .select('*')
    .eq('book_id', sourceBookId)
    .order('sort_order')

  for (const ch of srcChapters ?? []) {
    const { data: newCh } = await supabase
      .from('chapters')
      .insert({ book_id: newBookId, title: ch.title, sort_order: ch.sort_order })
      .select()
      .single()
    if (!newCh) continue

    // 5. Copy scenes
    const { data: srcScenes } = await supabase
      .from('scenes')
      .select('*')
      .eq('chapter_id', ch.id)
      .order('sort_order')

    for (const sc of srcScenes ?? []) {
      const { data: newSc } = await supabase
        .from('scenes')
        .insert({
          book_id:        newBookId,
          chapter_id:     newCh.id,
          title:          sc.title,
          sort_order:     sc.sort_order,
          ambience_url:   sc.ambience_url,
          music_url:      sc.music_url,
          ambience_volume: sc.ambience_volume,
          music_volume:   sc.music_volume,
          ambience_loop:  sc.ambience_loop,
          music_loop:     sc.music_loop,
          scene_image:    sc.scene_image,
        })
        .select()
        .single()
      if (!newSc) continue

      // 6. Copy blocks
      const { data: srcBlocks } = await supabase
        .from('blocks')
        .select('*')
        .eq('scene_id', sc.id)
        .order('sort_order')

      if (srcBlocks?.length) {
        await supabase.from('blocks').insert(
          srcBlocks.map(b => {
            const content = { ...(b.content ?? {}) }
            if (typeof content.character_id === 'string') {
              content.character_id = charIdMap.get(content.character_id) ?? content.character_id
            }

            return {
              book_id:    newBookId,
              scene_id:   newSc.id,
              type:       b.type,
              content,
              audio_url:  b.audio_url,
              sort_order: b.sort_order,
            }
          })
        )
      }
    }
  }

  return dbBookToStory(newBook, newChars)
}
