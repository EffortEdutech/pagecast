'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { Upload, Play, Pause, Trash2, Loader2, AlertCircle, Wand2, RefreshCw, Mic } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadBlockAudio, deleteBlockAudio } from '@/lib/supabase/storage'
import { generateBlockTts, getTtsSettings } from '@/lib/tts'
import type { StoryBlock } from '@/types'

// Maps internal voiceId → browser speech characteristics
const VOICE_META: Record<string, { pitch: number; rate: number; female: boolean }> = {
  ai_narrator_warm: { pitch: 1.0,  rate: 0.88, female: false },
  ai_narrator_deep: { pitch: 0.8,  rate: 0.85, female: false },
  ai_female_soft:   { pitch: 1.2,  rate: 0.9,  female: true  },
  ai_female_warm:   { pitch: 1.1,  rate: 1.0,  female: true  },
  ai_male_deep:     { pitch: 0.7,  rate: 0.9,  female: false },
  ai_male_calm:     { pitch: 0.9,  rate: 0.95, female: false },
  ai_male_gruff:    { pitch: 0.65, rate: 0.92, female: false },
  ai_child_female:  { pitch: 1.4,  rate: 1.05, female: true  },
  ai_child_male:    { pitch: 1.3,  rate: 1.05, female: false },
  ai_elder_female:  { pitch: 1.0,  rate: 0.85, female: true  },
  ai_elder_male:    { pitch: 0.75, rate: 0.85, female: false },
  ai_villain:       { pitch: 0.6,  rate: 0.88, female: false },
  ai_whisper:       { pitch: 1.0,  rate: 0.75, female: false },
  ai_dramatic:      { pitch: 0.85, rate: 0.9,  female: false },
  ai_cartoon:       { pitch: 1.3,  rate: 1.1,  female: false },
  ai_robot:         { pitch: 0.7,  rate: 1.15, female: false },
  ai_fantasy:       { pitch: 1.15, rate: 0.88, female: true  },
}

const OPENAI_VOICE_MAP: Record<string, string> = {
  ai_narrator_warm: 'fable',  ai_narrator_deep: 'onyx',
  ai_female_soft:   'nova',   ai_female_warm:   'shimmer',
  ai_male_deep:     'onyx',   ai_male_calm:     'echo',
  ai_male_gruff:    'onyx',   ai_child_female:  'nova',
  ai_child_male:    'echo',   ai_elder_female:  'shimmer',
  ai_elder_male:    'fable',  ai_villain:       'onyx',
  ai_whisper:       'echo',   ai_dramatic:      'fable',
  ai_cartoon:       'alloy',  ai_robot:         'alloy',
  ai_fantasy:       'nova',
}

// Female/male name hints for browser voice matching
const FEMALE_HINTS = ['female','woman','samantha','victoria','karen','moira','fiona',
  'allison','ava','susan','nicky','tessa','veena','zira','hazel','linda',
  'aria','jenny','emma','nora','nara','siri','serena','kyoko','mei']
const MALE_HINTS   = ['male','man','daniel','david','mark','alex','fred','junior',
  'reed','thomas','rishi','guy','ryan','steffan','james','liam','lee','bruce']

function pickVoice(voices: SpeechSynthesisVoice[], voiceId: string | undefined): SpeechSynthesisVoice | null {
  const en = voices.filter(v => v.lang.startsWith('en'))
  const pool = en.length ? en : voices
  if (!pool.length) return null

  const meta      = voiceId ? VOICE_META[voiceId] : undefined
  const wantFemale = meta?.female ?? true  // default female when unknown

  const hints   = wantFemale ? FEMALE_HINTS : MALE_HINTS
  const matched = pool.filter(v => hints.some(h => v.name.toLowerCase().includes(h)))
  return matched[0] ?? pool[0]
}

interface AudioUploadRowProps {
  block:       StoryBlock
  bookId:      string
  voiceId?:    string   // e.g. 'ai_female_soft'
  voiceLabel?: string   // e.g. 'Nova · Aria — Female Soft'
  onUpdate:    (updates: Partial<StoryBlock>) => void
}

function formatTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function getBlockText(block: StoryBlock): string {
  return 'text' in block ? (block as any).text ?? '' : ''
}

