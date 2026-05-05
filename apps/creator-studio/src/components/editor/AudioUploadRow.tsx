'use client'
import { useRef, useState, useEffect } from 'react'
import { Upload, Play, Pause, Trash2, Loader2, AlertCircle, Wand2, RefreshCw, Mic } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadBlockAudio, deleteBlockAudio } from '@/lib/supabase/storage'
import { generateBlockTts, getTtsSettings } from '@/lib/tts'
import type { StoryBlock } from '@/types'

interface AudioUploadRowProps {
  block:    StoryBlock
  bookId:   string
  voiceId?: string
  onUpdate: (updates: Partial<StoryBlock>) => void
}

function formatTime(s: number): string {
  const m   = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function getBlockText(block: StoryBlock): string {
  if ('text' in block) return (block as any).text ?? ''
  return ''
}

export function AudioUploadRow({ block, bookId, voiceId, onUpdate }: AudioUploadRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef     = useRef<HTMLAudioElement | null>(null)

  const [uploading,   setUploading]   = useState(false)
  const [generating,  setGenerating]  = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPlaying,   setIsPlaying]   = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(0)
  const [userId,      setUserId]      = useState<string | null>(null)
  const [hasTtsKey,   setHasTtsKey]   = useState(false)
  const [isSpeaking,  setIsSpeaking]  = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
    setHasTtsKey(!!getTtsSettings().apiKey)
  }, [])

  // -- Browser TTS preview (no API key needed) --

  const speakPreview = () => {
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
    utt.rate   = 0.95
    utt.pitch  = 1.0
    utt.volume = 1
    utt.onend  = () => setIsSpeaking(false)
    utt.onerror = () => setIsSpeaking(false)
    setIsSpeaking(true)
    window.speechSynthesis.speak(utt)
  }

  useEffect(() => {
    return () => { audioRef.current?.pause() }
  }, [block.audioUrl])

  // -- Upload --

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploading(true)
    setActionError(null)
    const url = await uploadBlockAudio(userId, bookId, block.id, file)
    if (url) {
      onUpdate({ audioUrl: url } as Partial<StoryBlock>)
    } else {
      setActionError('Upload failed -- check storage bucket & RLS policies.')
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // -- TTS Generate --

  const handleGenerate = async () => {
    if (!userId) return
    const text = getBlockText(block)
    if (!text.trim()) {
      setActionError('Add text to this block before generating audio.')
      return
    }
    setGenerating(true)
    setActionError(null)
    const fresh = getTtsSettings()
    setHasTtsKey(!!fresh.apiKey)
    const { url, error } = await generateBlockTts({
      text,
      voiceId: voiceId ?? 'ai_female_soft',
      userId,
      bookId,
      blockId: block.id,
    })
    if (url) {
      onUpdate({ audioUrl: url } as Partial<StoryBlock>)
    } else {
      setActionError(error ?? 'Generation failed.')
    }
    setGenerating(false)
  }

  const handleDelete = async () => {
    if (!userId || !block.audioUrl) return
    audioRef.current?.pause()
    setIsPlaying(false)
    await deleteBlockAudio(userId, bookId, block.id)
    onUpdate({ audioUrl: undefined } as Partial<StoryBlock>)
    setCurrentTime(0)
    setDuration(0)
  }

  // -- Mini player --

  const initAudio = () => {
    if (audioRef.current) return
    if (!block.audioUrl) return
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
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play()
      setIsPlaying(true)
    }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const blockText   = getBlockText(block)
  const canGenerate = !!blockText.trim() && !!userId

  // -- No audio yet --

  if (!block.audioUrl && !uploading && !generating) {
    return (
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            className="btn-ghost text-xs px-2 py-1 border border-bg-border hover:border-accent/40"
            onClick={() => fileInputRef.current?.click()}
            disabled={!userId}
            title={!userId ? 'Loading user...' : 'Upload an audio file'}
          >
            <Upload size={11} /> Upload
          </button>

          <button
            className={`btn-ghost text-xs px-2 py-1 border transition-colors ${isSpeaking ? 'border-info/60 text-info' : 'border-bg-border hover:border-info/50 hover:text-info'}`}
            onClick={speakPreview}
            disabled={!getBlockText(block).trim()}
            title={isSpeaking ? 'Stop preview' : 'Preview with browser voice'}
          >
            {isSpeaking ? <Pause size={11} /> : <Mic size={11} />}
            {isSpeaking ? 'Stop' : 'Preview'}
          </button>

          <button
            className="btn-ghost text-xs px-2 py-1 border border-bg-border hover:border-gold/50 hover:text-gold disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleGenerate}
            disabled={!canGenerate}
            title={
              !hasTtsKey
                ? 'Add your OpenAI or ElevenLabs API key in Settings'
                : !blockText.trim()
                  ? 'Add text to this block first'
                  : 'Generate AI voice for this block'
            }
          >
            <Wand2 size={11} /> Generate
          </button>

          {!actionError && (
            <span className="text-text-muted text-xs">No audio</span>
          )}
          {actionError && (
            <span className="text-danger text-xs flex items-center gap-1">
              <AlertCircle size={11} /> {actionError}
            </span>
          )}
        </div>

        {/* TTS key hint */}
        {!hasTtsKey && !!blockText.trim() && (
          <p className="text-[10px] text-text-muted leading-relaxed">
            No API key saved.{' '}
            <a href="/settings" className="text-accent underline underline-offset-2">
              Add it in Settings
            </a>{' '}
            to enable AI voice generation.
          </p>
        )}
      </div>
    )
  }

  // -- Loading states --

  if (uploading) {
    return (
      <div className="flex items-center gap-2 pt-1 text-text-muted text-xs">
        <Loader2 size={12} className="animate-spin text-accent" />
        Uploading audio…
      </div>
    )
  }

  if (generating) {
    return (
      <div className="flex items-center gap-2 pt-1 text-text-muted text-xs">
        <Loader2 size={12} className="animate-spin text-gold" />
        <span className="text-gold">Generating AI voice…</span>
      </div>
    )
  }

  // -- Mini player (audio exists) --

  return (
    <div className="pt-1 space-y-1.5">
      {/* Progress bar */}
      <div
        className="w-full h-1 rounded-full bg-bg-border overflow-hidden cursor-pointer"
        onClick={e => {
          if (!audioRef.current || !duration) return
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          const pct  = (e.clientX - rect.left) / rect.width
          audioRef.current.currentTime = pct * duration
        }}
      >
        <div
          className="h-full bg-accent rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-2">
        <button
          className="w-6 h-6 rounded-full bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors shrink-0"
          onClick={togglePlay}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying
            ? <Pause size={9} className="text-white" />
            : <Play  size={9} className="text-white ml-0.5" />
          }
        </button>

        <span className="text-[10px] text-text-muted tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <div className="flex items-center gap-1 ml-auto">
          {/* Re-generate */}
          <button
            className="btn-ghost text-[10px] px-1.5 py-0.5 border border-bg-border hover:border-gold/40 hover:text-gold disabled:opacity-40"
            onClick={handleGenerate}
            disabled={!canGenerate || generating}
            title="Re-generate AI voice"
          >
            <RefreshCw size={9} /> Re-gen
          </button>

          {/* Delete */}
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
