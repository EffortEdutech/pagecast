import { NextRequest, NextResponse } from 'next/server'

interface ElevenLabsVoice {
  voice_id: string
  name: string
  category?: string
  description?: string
  labels?: Record<string, string>
  preview_url?: string
}

export async function POST(req: NextRequest) {
  let body: { provider?: string; apiKey?: string }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const provider = body.provider ?? 'elevenlabs'
  const apiKey = body.apiKey ?? ''

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

