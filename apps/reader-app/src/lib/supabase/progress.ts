/**
 * Supabase data layer — Reading Progress & Purchases (Reader App)
 */
import { createClient } from './client'

export interface ReadingProgressData {
  bookId: string
  chapterIdx: number
  sceneIdx: number
  blockIdx: number
}

// ── Reading Progress ──────────────────────────────────────────────────────────

/** Upsert reading progress for the current user */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function saveProgress(data: ReadingProgressData): Promise<boolean> {
  if (!UUID_RE.test(data.bookId)) return false   // skip demo/non-UUID IDs
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('reading_progress')
    .upsert(
      {
        user_id: user.id,
        book_id: data.bookId,
        chapter_idx: data.chapterIdx,
        scene_idx: data.sceneIdx,
        block_idx: data.blockIdx,
      },
      { onConflict: 'user_id,book_id' }
    )

  return !error
}

/** Load reading progress for all owned books */
export async function fetchAllProgress(): Promise<Record<string, ReadingProgressData>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const { data } = await supabase
    .from('reading_progress')
    .select('book_id, chapter_idx, scene_idx, block_idx')
    .eq('user_id', user.id)

  if (!data) return {}

  return data.reduce<Record<string, ReadingProgressData>>((acc, row) => {
    acc[row.book_id] = {
      bookId: row.book_id,
      chapterIdx: row.chapter_idx,
      sceneIdx: row.scene_idx,
      blockIdx: row.block_idx,
    }
    return acc
  }, {})
}

// ── Purchases / Library ───────────────────────────────────────────────────────

/** Check if the current user owns a book */
export async function checkOwnership(bookId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data } = await supabase
    .from('purchases')
    .select('id')
    .eq('user_id', user.id)
    .eq('book_id', bookId)
    .single()

  return !!data
}

/** Get all book IDs the current user owns */
export async function fetchLibrary(): Promise<string[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('purchases')
    .select('book_id')
    .eq('user_id', user.id)

  return (data ?? []).map(p => p.book_id)
}

/** Add a book to the user's library (free acquisition) */
export async function acquireBook(bookId: string): Promise<boolean> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = await supabase
    .from('purchases')
    .upsert(
      { user_id: user.id, book_id: bookId, price_paid: 0 },
      { onConflict: 'user_id,book_id' }
    )

  return !error
}
