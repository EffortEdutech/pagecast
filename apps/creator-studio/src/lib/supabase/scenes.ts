/**
 * Supabase helpers for Scene-level operations
 */
import { createClient } from './client'

export interface SceneAtmosphereUpdate {
  ambienceUrl?:    string | null
  musicUrl?:       string | null
  ambienceVolume?: number
  musicVolume?:    number
}

/**
 * Persist atmosphere fields (ambience/music URLs + volumes) for a scene.
 * Requires migration 004_scene_atmosphere.sql to have been run.
 */
export async function updateSceneAtmosphere(
  sceneId: string,
  update: SceneAtmosphereUpdate
): Promise<boolean> {
  const supabase = createClient()

  const payload: Record<string, unknown> = {}
  if ('ambienceUrl'    in update) payload.ambience_url    = update.ambienceUrl    ?? null
  if ('musicUrl'       in update) payload.music_url       = update.musicUrl       ?? null
  if ('ambienceVolume' in update) payload.ambience_volume = update.ambienceVolume
  if ('musicVolume'    in update) payload.music_volume    = update.musicVolume

  if (Object.keys(payload).length === 0) return true

  const { error } = await supabase
    .from('scenes')
    .update(payload)
    .eq('id', sceneId)

  if (error) {
    console.error('updateSceneAtmosphere error:', error.message)
    return false
  }
  return true
}
