import { NextRequest, NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/supabase/apiAuth'
import {
  LOCAL_TTS_DEFAULT_URLS,
  LOCAL_TTS_LABELS,
  chatterboxVoicesFromServer,
  qwenCloneVoicesFromLibrary,
  qwenVoicesFromHealth,
  type LocalTtsProvider,
} from '@/lib/localTts'

export const runtime = 'nodejs'

const LOCAL_TIMEOUT_MS = 5000

function localBaseUrl(provider: LocalTtsProvider): string {
  const configured = provider === 'local-qwen'
    ? process.env.LOCAL_QWEN_TTS_URL
    : process.env.LOCAL_CHATTERBOX_TTS_URL
  return (configured ?? LOCAL_TTS_DEFAULT_URLS[provider]).replace(/\/$/, '')
}

async function getLocalJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(LOCAL_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  return res.json()
}

async function listLocalVoices(provider: LocalTtsProvider) {
  const baseUrl = localBaseUrl(provider)
  try {
    const voices = provider === 'local-qwen'
      ? [
          ...qwenVoicesFromHealth(await getLocalJson(`${baseUrl}/pagecast/health`)),
          // Voice-library clones; older Qwen apps without this endpoint just list built-ins.
          ...qwenCloneVoicesFromLibrary(await getLocalJson(`${baseUrl}/pagecast/voices`).catch(() => null)),
        ]
      : chatterboxVoicesFromServer(
          await getLocalJson(`${baseUrl}/get_predefined_voices`),
          await getLocalJson(`${baseUrl}/get_reference_files`).catch(() => []),
        )
    return NextResponse.json({ voices, baseUrl })
  } catch (e: any) {
    return NextResponse.json(
      { error: `${LOCAL_TTS_LABELS[provider]} is not reachable at ${baseUrl} — start it, then sync again. (${e?.message ?? 'request failed'})` },
      { status: 502 },
    )
  }
}

interface ElevenLabsVoice {
  voice_id: string
  name: string
  category?: string
  description?: string
  labels?: Record<string, string>
  preview_url?: string
}

export async function POST(req: NextRequest) {
  const auth = await requireApiUser()
  if (!auth.ok) return auth.response

  let body: { provider?: string; apiKey?: string }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const provider = body.provider ?? 'elevenlabs'
  const apiKey = body.apiKey ?? ''

  if (provider === 'local-qwen' || provider === 'local-chatterbox') {
    return listLocalVoices(provider)
  }

  if (provider !== 'elevenlabs') {
    return NextResponse.json({ error: `Voice sync is not available for provider: ${provider}` }, { status: 400 })
  }

  if (!apiKey.trim()) {
    return NextResponse.json({ error: 'No ElevenLabs API key provided.' }, { status: 400 })
  }

  let res: Response
  try {
    res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
      cache: 'no-store',
    })
  } catch (e: any) {
    return NextResponse.json({ error: `ElevenLabs voices request failed: ${e.message}` }, { status: 502 })
  }

  if (!res.ok) {
    const errText = await res.text()
    let errMsg = `ElevenLabs voices error ${res.status}`
    try { errMsg = JSON.parse(errText)?.detail?.message ?? errMsg } catch {}
    return NextResponse.json({ error: errMsg }, { status: res.status })
  }

  const data = await res.json()
  const voices = Array.isArray(data?.voices) ? data.voices as ElevenLabsVoice[] : []

  return NextResponse.json({
    voices: voices.map(voice => ({
      id: voice.voice_id,
      label: voice.name,
      provider: 'elevenlabs',
      category: voice.category ?? 'voice',
      description: voice.description ?? '',
      labels: voice.labels ?? {},
      previewUrl: voice.preview_url ?? null,
    })),
  })
}