export function AudioUploadRow({ block, bookId, voiceId, voiceLabel, onUpdate }: AudioUploadRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef     = useRef<HTMLAudioElement | null>(null)

  const [uploading,    setUploading]    = useState(false)
  const [generating,   setGenerating]   = useState(false)
  const [actionError,  setActionError]  = useState<string | null>(null)
  const [isPlaying,    setIsPlaying]    = useState(false)
  const [currentTime,  setCurrentTime]  = useState(0)
  const [duration,     setDuration]     = useState(0)
  const [userId,       setUserId]       = useState<string | null>(null)
  const [hasTtsKey,    setHasTtsKey]    = useState(false)
  const [isSpeaking,   setIsSpeaking]   = useState(false)

  // ── Load browser voices asynchronously (fixes: always plays Nara) ──────────
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([])
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const load = () => setBrowserVoices(window.speechSynthesis.getVoices())
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  // ── Freeze badge info at generation time ────────────────────────────────────
  // Shows which voice was actually used, independent of current dropdown state
  const [genInfo, setGenInfo] = useState<{ label: string; openai: string } | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
    setHasTtsKey(!!getTtsSettings().apiKey)
  }, [])

  // ── Browser preview — uses loaded voices + gender matching ─────────────────
  const speakPreview = useCallback(() => {
    if (!('speechSynthesis' in window)) return
    const text = getBlockText(block)
    if (!text.trim()) return

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)

    const meta = voiceId ? VOICE_META[voiceId] : undefined
    utt.rate   = meta?.rate  ?? 0.95
    utt.pitch  = meta?.pitch ?? 1.0
    utt.volume = 1

    // Use the pre-loaded voice list (empty list = API not ready yet)
    const picked = pickVoice(browserVoices, voiceId)
    if (picked) utt.voice = picked

    utt.onend   = () => setIsSpeaking(false)
    utt.onerror = () => setIsSpeaking(false)
    setIsSpeaking(true)
    window.speechSynthesis.speak(utt)
  }, [block, voiceId, isSpeaking, browserVoices])

  useEffect(() => { return () => { audioRef.current?.pause() } }, [block.audioUrl])

  // ── Upload ──────────────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploading(true); setActionError(null)
    const url = await uploadBlockAudio(userId, bookId, block.id, file)
    url ? onUpdate({ audioUrl: url } as Partial<StoryBlock>)
        : setActionError('Upload failed — check storage bucket & RLS policies.')
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── TTS Generate ────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!userId) return
    const text = getBlockText(block)
    if (!text.trim()) { setActionError('Add text to this block before generating audio.'); return }

    setGenerating(true); setActionError(null)
    const fresh = getTtsSettings()
    setHasTtsKey(!!fresh.apiKey)

    const effectiveVoiceId    = voiceId    ?? 'ai_female_soft'
    const effectiveOpenAi     = OPENAI_VOICE_MAP[effectiveVoiceId] ?? 'nova'
    const effectiveVoiceLabel = voiceLabel ?? effectiveOpenAi

    const { url, error } = await generateBlockTts({
      text, voiceId: effectiveVoiceId, userId, bookId, blockId: block.id,
    })

    if (url) {
      onUpdate({ audioUrl: url } as Partial<StoryBlock>)
      // Freeze the badge at the voice used for this generation
      setGenInfo({ label: effectiveVoiceLabel, openai: effectiveOpenAi })
    } else {
      setActionError(error ?? 'Generation failed.')
    }
    setGenerating(false)
  }

  const handleDelete = async () => {
    if (!userId || !block.audioUrl) return
    audioRef.current?.pause(); setIsPlaying(false)
    await deleteBlockAudio(userId, bookId, block.id)
    onUpdate({ audioUrl: undefined } as Partial<StoryBlock>)
    setCurrentTime(0); setDuration(0)
    setGenInfo(null)  // clear frozen badge
  }

  // ── Mini player ─────────────────────────────────────────────────────────────
  const initAudio = () => {
    if (audioRef.current || !block.audioUrl) return
    const audio = new Audio(block.audioUrl)
    audio.onloadedmetadata = () => setDuration(audio.duration)
    audio.ontimeupdate     = () => setCurrentTime(audio.currentTime)
    audio.onended          = () => { setIsPlaying(false); setCurrentTime(0) }
    audioRef.current = audio
  }

  const togglePlay = () => {
    if (!block.audioUrl) return
    initAudio()
    const audio = audioRef.current!
    if (isPlaying) { audio.pause(); setIsPlaying(false) }
    else           { audio.play();  setIsPlaying(true)  }
  }

  const progress    = duration > 0 ? (currentTime / duration) * 100 : 0
  const blockText   = getBlockText(block)
  const canGenerate = !!blockText.trim() && !!userId
  const openaiVoice = OPENAI_VOICE_MAP[voiceId ?? ''] ?? 'nova'

  // Voices not loaded yet?
  const voicesReady = browserVoices.length > 0

  // ── No audio yet ──────────────────────────────────────────────────────────
  if (!block.audioUrl && !uploading && !generating) {
    return (
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />

          <button
            className="btn-ghost text-xs px-2 py-1 border border-bg-border hover:border-accent/40"
            onClick={() => fileInputRef.current?.click()}
            disabled={!userId}
          >
            <Upload size={11} /> Upload
          </button>

          <button
            className={`btn-ghost text-xs px-2 py-1 border transition-colors ${
              isSpeaking
                ? 'border-info/60 text-info'
                : 'border-bg-border hover:border-info/50 hover:text-info'
            }`}
            onClick={speakPreview}
            disabled={!blockText.trim()}
            title={
              !voicesReady
                ? 'Browser voices still loading…'
                : isSpeaking
                  ? 'Stop preview'
                  : `Preview · ${voiceLabel ?? openaiVoice} (browser voice approximation)`
            }
          >
            {isSpeaking ? <Pause size={11} /> : <Mic size={11} />}
            {isSpeaking ? 'Stop' : voicesReady ? 'Preview' : 'Preview…'}
          </button>

          <button
            className="btn-ghost text-xs px-2 py-1 border border-bg-border hover:border-gold/50 hover:text-gold disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleGenerate}
            disabled={!canGenerate}
            title={
              !hasTtsKey
                ? 'Add your OpenAI / ElevenLabs key in Settings'
                : !blockText.trim()
                  ? 'Add text first'
                  : `Generate AI voice · OpenAI "${openaiVoice}"${voiceLabel ? ` · ${voiceLabel}` : ''}`
            }
          >
            <Wand2 size={11} /> Generate
          </button>

          {/* Pre-generation voice badge — shows what WILL be used */}
          {voiceLabel && (
            <span className="text-[10px] text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded border border-bg-border">
              {voiceLabel} <span className="opacity-40">→ {openaiVoice}</span>
            </span>
          )}

          {!actionError && !voiceLabel && (
            <span className="text-text-muted text-xs">No audio</span>
          )}
          {actionError && (
            <p className="text-danger text-xs flex items-center gap-1">
              <AlertCircle size={11} /> {actionError}
            </p>
          )}
        </div>

        {!hasTtsKey && !!blockText.trim() && (
          <p className="text-[10px] text-text-muted">
            No API key.{' '}
            <a href="/settings" className="text-accent underline underline-offset-2">Add in Settings</a>
            {' '}to enable AI generation.
          </p>
        )}
      </div>
    )
  }

  if (uploading) return (
    <div className="flex items-center gap-2 pt-1 text-text-muted text-xs">
      <Loader2 size={12} className="animate-spin text-accent" /> Uploading audio…
    </div>
  )

  if (generating) return (
    <div className="flex items-center gap-2 pt-1 text-text-muted text-xs">
      <Loader2 size={12} className="animate-spin text-gold" />
      <span className="text-gold">
        Generating · OpenAI "{openaiVoice}"{voiceLabel ? ` · ${voiceLabel}` : ''}…
      </span>
    </div>
  )

  // ── Mini player (audio exists) ────────────────────────────────────────────
  return (
    <div className="pt-1 space-y-1.5">

      {/* Frozen badge — shows the voice used when THIS audio was generated */}
      {genInfo ? (
        <p className="text-[10px] text-text-muted flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
          Generated with: <span className="text-text-secondary">{genInfo.label}</span>
          <span className="opacity-40">· OpenAI {genInfo.openai}</span>
        </p>
      ) : block.audioUrl && voiceLabel ? (
        <p className="text-[10px] text-text-muted">
          {voiceLabel} <span className="opacity-40">· OpenAI {openaiVoice}</span>
        </p>
      ) : null}

      {/* Progress bar */}
      <div
        className="w-full h-1 rounded-full bg-bg-border overflow-hidden cursor-pointer"
        onClick={e => {
          if (!audioRef.current || !duration) return
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration
        }}
      >
        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          className="w-6 h-6 rounded-full bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors shrink-0"
          onClick={togglePlay}
        >
          {isPlaying
            ? <Pause size={9} className="text-white" />
            : <Play  size={9} className="text-white ml-0.5" />}
        </button>

        <span className="text-[10px] text-text-muted tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div className="flex items-center gap-1 ml-auto">
          <button
            className="btn-ghost text-[10px] px-1.5 py-0.5 border border-bg-border hover:border-gold/40 hover:text-gold disabled:opacity-40"
            onClick={handleGenerate}
            disabled={!canGenerate || generating}
            title={`Re-generate · OpenAI "${openaiVoice}"${voiceLabel ? ` · ${voiceLabel}` : ''}`}
          >
            <RefreshCw size={9} /> Re-gen
          </button>
          <button
            className="btn-ghost text-[10px] px-1.5 py-0.5 border border-bg-border hover:border-danger/40 hover:text-danger"
            onClick={handleDelete}
            title="Remove audio"
          >
            <Trash2 size={9} />
          </button>
        </div>
      </div>

      {actionError && (
        <p className="text-danger text-[10px] flex items-center gap-1">
          <AlertCircle size={10} /> {actionError}
        </p>
      )}
    </div>
  )
}
