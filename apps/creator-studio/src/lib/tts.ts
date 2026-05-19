/**
 * TTS generation helpers
 *
 * Settings are stored in localStorage so the user's API key never
 * leaves their machine except when they explicitly trigger generation.
 */
import { uploadBlockAudio } from './supabase/storage'
import { formatTextForTts } from './performanceText'

export const TTS_KEY_LS   = 'pagecast_tts_api_key'
export const TTS_PROV_LS  = 'pagecast_tts_provider'
export const TTS_OPENAI_KEY_LS = 'pagecast_tts_openai_api_key'
export const TTS_ELEVENLABS_KEY_LS = 'pagecast_tts_elevenlabs_api_key'
export const TTS_GEMINI_KEY_LS = 'pagecast_tts_gemini_api_key'
export const TTS_GEMINI_MODEL_LS = 'pagecast_tts_gemini_model'

export type TtsProvider = 'openai' | 'elevenlabs' | 'gemini'
export type GeminiTtsModel =
  | 'gemini-2.5-flash-preview-tts'
  | 'gemini-3.1-flash-tts-preview'
  | 'gemini-2.5-pro-preview-tts'

export const GEMINI_TTS_MODELS: Array<{ id: GeminiTtsModel; label: string; description: string }> = [
  {
    id: 'gemini-2.5-flash-preview-tts',
    label: 'Gemini 2.5 Flash TTS - Economy',
    description: 'Best default for PageCast story generation. Lower cost and still controllable.',
  },
  {
    id: 'gemini-3.1-flash-tts-preview',
    label: 'Gemini 3.1 Flash TTS - Premium',
    description: 'Use for important scenes, stronger prompt following, and premium samples.',
  },
  {
    id: 'gemini-2.5-pro-preview-tts',
    label: 'Gemini 2.5 Pro TTS - Pro test',
    description: 'Experimental high-control option. Use sparingly for comparison.',
  },
]

// ── Settings ────────────────────────────────────────────────────────────────

function normalizeProvider(provider?: string | null): TtsProvider {
  return provider === 'elevenlabs' || provider === 'gemini' ? provider : 'openai'
}

export function normalizeGeminiTtsModel(model?: string | null): GeminiTtsModel {
  return GEMINI_TTS_MODELS.some(item => item.id === model)
    ? model as GeminiTtsModel
    : 'gemini-2.5-flash-preview-tts'
}

export function getTtsApiKey(provider: string): string {
  if (typeof window === 'undefined') return ''
  const normalized = normalizeProvider(provider)
  if (normalized === 'elevenlabs') return localStorage.getItem(TTS_ELEVENLABS_KEY_LS) ?? ''
  if (normalized === 'gemini') return localStorage.getItem(TTS_GEMINI_KEY_LS) ?? ''
  return localStorage.getItem(TTS_OPENAI_KEY_LS) ?? localStorage.getItem(TTS_KEY_LS) ?? ''
}

export function getTtsSettings(): {
  apiKey: string
  provider: TtsProvider
  keys: Record<TtsProvider, string>
  geminiModel: GeminiTtsModel
} {
  if (typeof window === 'undefined') {
    return {
      apiKey: '',
      provider: 'openai',
      keys: { openai: '', elevenlabs: '', gemini: '' },
      geminiModel: 'gemini-2.5-flash-preview-tts',
    }
  }
  const provider = normalizeProvider(localStorage.getItem(TTS_PROV_LS))
  const geminiModel = normalizeGeminiTtsModel(localStorage.getItem(TTS_GEMINI_MODEL_LS))
  const legacyKey = localStorage.getItem(TTS_KEY_LS) ?? ''
  const keys = {
    openai: localStorage.getItem(TTS_OPENAI_KEY_LS) ?? (provider === 'openai' ? legacyKey : ''),
    elevenlabs: localStorage.getItem(TTS_ELEVENLABS_KEY_LS) ?? (provider === 'elevenlabs' ? legacyKey : ''),
    gemini: localStorage.getItem(TTS_GEMINI_KEY_LS) ?? (provider === 'gemini' ? legacyKey : ''),
  }
  return {
    apiKey: keys[provider],
    provider,
    keys,
    geminiModel,
  }
}

export function saveTtsSettings(apiKey: string, provider: string): void {
  const normalized = normalizeProvider(provider)
  localStorage.setItem(TTS_KEY_LS,  apiKey)
  localStorage.setItem(TTS_PROV_LS, normalized)
  if (normalized === 'elevenlabs') localStorage.setItem(TTS_ELEVENLABS_KEY_LS, apiKey)
  else if (normalized === 'gemini') localStorage.setItem(TTS_GEMINI_KEY_LS, apiKey)
  else localStorage.setItem(TTS_OPENAI_KEY_LS, apiKey)
}

// ── Generation ───────────────────────────────────────────────────────────────

export interface TtsGenerateOpts {
  text:    string
  voiceId: string
  userId:  string
  bookId:  string
  blockId: string
  speed?:  number
  blockType?: string
  emotion?: string
  style?: string
  voiceLabel?: string
  performanceTag?: string
  characterName?: string
  geminiModel?: GeminiTtsModel
}

export interface TtsResult {
  url:   string | null
  error: string | null
  provider?: string | null
  providerVoice?: string | null
}

/**
 * Generate TTS audio for a block and upload it to Supabase Storage.
 * Returns the public URL on success, or an error string on failure.
 */
export async function generateBlockTts(opts: TtsGenerateOpts): Promise<TtsResult> {
  const settings = getTtsSettings()
  const provider = opts.voiceId.startsWith('elevenlabs:')
    ? 'elevenlabs'
    : opts.voiceId.startsWith('gemini:')
      ? 'gemini'
      : settings.provider
  const apiKey = getTtsApiKey(provider)
  const ttsText = formatTextForTts(opts.text)

  if (!apiKey) {
    return {
      url:   null,
      error: 'No API key — add your key in Settings → AI Voice (TTS).',
    }
  }

  if (!ttsText) {
    return { url: null, error: 'This block has no text to synthesise.' }
  }

  // 1 — Call the API route
  let res: Response
  try {
    res = await fetch('/api/tts/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text:    ttsText,
        voiceId: opts.voiceId,
        provider,
        apiKey,
        speed:   opts.speed ?? 0.95,
        blockType: opts.blockType,
        emotion: opts.emotion,
        style: opts.style,
        voiceLabel: opts.voiceLabel,
        performanceTag: opts.performanceTag,
        characterName: opts.characterName,
        geminiModel: opts.geminiModel ?? settings.geminiModel,
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
  const providerName = res.headers.get('X-TTS-Provider')
  const providerVoice = res.headers.get('X-TTS-Voice')
  const blob = await res.blob()
  const contentType = res.headers.get('Content-Type') ?? 'audio/mpeg'
  const extension = contentType.includes('wav') || contentType.includes('pcm') ? 'wav' : 'mp3'
  const file = new File([blob], `${opts.blockId}.${extension}`, { type: contentType })

  const url = await uploadBlockAudio(opts.userId, opts.bookId, opts.blockId, file)
  if (!url) {
    return { url: null, error: 'Audio generated but upload to storage failed.' }
  }

  return { url, error: null, provider: providerName, providerVoice }
}
