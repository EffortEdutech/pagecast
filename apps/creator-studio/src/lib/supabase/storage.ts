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
  return `${data.publicUrl}?v=${Date.now()}`
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

// ─── Scene atmosphere audio ───────────────────────────────────────────────────

function sceneAudioPath(userId: string, bookId: string, sceneId: string, layer: 'ambience' | 'music'): string {
  return `${userId}/${bookId}/scene_${sceneId}_${layer}`
}

/**
 * Upload a scene atmosphere audio file (ambience or music).
 * Returns the public URL or null on error.
 */
export async function uploadSceneAudio(
  userId: string,
  bookId: string,
  sceneId: string,
  layer: 'ambience' | 'music',
  file: File
): Promise<string | null> {
  const supabase = createClient()
  const path = sceneAudioPath(userId, bookId, sceneId, layer)

  const { error } = await supabase.storage
    .from('assets')
    .upload(path, file, {
      upsert: true,
      contentType: file.type || 'audio/mpeg',
    })

  if (error) {
    console.error('uploadSceneAudio error:', error.message)
    return null
  }

  const { data } = supabase.storage.from('assets').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Delete a scene atmosphere audio file.
 */
export async function deleteSceneAudio(
  userId: string,
  bookId: string,
  sceneId: string,
  layer: 'ambience' | 'music'
): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.storage
    .from('assets')
    .remove([sceneAudioPath(userId, bookId, sceneId, layer)])
  return !error
}

// ─── Scene image ──────────────────────────────────────────────────────────────

function sceneImagePath(userId: string, bookId: string, sceneId: string): string {
  return `${userId}/${bookId}/scene_${sceneId}_image`
}

/**
 * Upload a scene cover image to the 'covers' bucket.
 * Returns the public URL or null on error.
 */
export async function uploadSceneImage(
  userId: string,
  bookId: string,
  sceneId: string,
  file: File
): Promise<string | null> {
  const supabase = createClient()
  const path = sceneImagePath(userId, bookId, sceneId)

  const { error } = await supabase.storage
    .from('covers')
    .upload(path, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
    })

  if (error) {
    console.error('uploadSceneImage error:', error.message)
    return null
  }

  const { data } = supabase.storage.from('covers').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Delete the scene image from the 'covers' bucket.
 */
export async function deleteSceneImage(
  userId: string,
  bookId: string,
  sceneId: string
): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase.storage
    .from('covers')
    .remove([sceneImagePath(userId, bookId, sceneId)])
  return !error
}
