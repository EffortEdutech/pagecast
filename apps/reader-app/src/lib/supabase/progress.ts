/**
 * Supabase data layer — Reading Progress & Purchases (Reader App)
 */
import { createClient } from './client'

export interface ReadingProgressData {
  bookId: string
  chapterIdx: number
  sceneIdx: number
  blockIdx: number
  completedAt?: string | null
  lastReadAt?: string | null
}

export interface BookmarkData extends ReadingProgressData {
  id?: string
  label: string
  note?: string | null
  createdAt?: string
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
        last_read_at: data.lastReadAt ?? new Date().toISOString(),
        completed_at: data.completedAt ?? null,
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
    .select('book_id, chapter_idx, scene_idx, block_idx, last_read_at, completed_at')
    .eq('user_id', user.id)

  if (!data) return {}

  return data.reduce<Record<string, ReadingProgressData>>((acc, row) => {
    acc[row.book_id] = {
      bookId: row.book_id,
      chapterIdx: row.chapter_idx,
      sceneIdx: row.scene_idx,
      blockIdx: row.block_idx,
      lastReadAt: row.last_read_at,
      completedAt: row.completed_at,
    }
    return acc
  }, {})
}

// ── Bookmarks ────────────────────────────────────────────────────────────────

export async function saveBookmarks(bookId: string, bookmarks: BookmarkData[]): Promise<boolean> {
  if (!UUID_RE.test(bookId)) return false
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { error: deleteError } = await supabase
    .from('reader_bookmarks')
    .delete()
    .eq('user_id', user.id)
    .eq('book_id', bookId)
  if (deleteError) return false

  if (!bookmarks.length) return true

  const { error } = await supabase
    .from('reader_bookmarks')
    .insert(bookmarks.map(b => ({
      user_id: user.id,
      book_id: bookId,
      chapter_idx: b.chapterIdx,
      scene_idx: b.sceneIdx,
      block_idx: b.blockIdx,
      label: b.label,
      note: b.note ?? null,
      created_at: b.createdAt ?? new Date().toISOString(),
    })))

  return !error
}

export async function fetchAllBookmarks(): Promise<Record<string, BookmarkData[]>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const { data } = await supabase
    .from('reader_bookmarks')
    .select('id, book_id, chapter_idx, scene_idx, block_idx, label, note, created_at')
    .eq('user_id', user.id)
    .order('created_at')

  if (!data) return {}

  return data.reduce<Record<string, BookmarkData[]>>((acc, row) => {
    acc[row.book_id] = acc[row.book_id] ?? []
    acc[row.book_id].push({
      id: row.id,
      bookId: row.book_id,
      chapterIdx: row.chapter_idx,
      sceneIdx: row.scene_idx,
      blockIdx: row.block_idx,
      label: row.label,
      note: row.note,
      createdAt: row.created_at,
    })
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
