import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOpenAiVoiceForVoiceId, getPageCastVoice, getVoiceCastingInstruction } from '@/lib/voiceLibrary'

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

export async function POST(req: NextRequest) {
  let body: {
    text: string
    voiceId?: string
    provider?: string
    apiKey: string
    speed?: number
    blockType?: string
    emotion?: string
    style?: string
    voiceLabel?: string
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
  } = body

  if (!text?.trim()) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }
  if (!apiKey?.trim()) {
    return NextResponse.json({ error: 'No API key provided — add your key in Settings.' }, { status: 400 })
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
          Authorization:  `Bearer ${apiKey}`,
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
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.rpc('increment_tts_chars', {
          p_user_id: user.id,
          p_chars:   text.trim().length,
        })
      }
    } catch { /* non-blocking */ }

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
      elevenVoice = await resolveElevenLabsVoice(apiKey, voiceId)
    } catch (e: any) {
      return NextResponse.json({ error: e.message ?? 'Could not load ElevenLabs voices' }, { status: 502 })
    }

    let res: Response
    try {
      res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenVoice.id}`, {
        method: 'POST',
        headers: {
          'xi-api-key':   apiKey,
          'Content-Type': 'application/json',
          Accept:         'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability:        0.38,
            similarity_boost: 0.8,
            style:            0.65,
            use_speaker_boost: true,
          },
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
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.rpc('increment_tts_chars', {
          p_user_id: user.id,
          p_chars:   text.trim().length,
        })
      }
    } catch { /* non-blocking */ }

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

  return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
}
