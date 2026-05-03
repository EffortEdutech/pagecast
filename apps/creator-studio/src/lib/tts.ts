/**
 * TTS generation helpers
 *
 * Settings are stored in localStorage so the user's API key never
 * leaves their machine except when they explicitly trigger generation.
 */
import { uploadBlockAudio } from './supabase/storage'

export const TTS_KEY_LS   = 'pagecast_tts_api_key'
export const TTS_PROV_LS  = 'pagecast_tts_provider'

// ── Settings ────────────────────────────────────────────────────────────────

export function getTtsSettings(): { apiKey: string; provider: string } {
  if (typeof window === 'undefined') return { apiKey: '', provider: 'openai' }
  return {
    apiKey:   localStorage.getItem(TTS_KEY_LS)  ?? '',
    provider: localStorage.getItem(TTS_PROV_LS) ?? 'openai',
  }
}

export function saveTtsSettings(apiKey: string, provider: string): void {
  localStorage.setItem(TTS_KEY_LS,  apiKey)
  localStorage.setItem(TTS_PROV_LS, provider)
}

// ── Generation ───────────────────────────────────────────────────────────────

export interface TtsGenerateOpts {
  text:    string
  voiceId: string
  userId:  string
  bookId:  string
  blockId: string
  speed?:  number
}

export interface TtsResult {
  url:   string | null
  error: string | null
}

/**
 * Generate TTS audio for a block and upload it to Supabase Storage.
 * Returns the public URL on success, or an error string on failure.
 */
export async function generateBlockTts(opts: TtsGenerateOpts): Promise<TtsResult> {
  const { apiKey, provider } = getTtsSettings()

  if (!apiKey) {
    return {
      url:   null,
      error: 'No API key — add your key in Settings → AI Voice (TTS).',
    }
  }

  if (!opts.text?.trim()) {
    return { url: null, error: 'This block has no text to synthesise.' }
  }

  // 1 — Call the API route
  let res: Response
  try {
    res = await fetch('/api/tts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text:    opts.text.trim(),
        voiceId: opts.voiceId,
        provider,
        apiKey,
        speed:   opts.speed ?? 1.0,
      }),
    })
  } catch (e: any) {
    return { url: null, error: `Network error: ${e.message}` }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }))
    return { url: null, error: body.error ?? 'TTS generation failed' }
  }

  // 2 — Upload audio buffer to Supabase Storage
  const blob = await res.blob()
  const file = new File([blob], `${opts.blockId}.mp3`, { type: 'audio/mpeg' })

  const url = await uploadBlockAudio(opts.userId, opts.bookId, opts.blockId, file)
  if (!url) {
    return { url: null, error: 'Audio generated but upload to storage failed.' }
  }

  return { url, error: null }
}
