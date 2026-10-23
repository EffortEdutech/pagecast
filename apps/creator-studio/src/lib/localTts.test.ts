import { describe, expect, it } from 'vitest'
import {
  chatterboxVoicesFromServer,
  isLocalTtsProvider,
  providerFromVoiceId,
  qwenCloneVoicesFromLibrary,
  qwenVoicesFromHealth,
  resolveChatterboxVoice,
  toChatterboxLanguage,
  toQwenLanguage,
} from './localTts'

describe('providerFromVoiceId', () => {
  it('maps prefixed voice ids to providers', () => {
    expect(providerFromVoiceId('elevenlabs:abc')).toBe('elevenlabs')
    expect(providerFromVoiceId('gemini:Kore')).toBe('gemini')
    expect(providerFromVoiceId('qwen:Ryan')).toBe('local-qwen')
    expect(providerFromVoiceId('qwen:clone:Freeman')).toBe('local-qwen')
    expect(providerFromVoiceId('chatterbox:Emily.wav')).toBe('local-chatterbox')
    expect(providerFromVoiceId('chatterbox:clone:Syamsuri15s.mp3')).toBe('local-chatterbox')
  })

  it('returns null for PageCast presets and empty ids', () => {
    expect(providerFromVoiceId('ai_female_soft')).toBeNull()
    expect(providerFromVoiceId(undefined)).toBeNull()
    expect(providerFromVoiceId('')).toBeNull()
  })
})

describe('isLocalTtsProvider', () => {
  it('only accepts the two local engines', () => {
    expect(isLocalTtsProvider('local-qwen')).toBe(true)
    expect(isLocalTtsProvider('local-chatterbox')).toBe(true)
    expect(isLocalTtsProvider('gemini')).toBe(false)
    expect(isLocalTtsProvider(null)).toBe(false)
  })
})

describe('resolveChatterboxVoice', () => {
  it('uses predefined mode for chatterbox:<file>', () => {
    expect(resolveChatterboxVoice('chatterbox:Emily.wav')).toEqual({
      voice_mode: 'predefined',
      predefined_voice_id: 'Emily.wav',
    })
  })

  it('uses clone mode for chatterbox:clone:<file>', () => {
    expect(resolveChatterboxVoice('chatterbox:clone:Syamsuri15s.mp3')).toEqual({
      voice_mode: 'clone',
      reference_audio_filename: 'Syamsuri15s.mp3',
    })
  })

  it('maps PageCast presets to a predefined voice and falls back to Emily', () => {
    expect(resolveChatterboxVoice('ai_narrator_deep').predefined_voice_id).toBe('Henry.wav')
    expect(resolveChatterboxVoice('ai_unknown').predefined_voice_id).toBe('Emily.wav')
    expect(resolveChatterboxVoice('chatterbox:').predefined_voice_id).toBe('Emily.wav')
  })
})

describe('language mapping', () => {
  it('maps story codes to Chatterbox codes', () => {
    expect(toChatterboxLanguage('ms')).toBe('ms')
    expect(toChatterboxLanguage('en')).toBe('en')
    expect(toChatterboxLanguage('id')).toBe('ms')
    expect(toChatterboxLanguage('zh-CN')).toBe('zh')
    expect(toChatterboxLanguage('ta')).toBeUndefined()
    expect(toChatterboxLanguage(undefined)).toBeUndefined()
  })

  it('maps story codes to Qwen language names', () => {
    expect(toQwenLanguage('zh')).toBe('Chinese')
    expect(toQwenLanguage('ja')).toBe('Japanese')
    expect(toQwenLanguage('ms')).toBe('English')
    expect(toQwenLanguage(undefined)).toBe('English')
  })
})

describe('voice listing normalisation', () => {
  it('builds Qwen voices from /pagecast/health', () => {
    const voices = qwenVoicesFromHealth({ ok: true, speakers: ['Ryan', 'Uncle_fu', ''] })
    expect(voices.map(v => v.id)).toEqual(['qwen:Ryan', 'qwen:Uncle_fu'])
    expect(voices[1].label).toBe('Uncle fu')
    expect(qwenVoicesFromHealth(null)).toEqual([])
  })

  it('builds Qwen clone voices from /pagecast/voices, skipping unusable entries', () => {
    const voices = qwenCloneVoicesFromLibrary({
      voices: [
        { name: 'Syamsuri', usable: true, language: 'Auto', source: 'clone' },
        { name: 'Panicy Woman', usable: true, language: 'English', source: 'voice_design' },
        { name: 'No Text', usable: false },
        { name: '', usable: true },
      ],
    })
    expect(voices).toEqual([
      expect.objectContaining({ id: 'qwen:clone:Syamsuri', label: 'Syamsuri', kind: 'clone', provider: 'local-qwen' }),
      expect.objectContaining({ id: 'qwen:clone:Panicy Woman', description: 'Qwen voice library / designed voice / English' }),
    ])
    expect(qwenCloneVoicesFromLibrary({ detail: 'Not Found' })).toEqual([])
    // Round-trips through the provider resolver
    expect(providerFromVoiceId(voices[0].id)).toBe('local-qwen')
  })

  it('builds Chatterbox predefined + clone voices', () => {
    const voices = chatterboxVoicesFromServer(
      [{ display_name: 'Emily', filename: 'Emily.wav' }, { filename: 'Henry.wav' }, { display_name: 'Bad' }],
      ['Syamsuri15s.mp3', 42],
    )
    expect(voices).toEqual([
      expect.objectContaining({ id: 'chatterbox:Emily.wav', label: 'Emily', kind: 'builtin' }),
      expect.objectContaining({ id: 'chatterbox:Henry.wav', label: 'Henry', kind: 'builtin' }),
      expect.objectContaining({ id: 'chatterbox:clone:Syamsuri15s.mp3', label: 'Syamsuri15s', kind: 'clone' }),
    ])
  })
})
