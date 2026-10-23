/**
 * Local TTS engines (Qwen3-TTS Voice Studio, Chatterbox TTS Server).
 *
 * Both run on the creator's own machine and are reached through the
 * Next.js server routes (`/api/tts/generate`, `/api/tts/voices`), so they
 * only work when Creator Studio itself runs locally (`npm run creator-studio`).
 *
 * Voice ID conventions (stored on characters.voice_id):
 *   qwen:<Speaker>               Qwen CustomVoice built-in speaker (e.g. qwen:Ryan)
 *   qwen:clone:<Library name>    Qwen voice-library clone (name as saved in Qwen)
 *   chatterbox:<file>            Chatterbox predefined voice (voices/<file>)
 *   chatterbox:clone:<file>      Chatterbox clone from reference_audio/<file>
 *
 * Pure helpers only — safe to import from client and server code.
 */

export type LocalTtsProvider = 'local-qwen' | 'local-chatterbox'

export const LOCAL_TTS_PROVIDERS: readonly LocalTtsProvider[] = ['local-qwen', 'local-chatterbox']

export const LOCAL_TTS_DEFAULT_URLS: Record<LocalTtsProvider, string> = {
  'local-qwen': 'http://127.0.0.1:7860',
  'local-chatterbox': 'http://127.0.0.1:8004',
}

export const LOCAL_TTS_LABELS: Record<LocalTtsProvider, string> = {
  'local-qwen': 'Local Qwen',
  'local-chatterbox': 'Local Chatterbox',
}

export interface LocalVoice {
  /** Full PageCast voice id, already prefixed (qwen:… / chatterbox:…). */
  id: string
  label: string
  provider: LocalTtsProvider
  kind: 'builtin' | 'clone'
  description?: string
}

export function isLocalTtsProvider(provider?: string | null): provider is LocalTtsProvider {
  return provider === 'local-qwen' || provider === 'local-chatterbox'
}

/** Provider implied by a prefixed voice id, or null for PageCast presets (ai_*). */
export function providerFromVoiceId(
  voiceId?: string | null,
): 'elevenlabs' | 'gemini' | LocalTtsProvider | null {
  if (!voiceId) return null
  if (voiceId.startsWith('elevenlabs:')) return 'elevenlabs'
  if (voiceId.startsWith('gemini:')) return 'gemini'
  if (voiceId.startsWith('qwen:')) return 'local-qwen'
  if (voiceId.startsWith('chatterbox:')) return 'local-chatterbox'
  return null
}

// ── Chatterbox ────────────────────────────────────────────────────────────

export interface ChatterboxVoiceSelection {
  voice_mode: 'predefined' | 'clone'
  predefined_voice_id?: string
  reference_audio_filename?: string
}

/** Default predefined voice per PageCast preset, used when the provider is
 *  set to Local Chatterbox but the character still has an ai_* preset. */
const CHATTERBOX_DEFAULT_BY_PRESET: Record<string, string> = {
  ai_narrator_warm: 'Emily.wav',
  ai_narrator_deep: 'Henry.wav',
  ai_female_soft: 'Olivia.wav',
  ai_female_warm: 'Abigail.wav',
  ai_female_bright: 'Jade.wav',
  ai_male_deep: 'Alexander.wav',
  ai_male_calm: 'Ryan.wav',
  ai_male_gruff: 'Axel.wav',
  ai_child_female: 'Layla.wav',
  ai_child_male: 'Eli.wav',
  ai_elder_female: 'Cora.wav',
  ai_elder_male: 'Thomas.wav',
  ai_villain: 'Gabriel.wav',
  ai_whisper: 'Alice.wav',
  ai_dramatic: 'Everett.wav',
  ai_cartoon: 'Gianna.wav',
  ai_robot: 'Michael.wav',
  ai_fantasy: 'Elena.wav',
}

export const CHATTERBOX_FALLBACK_VOICE = 'Emily.wav'

export function resolveChatterboxVoice(voiceId?: string | null): ChatterboxVoiceSelection {
  const value = (voiceId ?? '').trim()
  if (value.startsWith('chatterbox:clone:')) {
    const file = value.slice('chatterbox:clone:'.length).trim()
    if (file) return { voice_mode: 'clone', reference_audio_filename: file }
  }
  if (value.startsWith('chatterbox:')) {
    const file = value.slice('chatterbox:'.length).trim()
    if (file) return { voice_mode: 'predefined', predefined_voice_id: file }
  }
  return {
    voice_mode: 'predefined',
    predefined_voice_id: CHATTERBOX_DEFAULT_BY_PRESET[value] ?? CHATTERBOX_FALLBACK_VOICE,
  }
}

