'use client'
import { useRef, useState, useEffect } from 'react'
import { Upload, Play, Pause, Trash2, Mic, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadBlockAudio, deleteBlockAudio } from '@/lib/supabase/storage'
import type { StoryBlock } from '@/types'

interface AudioUploadRowProps {
  block: StoryBlock
  bookId: string
  onUpdate: (updates: Partial<StoryBlock>) => void
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function AudioUploadRow({ block, bookId, onUpdate }: AudioUploadRowProps) {
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const audioRef      = useRef<HTMLAudioElement | null>(null)

  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isPlaying,   setIsPlaying]   = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(0)
  const [userId,      setUserId]      = useState<string | null>(null)

  // Get current user id once
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  // Tear down audio when audioUrl changes or component unmounts
  useEffect(() => {
    return () => { audioRef.current?.pause() }
  }, [block.audioUrl])

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return

    setUploading(true)
    setUploadError(null)

    const url = await uploadBlockAudio(userId, bookId, block.id, file)

    if (url) {
      onUpdate({ audioUrl: url } as Partial<StoryBlock>)
    } else {
      setUploadError('Upload failed — check storage bucket & RLS policies.')
    }
    setUploading(false)
    // Reset file input so the same file can be re-uploaded if needed
    if (fileInputRef.current) fileInputRef.current.value = ''
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

  // ── Mini player ─────────────────────────────────────────────────────────────

  const initAudio = () => {
    if (audioRef.current) return  // already init'd for this url
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

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!block.audioUrl && !uploading) {
    return (
      <div className="flex items-center gap-2 pt-1">
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
          title={!userId ? 'Loading user…' : 'Upload an audio file for this block'}
        >
          <Upload size={11} /> Upload audio
        </button>
        {uploadError && (
          <span className="text-danger text-xs flex items-center gap-1">
            <AlertCircle size={11} /> {uploadError}
          </span>
        )}
        {!block.audioUrl && !uploadError && (
          <span className="text-text-muted text-xs">No audio</span>
        )}
      </div>
    )
  }

  if (uploading) {
    return (
      <div className="flex items-center gap-2 pt-1 text-xs text-text-secondary">
        <Loader2 size={12} className="animate-spin text-accent" />
        Uploading…
      </div>
    )
  }

  // Has audioUrl — show mini player
  return (
    <div className="pt-1 space-y-1.5">
      <div className="flex items-center gap-2">
        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          className="w-7 h-7 rounded-full bg-accent/20 hover:bg-accent/30 flex items-center justify-center shrink-0 transition-colors"
          title={isPlaying ? 'Pause' : 'Play preview'}
        >
          {isPlaying
            ? <Pause size={11} className="text-accent" />
            : <Play  size={11} className="text-accent ml-0.5" />
          }
        </button>

        {/* Waveform progress bar */}
        <div className="flex-1 h-1.5 bg-bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Time */}
        <span className="text-text-muted text-[10px] font-mono w-10 text-right shrink-0">
          {isPlaying || currentTime > 0
            ? `${formatTime(currentTime)} / ${formatTime(duration)}`
            : formatTime(duration) || '—'
          }
        </span>

        {/* Audio badge */}
        <span className="flex items-center gap-1 text-[10px] text-success shrink-0">
          <Mic size={10} /> Audio
        </span>

        {/* Re-upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-text-muted hover:text-text-secondary text-[10px] shrink-0 transition-colors"
          title="Replace audio file"
        >
          <Upload size={11} />
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="text-text-muted hover:text-danger text-[10px] shrink-0 transition-colors"
          title="Remove audio"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}
