/**
 * lib/supabase/characters.ts
 * Character CRUD -- persists to the `characters` Supabase table.
 * Used by the Voices page; mirrors the same pattern as blocks.ts / scenes.ts.
 */
import { createClient } from './client'
import type { Character } from '@/types'

// DB row shape for the characters table
interface DbCharacter {
  id:          string
  book_id:     string
  name:        string
  role:        string | null
  color:       string | null
  voice_id:    string | null
  voice_label: string | null
  sort_order:  number
  created_at:  string
}

function dbToCharacter(row: DbCharacter): Character {
  return {
    id:            row.id,
    name:          row.name,
    role:          (row.role ?? 'character') as 'narrator' | 'character',
    displayName:   row.name,
    color:         row.color ?? '#5C5A6A',
    voiceSource:   'ai' as const,
    voiceId:       row.voice_id ?? 'ai_female_soft',
    voiceLabel:    row.voice_label ?? '',
    defaultVolume: 1,
  }
}

/** Fetch all characters for a book, ordered by sort_order */
export async function fetchCharacters(bookId: string): Promise<Character[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('book_id', bookId)
    .order('sort_order')
  if (error || !data) return []
  return (data as DbCharacter[]).map(dbToCharacter)
}

/** Insert a new character row; returns the created Character or null */
export async function createCharacter(
  bookId: string,
  char: Omit<Character, 'id'>,
  sortOrder = 0
): Promise<Character | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('characters')
    .insert({
      book_id:     bookId,
      name:        char.name,
      role:        char.role,
      color:       char.color,
      voice_id:    char.voiceId,
      voice_label: char.voiceLabel,
      sort_order:  sortOrder,
    })
    .select()
    .single()
  if (error || !data) { console.error('[characters] create:', error); return null }
  return dbToCharacter(data as DbCharacter)
}

/** Partial update -- only sends changed fields */
export async function updateCharacter(
  characterId: string,
  updates: Partial<Character>
): Promise<void> {
  const supabase = createClient()
  const patch: Record<string, unknown> = {}
  if (updates.name       !== undefined) patch.name        = updates.name
  if (updates.role       !== undefined) patch.role        = updates.role
  if (updates.color      !== undefined) patch.color       = updates.color
  if (updates.voiceId    !== undefined) patch.voice_id    = updates.voiceId
  if (updates.voiceLabel !== undefined) patch.voice_label = updates.voiceLabel
  if (Object.keys(patch).length === 0) return
  const { error } = await supabase.from('characters').update(patch).eq('id', characterId)
  if (error) console.error('[characters] update:', error)
}

/** Hard-delete a character row */
export async function deleteCharacter(characterId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('characters').delete().eq('id', characterId)
  if (error) console.error('[characters] delete:', error)
}