/** Languages supported by chatterbox-multilingual. */
const CHATTERBOX_LANGUAGES = new Set([
  'ar', 'da', 'de', 'el', 'en', 'es', 'fi', 'fr', 'he', 'hi', 'it', 'ja', 'ko',
  'ms', 'nl', 'no', 'pl', 'pt', 'ru', 'sv', 'sw', 'tr', 'zh',
])

/**
 * PageCast story language → Chatterbox language code. Indonesian has no
 * Chatterbox model, so it uses Malay (closest supported). Unsupported codes
 * return undefined so the server's configured default applies.
 */
export function toChatterboxLanguage(code?: string | null): string | undefined {
  const value = (code ?? '').trim().toLowerCase().split(/[-_]/)[0]
  if (!value) return undefined
  if (value === 'id') return 'ms'
  return CHATTERBOX_LANGUAGES.has(value) ? value : undefined
}

// ── Qwen ──────────────────────────────────────────────────────────────────

/** PageCast story language (code or name) → Qwen3-TTS language name. */
export function toQwenLanguage(language?: string | null): string {
  const value = (language ?? '').toLowerCase()
  if (value.startsWith('zh') || value.includes('chinese')) return 'Chinese'
  if (value.startsWith('ja') || value.includes('japanese')) return 'Japanese'
  if (value.startsWith('ko') || value.includes('korean')) return 'Korean'
  if (value.startsWith('fr') || value.includes('french')) return 'French'
  if (value.startsWith('de') || value.includes('german')) return 'German'
  if (value.startsWith('es') || value.includes('spanish')) return 'Spanish'
  if (value.startsWith('pt') || value.includes('portuguese')) return 'Portuguese'
  if (value.startsWith('ru') || value.includes('russian')) return 'Russian'
  return 'English'
}

// ── Voice listing normalisation (server responses → LocalVoice) ────────────

export function qwenVoicesFromHealth(payload: unknown): LocalVoice[] {
  const speakers = (payload as { speakers?: unknown })?.speakers
  if (!Array.isArray(speakers)) return []
  return speakers
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map(speaker => ({
      id: `qwen:${speaker}`,
      label: speaker.replace(/_/g, ' '),
      provider: 'local-qwen' as const,
      kind: 'builtin' as const,
      description: 'Qwen3 CustomVoice speaker',
    }))
}

/**
 * Qwen voice-library clones from `GET /pagecast/voices`. Only entries Qwen
 * marks `usable` (reference audio present + transcript) are returned, because
 * the bridge clones with x-vector-only disabled.
 */
export function qwenCloneVoicesFromLibrary(payload: unknown): LocalVoice[] {
  const voices = (payload as { voices?: unknown })?.voices
  if (!Array.isArray(voices)) return []
  const result: LocalVoice[] = []
  for (const item of voices) {
    const v = item as { name?: unknown; usable?: unknown; language?: unknown; source?: unknown }
    if (typeof v?.name !== 'string' || !v.name.trim() || v.usable !== true) continue
    const language = typeof v.language === 'string' && v.language !== 'Auto' ? v.language : 'auto language'
    const origin = v.source === 'voice_design' ? 'designed voice' : 'cloned voice'
    result.push({
      id: `qwen:clone:${v.name}`,
      label: v.name,
      provider: 'local-qwen',
      kind: 'clone',
      description: `Qwen voice library / ${origin} / ${language}`,
    })
  }
  return result
}

export function chatterboxVoicesFromServer(predefined: unknown, references: unknown): LocalVoice[] {
  const voices: LocalVoice[] = []
  if (Array.isArray(predefined)) {
    for (const item of predefined) {
      const record = typeof item === 'object' && item !== null ? item as { filename?: unknown; display_name?: unknown } : null
      const file = typeof item === 'string' ? item : record?.filename
      if (typeof file !== 'string' || !file.trim()) continue
      const display = typeof record?.display_name === 'string' && record.display_name.trim()
        ? record.display_name
        : file.replace(/\.[^.]+$/, '')
      voices.push({
        id: `chatterbox:${file}`,
        label: display,
        provider: 'local-chatterbox',
        kind: 'builtin',
        description: 'Chatterbox predefined voice',
      })
    }
  }
  if (Array.isArray(references)) {
    for (const file of references) {
      if (typeof file !== 'string' || !file.trim()) continue
      voices.push({
        id: `chatterbox:clone:${file}`,
        label: file.replace(/\.[^.]+$/, ''),
        provider: 'local-chatterbox',
        kind: 'clone',
        description: 'Chatterbox clone (reference audio)',
      })
    }
  }
  return voices
}
