/**
 * Shared PageCast import pipeline
 * ─────────────────────────────────────────────────────────────────────────────
 * Logic shared between:
 *   • Import Text modal (studio/[bookId] page) — imports chapters into a book
 *     that's already open, optionally auto-creating cast from a ::CAST block.
 *   • "Import folder" on the Dashboard — creates a brand-new book from a whole
 *     folder of *_pagecast.txt castlet/chapter files in one action.
 *
 * Kept here (rather than duplicated in both call sites) so cast auto-creation
 * and character-name resolution stay in sync.
 */
import { v4 as uuid } from 'uuid'
import { createCharacter as dbCreateCharacter } from './supabase/characters'
import { hexForColorWord, guessVoiceId, type ParsedCastMember } from './textParser'
import type { Character, StoryBlock } from '@/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Creates any characters named in a ::CAST block that don't already exist on the
 * book (matched by display name, case-insensitive). Existing characters — including
 * the default "Narrator" seeded on book creation — are left untouched.
 *
 * Color/voice are best-effort guesses from the CAST line's free-text descriptors;
 * always editable afterward in the Voices page.
 */
export async function autoCreateMissingCast(
  bookId: string,
  cast: ParsedCastMember[] | undefined,
  existing: Character[]
): Promise<Character[]> {
  if (!cast || cast.length === 0) return []

  const existingNames = new Set(existing.map(c => c.name.trim().toLowerCase()))
  const toCreate = cast.filter(c => !existingNames.has(c.name.trim().toLowerCase()))
  if (toCreate.length === 0) return []

  const created: Character[] = []
  let sortOrder = existing.length

  for (const member of toCreate) {
    const isNarrator = member.role.toLowerCase().includes('narrator')
    const char = await dbCreateCharacter(bookId, {
      name:          member.name,
      role:          isNarrator ? 'narrator' : 'character',
      displayName:   member.name,
      color:         hexForColorWord(member.colorWord, sortOrder),
      voiceSource:   'ai',
      voiceId:       guessVoiceId(member.voiceDescriptor, member.role) ?? 'ai_female_soft',
      voiceLabel:    member.voiceDescriptor ?? '',
      defaultVolume: 1,
    }, sortOrder)
    sortOrder++
    if (char) created.push(char)
  }

  return created
}

/** Builds a name/slug → characterId lookup (lowercase, underscore, and hyphen variants). */
export function buildCharacterNameMap(characters: Character[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const c of characters) {
    const lower = c.name.trim().toLowerCase()
    map.set(lower, c.id)
    map.set(lower.replace(/\s+/g, '_'), c.id)
    map.set(lower.replace(/\s+/g, '-'), c.id)
  }
  return map
}

/**
 * Resolves a dialogue/thought block's characterId "name hint" (e.g. "mak_cempaka",
 * set by the pageCast parser) to a real characterId using the given name map.
 * Blocks that already carry a real UUID, or carry no hint, are returned unchanged.
 */
export function resolveBlockCharacter(block: StoryBlock, nameMap: Map<string, string>): StoryBlock {
  if (block.type !== 'dialogue' && block.type !== 'thought') return block
  const hint = block.characterId
  if (!hint || UUID_RE.test(hint)) return block
  const resolved = nameMap.get(hint.toLowerCase()) ?? nameMap.get(hint.toLowerCase().replace(/\s+/g, '_'))
  return { ...block, characterId: resolved ?? '' }
}

/** Generates a fresh id — re-exported so callers assembling Chapter/Scene objects don't need their own uuid import. */
export function newId(): string {
  return uuid()
}
