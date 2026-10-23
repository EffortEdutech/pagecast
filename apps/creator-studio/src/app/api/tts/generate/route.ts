import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireApiUser } from '@/lib/supabase/apiAuth'
import { getGeminiVoice, getOpenAiVoiceForVoiceId, getPageCastVoice, getVoiceCastingInstruction } from '@/lib/voiceLibrary'
import { normalizeGeminiTtsModel, type GeminiTtsModel } from '@/lib/tts'
import {
  LOCAL_TTS_DEFAULT_URLS,
  isLocalTtsProvider,
  resolveChatterboxVoice,
  toChatterboxLanguage,
  toQwenLanguage,
} from '@/lib/localTts'

export const runtime = 'nodejs'

// Voice mapping and casting notes live in src/lib/voiceLibrary.ts.

interface ElevenLabsVoice {
  voice_id: string
  name: string
  category?: string
  description?: string
  labels?: Record<string, string>
}

const ELEVENLABS_MATCH_TERMS: Record<string, string[]> = {
  ai_narrator_warm: ['narration', 'storytelling', 'warm', 'calm', 'middle aged', 'female'],
  ai_narrator_deep: ['narration', 'storytelling', 'deep', 'male', 'middle aged', 'old'],
  ai_female_soft: ['female', 'young', 'soft', 'calm', 'gentle'],
  ai_female_warm: ['female', 'middle aged', 'warm', 'motherly', 'calm'],
  ai_female_bright: ['female', 'young', 'teen', 'bright', 'excited'],
  ai_male_deep: ['male', 'middle aged', 'deep', 'serious'],
  ai_male_calm: ['male', 'young', 'calm', 'conversational'],
  ai_male_gruff: ['male', 'gruff', 'raspy', 'rough', 'middle aged'],
  ai_child_female: ['female', 'child', 'young', 'kid', 'cute'],
  ai_child_male: ['male', 'child', 'young', 'kid', 'cute'],
  ai_elder_female: ['female', 'old', 'elderly', 'grandmother', 'aged'],
  ai_elder_male: ['male', 'old', 'elderly', 'grandfather', 'aged'],
  ai_villain: ['male', 'villain', 'deep', 'dark', 'evil', 'serious'],
  ai_whisper: ['whisper', 'soft', 'female', 'calm'],
  ai_dramatic: ['male', 'dramatic', 'narration', 'announcer', 'strong'],
  ai_cartoon: ['cartoon', 'child', 'young', 'animated', 'excited'],
  ai_robot: ['robot', 'character', 'serious', 'male'],
  ai_fantasy: ['female', 'narration', 'fantasy', 'calm', 'soft'],
}

