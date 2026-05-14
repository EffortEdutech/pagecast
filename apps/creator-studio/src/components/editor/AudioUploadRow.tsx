'use client'
import { useRef, useState, useEffect } from 'react'
import { Upload, Play, Pause, Trash2, Loader2, AlertCircle, Wand2, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadBlockAudio, deleteBlockAudio } from '@/lib/supabase/storage'
import { generateBlockTts, getTtsSettings } from '@/lib/tts'
import { getOpenAiVoiceForVoiceId, getPageCastVoice } from '@/lib/voiceLibrary'
import type { StoryBlock } from '@/types'

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

function getDefaultTtsSpeed(block: StoryBlock, voiceId: string): number {
  if (typeof block.voiceSpeed === 'number') return block.voiceSpeed
  if (voiceId.startsWith('elevenlabs:') && block.type === 'dialogue') return 0.88
  return getPageCastVoice(voiceId).rate
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

  // ── Freeze badge info at generation time ────────────────────────────────────
  // Shows which voice was actually used, independent of current dropdown state
  const [genInfo, setGenInfo] = useState<{ label: string; openai: string } | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
    setHasTtsKey(!!getTtsSettings().apiKey)
  }, [])

  useEffect(() => { return () => { audioRef.current?.pause() } }, [block.audioUrl])

  useEffect(() => {
    audioRef.current?.pause()
    audioRef.current = null
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [block.audioUrl])

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
    const effectiveOpenAi     = getOpenAiVoiceForVoiceId(effectiveVoiceId)
    const effectiveVoiceLabel = voiceLabel ?? effectiveOpenAi

    const { url, error, provider, providerVoice } = await generateBlockTts({
      text,
      voiceId: effectiveVoiceId,
      userId,
      bookId,
      blockId: block.id,
      speed: getDefaultTtsSpeed(block, effectiveVoiceId),
      blockType: block.type,
      emotion: 'emotion' in block ? (block as any).emotion : undefined,
      style: 'style' in block ? (block as any).style : undefined,
      voiceLabel: effectiveVoiceLabel,
      performanceTag: block.performanceTag,
    })

    if (url) {
      onUpdate({ audioUrl: url } as Partial<StoryBlock>)
      // Freeze the badge at the voice used for this generation
      setGenInfo({ label: effectiveVoiceLabel, openai: providerVoice ? `${provider ?? 'TTS'} ${providerVoice}` : effectiveOpenAi })
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
  const selectedProvider = getTtsSettings().provider
  const isElevenLabsVoice = voiceId?.startsWith('elevenlabs:') || selectedProvider === 'elevenlabs'
  const openaiVoice = getOpenAiVoiceForVoiceId(voiceId)
  const providerBadge = isElevenLabsVoice
    ? (voiceId?.startsWith('elevenlabs:') ? 'ElevenLabs v3 exact voice' : 'ElevenLabs v3')
    : `OpenAI ${openaiVoice}`

  // Voices not loaded yet?

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
            className="btn-ghost text-xs px-2 py-1 border border-bg-border hover:border-gold/50 hover:text-gold disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleGenerate}
            disabled={!canGenerate}
            title={
              !hasTtsKey
                ? 'Add your OpenAI / ElevenLabs key in Settings'
                : !blockText.trim()
                  ? 'Add text first'
                  : `Generate AI voice · ${providerBadge}${voiceLabel ? ` · ${voiceLabel}` : ''}`
            }
          >
            <Wand2 size={11} /> Generate
          </button>

          {/* Pre-generation voice badge — shows what WILL be used */}
          {voiceLabel && (
            <span className="text-[10px] text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded border border-bg-border">
              {voiceLabel} <span className="opacity-40">→ {providerBadge}</span>
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

        <p className="text-[10px] text-text-muted">
          Generate audio to hear this beat with the selected cast voice.
        </p>

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
        Generating · {providerBadge}{voiceLabel ? ` · ${voiceLabel}` : ''}…
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
          <span className="opacity-40">· {genInfo.openai}</span>
        </p>
      ) : block.audioUrl && voiceLabel ? (
        <p className="text-[10px] text-text-muted">
          {voiceLabel} <span className="opacity-40">· {providerBadge}</span>
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
            title={`Re-generate · ${providerBadge}${voiceLabel ? ` · ${voiceLabel}` : ''}`}
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
