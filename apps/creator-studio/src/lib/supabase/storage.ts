/**
 * Supabase Storage helpers — audio assets
 * Upload path: assets/{userId}/{bookId}/{blockId}
 * Matches the RLS policy: first segment must equal auth.uid()
 */
import { createClient } from './client'

function audioPath(userId: string, bookId: string, blockId: string): string {
  return `${userId}/${bookId}/${blockId}`
}

/**
 * Upload an audio file for a block.
 * Uses upsert so re-uploading the same block replaces the previous file.
 * Returns the public URL or null on error.
 */
export async function uploadBlockAudio(
  userId: string,
  bookId: string,
  blockId: string,
  file: File
): Promise<string | null> {
  const supabase = createClient()
  const path = audioPath(userId, bookId, blockId)

  const { error } = await supabase.storage
    .from('assets')
    .upload(path, file, {
      upsert: true,
      contentType: file.type || 'audio/mpeg',
    })

  if (error) {
    console.error('uploadBlockAudio error:', error.message)
    return null
  }

  const { data } = supabase.storage.from('assets').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Delete the audio file for a block.
 */
export async function deleteBlockAudio(
  userId: string,
  bookId: string,
  blockId: string
): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.storage
    .from('assets')
    .remove([audioPath(userId, bookId, blockId)])
  return !error
}
