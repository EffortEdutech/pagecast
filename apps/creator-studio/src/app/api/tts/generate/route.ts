import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Maps internal PageCast voice IDs → OpenAI TTS voice names.
 * OpenAI voices: alloy | echo | fable | onyx | nova | shimmer
 */
const OPENAI_VOICE_MAP: Record<string, string> = {
  // Narrator voices
  ai_narrator_warm:  'fable',   // warm, storytelling male
  ai_narrator_deep:  'onyx',    // deep authoritative male
  // Female voices
  ai_female_soft:    'nova',
  ai_female_warm:    'shimmer',
  ai_child_female:   'nova',
  ai_elder_female:   'shimmer',
  ai_fantasy:        'nova',
  // Male voices
  ai_male_deep:      'onyx',
  ai_male_calm:      'echo',
  ai_male_gruff:     'onyx',    // closest deep/gruff voice
  ai_child_male:     'echo',
  ai_elder_male:     'fable',
  ai_villain:        'onyx',
  ai_dramatic:       'fable',
  // Neutral / character voices
  ai_whisper:        'echo',
  ai_cartoon:        'alloy',
  ai_robot:          'alloy',
}

export async function POST(req: NextRequest) {
  let body: {
    text: string
    voiceId?: string
    provider?: string
    apiKey: string
    speed?: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { text, voiceId = 'ai_female_soft', provider = 'openai', apiKey, speed = 1.0 } = body

  if (!text?.trim()) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 })
  }
  if (!apiKey?.trim()) {
    return NextResponse.json({ error: 'No API key provided — add your key in Settings.' }, { status: 400 })
  }

  // ── OpenAI TTS ──────────────────────────────────────────────────────────────
  if (provider === 'openai') {
    const openaiVoice = OPENAI_VOICE_MAP[voiceId] ?? 'nova'

    let res: Response
    try {
      res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model:           'tts-1',
          input:           text.trim(),
          voice:           openaiVoice,
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
      },
    })
  }

  // ── ElevenLabs TTS ──────────────────────────────────────────────────────────
  if (provider === 'elevenlabs') {
    // For ElevenLabs, voiceId should be the user's actual ElevenLabs voice ID.
    // Fall back to a known public voice if the internal mapping is used.
    const EL_FALLBACK = 'EXAVITQu4vr4xnSDxMaL' // "Bella" — common starter voice
    const elVoiceId = voiceId.startsWith('ai_') ? EL_FALLBACK : voiceId

    let res: Response
    try {
      res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elVoiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key':   apiKey,
          'Content-Type': 'application/json',
          Accept:         'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability:        0.5,
            similarity_boost: 0.75,
            style:            0.3,
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
      },
    })
  }

  return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
}