const ELEVENLABS_FALLBACK_VOICES: Record<string, { id: string; name: string }> = {
  ai_narrator_warm: { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
  ai_narrator_deep: { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George' },
  ai_female_soft: { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
  ai_female_warm: { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte' },
  ai_female_bright: { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda' },
  ai_male_deep: { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold' },
  ai_male_calm: { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni' },
  ai_male_gruff: { id: '2EiwWnXFnvU5JabPnv8n', name: 'Clyde' },
  ai_child_female: { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli' },
  ai_child_male: { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam' },
  ai_elder_female: { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy' },
  ai_elder_male: { id: 'GBv7mTt0atIp3Br8iCZE', name: 'Thomas' },
  ai_villain: { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum' },
  ai_whisper: { id: 'oWAxZDx7w5VEj9dCyTzz', name: 'Grace' },
  ai_dramatic: { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie' },
  ai_cartoon: { id: 'jBpfuIE2acCO8z3wKNLl', name: 'Gigi' },
  ai_robot: { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam' },
  ai_fantasy: { id: 'jsCqWAovK2LkecY7zXl4', name: 'Freya' },
}

function voiceSearchText(voice: ElevenLabsVoice): string {
  return [
    voice.name,
    voice.category,
    voice.description,
    ...Object.entries(voice.labels ?? {}).flatMap(([key, value]) => [key, value]),
  ].filter(Boolean).join(' ').toLowerCase()
}

function scoreElevenLabsVoice(voice: ElevenLabsVoice, voiceId: string): number {
  const profile = getPageCastVoice(voiceId)
  const text = voiceSearchText(voice)
  const terms = ELEVENLABS_MATCH_TERMS[voiceId] ?? []
  let score = 0

  for (const term of terms) {
    if (text.includes(term)) score += 4
  }

  if (profile.gender !== 'neutral' && text.includes(profile.gender)) score += 8
  if (profile.category === 'child' && /(child|kid|young|teen)/.test(text)) score += 8
  if (profile.category === 'elder' && /(old|elder|aged|senior|grand)/.test(text)) score += 8
  if (profile.category === 'narrator' && /(narration|story|audiobook)/.test(text)) score += 6
  if (profile.category === 'villain' && /(villain|dark|evil|deep|serious)/.test(text)) score += 6

  return score
}

async function resolveElevenLabsVoice(apiKey: string, voiceId: string): Promise<{ id: string; name: string }> {
  if (voiceId.startsWith('elevenlabs:')) {
    const id = voiceId.slice('elevenlabs:'.length)
    return { id, name: id }
  }

  if (!voiceId.startsWith('ai_')) return { id: voiceId, name: voiceId }

  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
    cache: 'no-store',
  })

  if (!res.ok) {
    const fallback = ELEVENLABS_FALLBACK_VOICES[voiceId]
    if (fallback) return fallback
    throw new Error(`ElevenLabs voices error ${res.status}`)
  }

  const data = await res.json()
  const voices = Array.isArray(data?.voices) ? data.voices as ElevenLabsVoice[] : []
  if (!voices.length) {
    const fallback = ELEVENLABS_FALLBACK_VOICES[voiceId]
    if (fallback) return fallback
    throw new Error('No ElevenLabs voices are available for this API key.')
  }

  const best = voices
    .map(voice => ({ voice, score: scoreElevenLabsVoice(voice, voiceId) }))
    .sort((a, b) => b.score - a.score)[0]?.voice ?? voices[0]

  return { id: best.voice_id, name: best.name }
}

function buildStorytellingInstructions(opts: {
  voiceId?: string
  blockType?: string
  emotion?: string
  style?: string
  voiceLabel?: string
}): string {
  const parts = [
    'Perform this as an expressive PageCast storybook voice, not as plain narration.',
    getVoiceCastingInstruction(opts.voiceId),
    'Keep the chosen vocal identity consistent for the whole passage.',
    'Use clear character intention, natural emotional color, and audible age/gender texture from the casting note.',
    'Shape each sentence with rise and fall, emphasize meaningful words, and avoid a monotone delivery.',
    'Leave a short natural breath between sentences and a slightly longer pause at the end of this story beat.',
    'Do not announce stage directions, labels, punctuation, or the emotion name.',
  ]

  if (opts.voiceLabel) {
    parts.push(`Stay consistent with this casting note: ${opts.voiceLabel}.`)
  }

  switch (opts.blockType) {
    case 'dialogue':
      parts.push('This is character dialogue. Speak as the character in the moment, with conversational timing and believable feeling.')
      break
    case 'thought':
      parts.push('This is an inner thought. Make it intimate, reflective, and slightly softer than spoken dialogue.')
      break
    case 'quote':
      parts.push('This is a quoted or special passage. Give it a measured, memorable cadence.')
      break
    case 'narration':
    default:
      parts.push('This is narration. Guide the listener through the scene with gentle suspense, wonder, and clarity.')
      break
  }

  if (opts.emotion && opts.emotion !== 'neutral') {
    parts.push(`Emotional direction: ${opts.emotion}. Let that feeling influence pace, tone, and emphasis without overacting.`)
  }

  if (opts.style && opts.style !== 'default') {
    parts.push(`Style direction: ${opts.style}. Reflect the style in cadence while keeping the words unchanged.`)
  }

  return parts.join(' ')
}

function clampSpeed(value: number): number {
  return Math.min(Math.max(value, 0.7), 1.2)
}

function getElevenLabsVoiceSettings(opts: {
  speed: number
  blockType?: string
  emotion?: string
}) {
  let speed = clampSpeed(opts.speed)
  let stability = 0.5
  let style = 0.35

  if (opts.blockType === 'dialogue') {
    stability = 0.44
    style = 0.42
  } else if (opts.blockType === 'thought') {
    speed -= 0.04
    stability = 0.55
    style = 0.3
  } else if (opts.blockType === 'quote') {
    speed -= 0.05
    stability = 0.58
    style = 0.28
  } else {
    stability = 0.52
    style = 0.32
  }

  switch (opts.emotion) {
    case 'sad':
    case 'worried':
    case 'scared':
    case 'mysterious':
      speed -= 0.04
      stability += 0.04
      style += 0.04
      break
    case 'angry':
    case 'excited':
    case 'surprised':
      speed += 0.02
      stability -= 0.04
      style += 0.08
      break
    case 'happy':
      speed += 0.01
      style += 0.04
      break
  }

  return {
    stability: Math.min(Math.max(stability, 0.25), 0.75),
    similarity_boost: 0.8,
    style: Math.min(Math.max(style, 0), 0.65),
    use_speaker_boost: true,
    speed: clampSpeed(speed),
  }
}

const ELEVENLABS_PERFORMANCE_TAGS = new Set([
  '[whispers]',
  '[laughs]',
  '[chuckles]',
  '[sighs]',
  '[gasps]',
  '[crying]',
  '[excited]',
  '[curious]',
  '[mischievously]',
  '[short pause]',
  '[long pause]',
])

function normalizeElevenLabsPerformanceTag(value?: string): string | undefined {
  const tag = value?.trim().toLowerCase()
  if (!tag) return undefined
  return ELEVENLABS_PERFORMANCE_TAGS.has(tag) ? tag : undefined
}

function buildGeminiPrompt(opts: {
  text: string
  voiceId?: string
  blockType?: string
  emotion?: string
  style?: string
  voiceLabel?: string
  performanceTag?: string
  characterName?: string
  speed?: number
}) {
  const voice = getGeminiVoice(opts.voiceId)
  const characterName = opts.characterName?.trim() || 'Character'
  const pacing = typeof opts.speed === 'number' && opts.speed < 0.9
    ? 'slow, measured, with natural pauses'
    : typeof opts.speed === 'number' && opts.speed > 1.03
      ? 'lively and quick, but still clearly articulated'
      : 'natural story dialogue pace'
  const tag = opts.performanceTag?.trim()
  const transcript = tag ? `${tag} ${opts.text.trim()}` : opts.text.trim()

  const directions = [
    `Synthesize speech for PageCast. Speak only the transcript, not these directions.`,
    `# AUDIO PROFILE: ${characterName}`,
    voice.castingNote,
    opts.voiceLabel ? `Casting label: ${opts.voiceLabel}.` : '',
    `Block type: ${opts.blockType ?? 'narration'}.`,
    opts.emotion && opts.emotion !== 'neutral' ? `Emotion: ${opts.emotion}. Let it affect tone, emphasis, and pacing naturally.` : '',
    opts.style && opts.style !== 'default' ? `Style: ${opts.style}.` : '',
    `Pacing: ${pacing}.`,
    `Director notes: keep the voice consistent, expressive, and age-appropriate. Do not read punctuation labels or stage directions aloud.`,
    `# TRANSCRIPT`,
    transcript,
  ]

  return directions.filter(Boolean).join('\n')
}

function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44)
  const byteRate = sampleRate * channels * bitsPerSample / 8
  const blockAlign = channels * bitsPerSample / 8

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)

  return Buffer.concat([header, pcm])
}


function getLocalQwenBaseUrl(): string {
  return (process.env.LOCAL_QWEN_TTS_URL ?? LOCAL_TTS_DEFAULT_URLS['local-qwen']).replace(/\/$/, '')
}

function getLocalChatterboxBaseUrl(): string {
  return (process.env.LOCAL_CHATTERBOX_TTS_URL ?? LOCAL_TTS_DEFAULT_URLS['local-chatterbox']).replace(/\/$/, '')
}

function buildLocalQwenDescription(opts: {
  voiceId?: string
  blockType?: string
  emotion?: string
  style?: string
  voiceLabel?: string
  performanceTag?: string
  characterName?: string
  speed?: number
}): string {
  return buildStorytellingInstructions(opts)
}

async function fetchLocalQwenTts(opts: {
  text: string
  voiceId: string
  speed: number
  blockType?: string
  emotion?: string
  style?: string
  voiceLabel?: string
  performanceTag?: string
  characterName?: string
  language?: string
}): Promise<Response> {
  const baseUrl = getLocalQwenBaseUrl()
  const modelSize = process.env.LOCAL_QWEN_MODEL_SIZE === '1.7B' ? '1.7B' : '0.6B'
  const res = await fetch(`${baseUrl}/pagecast/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: opts.text.trim(),
      voiceId: opts.voiceId,
      language: toQwenLanguage(opts.language ?? process.env.PAGECAST_DEFAULT_LANGUAGE),
      modelSize,
      voiceDescription: buildLocalQwenDescription(opts),
      temperature: 0.8,
      topP: 0.95,
      repetitionPenalty: 1.15,
      maxNewTokens: 2048,
    }),
  })

  if (!res.ok) throw new Error(await readLocalError(res, 'Local Qwen'))

  return res
}

/** Connection failures (engine not started) get an actionable message. */
function localFailureMessage(engine: string, baseUrl: string, e: any): string {
  const message = String(e?.message ?? 'request failed')
  if (message === 'fetch failed' || /ECONNREFUSED/i.test(String(e?.cause?.code ?? e?.cause ?? ''))) {
    return `${engine} is not reachable at ${baseUrl}. Start it on this machine and try again.`
  }
  return `${engine} request failed: ${message}`
}

async function readLocalError(res: Response, engine: string): Promise<string> {
  const raw = await res.text().catch(() => '')
  let detail = raw || `${engine} error ${res.status}`
  try {
    const parsed = JSON.parse(raw)
    detail = parsed?.detail ?? parsed?.error ?? detail
  } catch {}
  return typeof detail === 'string' ? detail : JSON.stringify(detail)
}

async function fetchLocalChatterboxTts(opts: {
  text: string
  voiceId: string
  language?: string
}): Promise<{ res: Response; voiceName: string }> {
  const voice = resolveChatterboxVoice(opts.voiceId)
  const language = toChatterboxLanguage(opts.language ?? process.env.PAGECAST_DEFAULT_LANGUAGE)
  // Temperature, exaggeration, CFG and seed are not sent, so the defaults the
  // creator tuned in the Chatterbox UI (config.yaml generation_defaults) apply.
  // Speed is intentionally not sent: speed_factor is a post-process time-stretch
  // that degrades quality, so Chatterbox renders at its natural pace.
  const res = await fetch(`${getLocalChatterboxBaseUrl()}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: opts.text.trim(),
      ...voice,
      output_format: 'wav',
      split_text: true,
      chunk_size: 240,
      ...(language ? { language } : {}),
    }),
  })

  if (!res.ok) throw new Error(await readLocalError(res, 'Local Chatterbox'))

  const file = voice.predefined_voice_id ?? voice.reference_audio_filename ?? ''
  const voiceName = `Chatterbox ${voice.voice_mode === 'clone' ? 'Clone' : 'Voice'} - ${file.replace(/\.[^.]+$/, '')}`
  return { res, voiceName }
}

/** Internal usage counter (profiles.tts_chars_used). Never blocks generation. */
async function recordTtsUsage(supabase: SupabaseClient, userId: string, chars: number): Promise<void> {
  try {
    await supabase.rpc('increment_tts_chars', { p_user_id: userId, p_chars: chars })
  } catch { /* non-blocking */ }
}

function getServerProviderApiKey(provider: string): string {
  if (provider === 'gemini') {
    return (
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_AI_API_KEY ??
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
      ''
    )
  }
  if (provider === 'elevenlabs') return process.env.ELEVENLABS_API_KEY ?? ''
  if (provider === 'openai') return process.env.OPENAI_API_KEY ?? ''
  return ''
}

export async function POST(req: NextRequest) {
  // Signed-in creators only: this route spends server-side provider keys and credits.
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response

  let body: {
    text: string
    voiceId?: string
    provider?: string
    apiKey?: string
    speed?: number
    blockType?: string
    emotion?: string
    style?: string
    voiceLabel?: string
    performanceTag?: string
    characterName?: string
    geminiModel?: GeminiTtsModel
    language?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    text,
    voiceId = 'ai_female_soft',
    provider = 'openai',
    apiKey,
    speed = 0.95,
    blockType,
    emotion,
    style,
    voiceLabel,
    performanceTag,
    characterName,
    geminiModel,
    language,
  } = body

  if (!text?.trim()) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }
  const providerApiKey = apiKey?.trim() || getServerProviderApiKey(provider)
  if (!isLocalTtsProvider(provider) && !providerApiKey) {
    return NextResponse.json({ error: 'No API key provided — add your key in Settings.' }, { status: 400 })
  }

  if (provider === 'local-qwen') {
    let qwenRes: Response
    try {
      qwenRes = await fetchLocalQwenTts({ text, voiceId, speed, blockType, emotion, style, voiceLabel, performanceTag, characterName, language })
    } catch (e: any) {
      return NextResponse.json({ error: localFailureMessage('Local Qwen Voice Studio', getLocalQwenBaseUrl(), e) }, { status: 502 })
    }

    const audioBuffer = await qwenRes.arrayBuffer()

    await recordTtsUsage(auth.supabase, auth.user.id, text.trim().length)

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type':   qwenRes.headers.get('Content-Type') ?? 'audio/wav',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control':  'no-store',
        'X-Chars-Used':   String(text.trim().length),
        'X-TTS-Provider': 'Local Qwen',
        'X-TTS-Voice':    qwenRes.headers.get('X-TTS-Voice') ?? voiceLabel ?? voiceId,
      },
    })
  }

  if (provider === 'local-chatterbox') {
    let chatterbox: { res: Response; voiceName: string }
    try {
      chatterbox = await fetchLocalChatterboxTts({ text, voiceId, language })
    } catch (e: any) {
      return NextResponse.json({ error: localFailureMessage('Local Chatterbox TTS Server', getLocalChatterboxBaseUrl(), e) }, { status: 502 })
    }

    const audioBuffer = await chatterbox.res.arrayBuffer()

    await recordTtsUsage(auth.supabase, auth.user.id, text.trim().length)

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type':   chatterbox.res.headers.get('Content-Type') ?? 'audio/wav',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control':  'no-store',
        'X-Chars-Used':   String(text.trim().length),
        'X-TTS-Provider': 'Local Chatterbox',
        'X-TTS-Voice':    chatterbox.voiceName,
      },
    })
  }

  // ── OpenAI TTS ──────────────────────────────────────────────────────────────
  if (provider === 'openai') {
    const openaiVoice = getOpenAiVoiceForVoiceId(voiceId)
    const instructions = buildStorytellingInstructions({ voiceId, blockType, emotion, style, voiceLabel })

    let res: Response
    try {
      res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${providerApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model:           'gpt-4o-mini-tts',
          input:           text.trim(),
          voice:           openaiVoice,
          instructions,
          speed:           Math.min(Math.max(speed, 0.25), 4.0),
          response_format: 'mp3',
        }),
      })
    } catch (e: any) {
      return NextResponse.json({ error: `OpenAI request failed: ${e.message}` }, { status: 502 })
    }

    if (!res.ok) {
      const errText = await res.text()
      let errMsg = `OpenAI error ${res.status}`
      try { errMsg = JSON.parse(errText)?.error?.message ?? errMsg } catch {}
      return NextResponse.json({ error: errMsg }, { status: res.status })
    }

    const audioBuffer = await res.arrayBuffer()

    // Track TTS credit usage (fire-and-forget)
    await recordTtsUsage(auth.supabase, auth.user.id, text.trim().length)

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type':   'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control':  'no-store',
        'X-Chars-Used':   String(text.trim().length),
        'X-TTS-Provider': 'OpenAI',
        'X-TTS-Voice':    openaiVoice,
      },
    })
  }

  // ── ElevenLabs TTS ──────────────────────────────────────────────────────────
  if (provider === 'elevenlabs') {
    let elevenVoice: { id: string; name: string }
    try {
      elevenVoice = await resolveElevenLabsVoice(providerApiKey, voiceId)
    } catch (e: any) {
      return NextResponse.json({ error: e.message ?? 'Could not load ElevenLabs voices' }, { status: 502 })
    }

    let res: Response
    const cleanPerformanceTag = normalizeElevenLabsPerformanceTag(performanceTag)
    const elevenText = cleanPerformanceTag
      ? `${cleanPerformanceTag} ${text.trim()}`
      : text.trim()

    try {
      res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenVoice.id}`, {
        method: 'POST',
        headers: {
          'xi-api-key':   providerApiKey,
          'Content-Type': 'application/json',
          Accept:         'audio/mpeg',
        },
        body: JSON.stringify({
          text: elevenText,
          model_id: 'eleven_v3',
          voice_settings: getElevenLabsVoiceSettings({ speed, blockType, emotion }),
        }),
      })
    } catch (e: any) {
      return NextResponse.json({ error: `ElevenLabs request failed: ${e.message}` }, { status: 502 })
    }

    if (!res.ok) {
      const errText = await res.text()
      let errMsg = `ElevenLabs error ${res.status}`
      try { errMsg = JSON.parse(errText)?.detail?.message ?? errMsg } catch {}
      return NextResponse.json({ error: errMsg }, { status: res.status })
    }

    const audioBuffer = await res.arrayBuffer()

    // Track TTS credit usage (fire-and-forget)
    await recordTtsUsage(auth.supabase, auth.user.id, text.trim().length)

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type':   'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control':  'no-store',
        'X-Chars-Used':   String(text.trim().length),
        'X-TTS-Provider': 'ElevenLabs',
        'X-TTS-Voice':    voiceLabel?.replace(/^ElevenLabs - /, '') ?? elevenVoice.name,
      },
    })
  }

  if (provider === 'gemini') {
    const geminiVoice = getGeminiVoice(voiceId)
    const model = normalizeGeminiTtsModel(geminiModel)
    const prompt = buildGeminiPrompt({
      text,
      voiceId,
      blockType,
      emotion,
      style,
      voiceLabel,
      performanceTag,
      characterName,
      speed,
    })

    let res: Response
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'x-goog-api-key': providerApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: geminiVoice.voiceName,
                },
              },
            },
          },
          model,
        }),
      })
    } catch (e: any) {
      return NextResponse.json({ error: `Gemini request failed: ${e.message}` }, { status: 502 })
    }

    if (!res.ok) {
      const errText = await res.text()
      let errMsg = `Gemini error ${res.status}`
      try { errMsg = JSON.parse(errText)?.error?.message ?? errMsg } catch {}
      return NextResponse.json({ error: errMsg }, { status: res.status })
    }

    const payload = await res.json().catch(() => null)
    const base64Audio = payload?.candidates?.[0]?.content?.parts?.find((part: any) => part.inlineData || part.inline_data)?.inlineData?.data
      ?? payload?.candidates?.[0]?.content?.parts?.find((part: any) => part.inlineData || part.inline_data)?.inline_data?.data

    if (!base64Audio) {
      return NextResponse.json({ error: 'Gemini did not return audio. Try again or simplify the prompt.' }, { status: 502 })
    }

    const audioBuffer = pcmToWav(Buffer.from(base64Audio, 'base64'))

    await recordTtsUsage(auth.supabase, auth.user.id, text.trim().length)

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type':   'audio/wav',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control':  'no-store',
        'X-Chars-Used':   String(text.trim().length),
        'X-TTS-Provider': 'Gemini',
        'X-TTS-Voice':    `${geminiVoice.label} / ${model}`,
      },
    })
  }

  return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
}
